/**
 * Open Food Facts lookups (2.0.0, tracker block).
 *
 * Free, no API key, no account: search by name and look up by barcode. Results
 * are normalised to per-100 g values and can be logged straight into the
 * calorie tracker. Everything is best-effort - a missing product is not an
 * error, the caller just shows "not found".
 */
export type FoodHit = {
  code: string;
  name: string;
  brand?: string;
  /** Values per 100 g / 100 ml. */
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Human readable serving, e.g. "30 g" or "1 glass (200 ml)". */
  serving?: string;
  /** Weight of one serving in g/ml (2.1.0) - used by the portion chooser. */
  servingGrams?: number;
  /** Weight of the whole package in g/ml (2.1.0). */
  packageGrams?: number;
  /** Raw quantity text from Open Food Facts, e.g. "500 g". */
  quantity?: string;
};

/** How the user wants to log a scanned/searched product (2.1.0). */
export type PortionMode = 'serving' | 'hundred' | 'package' | 'custom';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,product_quantity,quantity';

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
};

/** Reads "500 g" / "1,5 l" / "250ml" -> grams (or millilitres for drinks). */
function parseGrams(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|cl)?/);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = m[2] ?? 'g';
  if (unit === 'kg' || unit === 'l') return Math.round(value * 1000);
  if (unit === 'cl') return Math.round(value * 10);
  return Math.round(value);
}

function normalize(p: any): FoodHit | null {
  if (!p || !p.product_name) return null;
  const n: any = p.nutriments ?? {};
  const serving = p.serving_size ? String(p.serving_size) : undefined;
  return {
    code: String(p.code ?? p._id ?? ''),
    name: String(p.product_name).slice(0, 120),
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    kcal: num(n['energy-kcal_100g'] ?? n['energy-kcal']),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    serving,
    servingGrams: num(p.serving_quantity) ?? parseGrams(serving),
    packageGrams: num(p.product_quantity) ?? parseGrams(p.quantity),
    quantity: p.quantity ? String(p.quantity) : undefined,
  };
}

/** Grams of the chosen portion (null when the product does not know it). */
export function portionGrams(hit: FoodHit, mode: PortionMode, custom?: number): number | null {
  if (mode === 'hundred') return 100;
  if (mode === 'serving') return hit.servingGrams ?? 100;
  if (mode === 'package') return hit.packageGrams ?? null;
  const value = Number(custom);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Scales the per-100 g values of a product to the chosen portion. */
export function scaleToPortion(hit: FoodHit, grams: number) {
  const f = grams / 100;
  const round1 = (v?: number) => (v == null ? undefined : Math.round(v * f * 10) / 10);
  return {
    calories: hit.kcal != null ? Math.round(hit.kcal * f) : 0,
    protein: round1(hit.protein),
    carbs: round1(hit.carbs),
    fat: round1(hit.fat),
  };
}

async function withTimeout<T>(url: string, ms = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Spoonful/2.0 (Android; recipe app)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Full text search over the Open Food Facts database. */
export async function searchFoods(query: string, limit = 12): Promise<FoodHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    `${SEARCH_URL}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1` +
    `&page_size=${limit}&fields=${FIELDS}`;
  const data = await withTimeout<{ products?: any[] }>(url);
  return (data?.products ?? []).map(normalize).filter((x): x is FoodHit => !!x);
}

/** Looks up a single product by its EAN/UPC barcode. */
export async function productByBarcode(barcode: string): Promise<FoodHit | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 6) return null;
  const data = await withTimeout<{ status?: number; product?: any }>(`${PRODUCT_URL}${code}.json`);
  if (!data || data.status === 0) return null;
  const hit = normalize(data.product);
  return hit && hit.code ? hit : hit ? { ...hit, code } : null;
}
