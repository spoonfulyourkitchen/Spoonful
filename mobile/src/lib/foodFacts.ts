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

/**
 * 3.3.0: Deutlich mehr Produkte werden erkannt.
 *
 * Vorher brauchte ein Treffer zwingend `product_name` — viele Einträge in Open
 * Food Facts haben aber nur einen generischen Namen oder einen Namen in einer
 * anderen Sprache und fielen damit komplett raus. Jetzt wird der Reihe nach
 * alles genommen, was da ist, und der Name notfalls aus Marke + Menge gebaut.
 */
function normalize(p: any, fallbackCode?: string): FoodHit | null {
  if (!p || typeof p !== 'object') return null;
  const n: any = p.nutriments ?? {};
  const brand = p.brands ? String(p.brands).split(',')[0].trim() : undefined;

  /* Name: Hauptname, dann Sprachvarianten, dann generisch, dann Marke+Menge. */
  const candidates = [
    p.product_name,
    p.product_name_de,
    p.product_name_en,
    p.generic_name,
    p.generic_name_de,
    p.generic_name_en,
    p.abbreviated_product_name,
  ];
  let name = candidates.map((c) => (c ? String(c).trim() : '')).find((c) => c.length > 1) ?? '';
  if (!name && brand) name = `${brand}${p.quantity ? ` ${String(p.quantity)}` : ''}`;
  if (!name) return null;

  /* Ohne Nährwerte bringt der Treffer nichts — dann lieber „nicht gefunden". */
  const hasEnergy = (n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n.proteins_100g) != null;
  if (!hasEnergy) return null;

  const serving = p.serving_size ? String(p.serving_size) : undefined;
  return {
    code: String(p.code ?? p._id ?? fallbackCode ?? ''),
    name: name.slice(0, 120),
    brand,
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
  return (data?.products ?? []).map((p: any) => normalize(p)).filter((x): x is FoodHit => !!x);
}

/**
 * 3.3.0: Barcode-Lookup mit mehreren Chancen.
 *
 * Scanner liefern je nach Gerät 8-, 12- oder 13-stellige Codes (EAN-8, UPC-A,
 * EAN-13). Bisher wurde nur exakt eine Schreibweise abgefragt — deshalb fand
 * die App viele Produkte nicht. Jetzt werden die üblichen Varianten probiert
 * (UPC-A ↔ EAN-13 mit/ohne führende Null) und zwei Open-Food-Facts-Endpunkte.
 */
export async function productByBarcode(barcode: string): Promise<FoodHit | null> {
  const digits = String(barcode ?? '').replace(/\D/g, '');
  if (digits.length < 6) return null;

  const variants: string[] = [digits];
  if (digits.length === 12) variants.push(`0${digits}`);          /* UPC-A → EAN-13 */
  if (digits.length === 13 && digits.startsWith('0')) variants.push(digits.slice(1));
  if (digits.length === 14 && digits.startsWith('0')) variants.push(digits.slice(1));

  for (const code of Array.from(new Set(variants))) {
    /* 1) v2 (mehr Felder, inkl. Sprachvarianten) */
    const v2 = await withTimeout<{ status?: number; product?: any }>(
      `${PRODUCT_URL}${code}.json?fields=${FIELDS},product_name_de,product_name_en,generic_name,generic_name_de,generic_name_en,abbreviated_product_name`,
    );
    const hitV2 = v2 && v2.status !== 0 ? normalize(v2.product, code) : null;
    if (hitV2) return hitV2;

    /* 2) v0 als Rückfall (andere Indexierung, findet manche Einträge) */
    const v0 = await withTimeout<{ status?: number; product?: any; code?: string }>(
      `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    );
    const hitV0 = v0 && v0.status !== 0 ? normalize(v0.product, code) : null;
    if (hitV0) return hitV0;
  }
  return null;
}
