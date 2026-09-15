/**
 * 3.2.1: MONSTR — Angebots-Engine für Monster Energy (und beliebige Suchbegriffe).
 *
 * Drei Quellen, alle ohne Login:
 *   1. Preisrunter — offene Schnittstelle, kein Schlüssel nötig.
 *   2. Marktguru   — Schlüssel wird automatisch von der Web-Seite gelesen und
 *                    zwischengespeichert (der Skill macht genau dasselbe).
 *   3. ALDI Süd    — öffentliche JSON-Schnittstelle (mein ALDI).
 *
 * Warum diese Datei so aussieht
 * - Jede Quelle hat ein **Zeitlimit**. Die alte Variante hing an einem MCP-Server
 *   und lief dadurch ins Leere; hier antwortet "Preise holen" immer schnell.
 * - Jede Quelle darf **ausfallen**: die anderen liefern trotzdem.
 * - Alle Antworten werden **tolerant** gelesen (Feldnamen unterscheiden sich),
 *   damit ein stiller Serverwechsel die Seite nicht kaputt macht.
 * - Das Ergebnis wird lokal **zwischengespeichert**, damit die Seite sofort da ist.
 *
 * Preisvergleich: pro Liter (bzw. pro Kilo) rechnen, sonst sind 0,5-l-Dose und
 * 0,33-l-Dose nicht vergleichbar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DealSource = 'preisrunter' | 'marktguru' | 'aldi';

export type Deal = {
  id: string;
  source: DealSource;
  name: string;
  market: string;
  /** Preis in Euro (ganze Packung). */
  price: number;
  /** Füllmenge, z. B. 0.5. */
  size?: number;
  /** l | ml | kg | g | stk */
  sizeUnit?: string;
  /** Grundpreis pro Liter bzw. pro Kilo. */
  unitPrice?: number;
  /** true = Angebot/Aktion, false = Normalpreis. */
  sale: boolean;
  url?: string;
  /** 3.2.2: Gültigkeit der Aktion (aus `validityDates` der Quelle). */
  validFrom?: number;
  validTo?: number;
};

export type SourceReport = {
  source: DealSource;
  ok: boolean;
  count: number;
  error?: string;
};

export type DealsResult = {
  ok: boolean;
  query: string;
  zip: string;
  fetchedAt: number;
  deals: Deal[];
  sources: SourceReport[];
};

export const DEAL_SOURCES: DealSource[] = ['preisrunter', 'marktguru', 'aldi'];

/** Kein Aufruf darf länger als das hier hängen. */
const TIMEOUT_MS = 9000;

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

/* ── kleine Helfer ───────────────────────────────────────────────────────── */

/** Zahl aus "1,49 €", 1.49 oder "1.49" machen. Gibt NaN zurück, wenn nichts passt. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = String(value ?? '').replace(/[^0-9.,-]/g, '');
  if (!raw) return NaN;
  // 1.234,56 -> 1234.56 | 1,234.56 -> 1234.56 | 1,49 -> 1.49 | 1.49 -> 1.49
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = raw.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Grundpreis pro Liter bzw. pro Kilo. */
export function unitPriceOf(price: number, size?: number, unit?: string): number | undefined {
  if (!Number.isFinite(price) || price <= 0) return undefined;
  if (!size || !Number.isFinite(size) || size <= 0) return undefined;
  const u = String(unit ?? '').toLowerCase();
  if (u === 'l') return price / size;
  if (u === 'ml') return price / (size / 1000);
  if (u === 'kg') return price / size;
  if (u === 'g') return price / (size / 1000);
  return undefined;
}

/** Füllmenge aus Text ziehen: "0,5 l", "500ml", "1,25 L". */
export function sizeFromText(text: string): { size: number; unit: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|l|kg|g)\b/i.exec(String(text ?? ''));
  if (!m) return null;
  const size = toNumber(m[1]);
  if (!Number.isFinite(size) || size <= 0) return null;
  return { size, unit: m[2].toLowerCase() };
}

async function getText(url: string, headers?: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'de,en;q=0.8', ...(headers ?? {}) },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** JSON holen — HTML-Antworten (Fehlerseiten) fliegen als Fehler raus. */
async function getJson(url: string, headers?: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<any> {
  const text = (await getText(url, { Accept: 'application/json', ...(headers ?? {}) }, timeoutMs)).trim();
  if (!text || text.startsWith('<')) throw new Error('not-json');
  return JSON.parse(text);
}

function firstNumber(...values: unknown[]): number {
  for (const v of values) {
    const n = toNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function firstString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

/** Liste aus den üblichen Verpackungen holen (Array, .products, .results, ...). */
function rowsOf(data: any, keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ['products', 'results', 'items', 'offers', 'data', 'content', ...keys]) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray(value.content)) return value.content;
  }
  return [];
}

/* ── Quelle 1: Preisrunter (offen, kein Schlüssel) ───────────────────────── */

const PREISRUNTER_API = 'https://api.preisrunter.net/wrapper/openclaw-v1/products/';

async function searchPreisrunter(query: string): Promise<Deal[]> {
  const url = `${PREISRUNTER_API}?q=${encodeURIComponent(query)}&region=de`;
  const data = await getJson(url);
  const rows = rowsOf(data, []);
  const deals: Deal[] = [];
  for (const row of rows) {
    const name = firstString(row?.productName, row?.name, row?.title);
    const price = firstNumber(row?.productPrice, row?.price, row?.priceValue);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const size = firstNumber(row?.productSize, row?.size);
    const hasSize = Number.isFinite(size) && size > 0;
    const sizeUnit = firstString(row?.productUnit, row?.unit).toLowerCase();
    const market = firstString(row?.productMarket, row?.market, row?.marketName) || 'preisrunter.de';
    const link = firstString(row?.productLink, row?.link, row?.url);
    deals.push({
      id: `preisrunter:${market}:${name}:${price}`,
      source: 'preisrunter',
      name,
      market,
      price,
      size: hasSize ? size : undefined,
      sizeUnit: sizeUnit || undefined,
      unitPrice: unitPriceOf(price, hasSize ? size : undefined, sizeUnit),
      sale: row?.productSale === true || row?.sale === true,
      url: link.startsWith('http') ? link : undefined,
    });
  }
  return deals;
}

/* ── Quelle 2: Marktguru (Schlüssel automatisch holen) ───────────────────── */

const MARKTGURU_API = 'https://api.marktguru.de/api/v1/offers';
/**
 * 3.2.2: Erster Weg für die Angebotssuche (wie von Marktguru dokumentiert):
 *   GET /api/v1/offers/search?as=list&q=Monster%20Energy&zipCode=35578
 * Liefert u. a. `brand.name`, `price`, `retailers[0].name` und `validityDates`.
 */
const MARKTGURU_SEARCH = 'https://api.marktguru.de/api/v1/offers/search';
const MARKTGURU_HOME = 'https://www.marktguru.de/';
const MARKTGURU_KEY_CACHE = 'spoonful:marktguru-key';
const MARKTGURU_KEY_TTL = 6 * 60 * 60 * 1000;

let marktguruKey: string | null | undefined; // undefined = noch nicht geladen

/** Schlüssel von Hand setzen (falls das automatische Lesen mal scheitert). */
export async function setMarktguruKey(key: string): Promise<void> {
  const value = String(key ?? '').trim();
  marktguruKey = value || null;
  try {
    if (value) await AsyncStorage.setItem(MARKTGURU_KEY_CACHE, JSON.stringify({ key: value, at: Date.now() }));
    else await AsyncStorage.removeItem(MARKTGURU_KEY_CACHE);
  } catch {
    /* Zwischenspeicher ist optional */
  }
}

async function loadStoredMarktguruKey(): Promise<string | null> {
  if (marktguruKey !== undefined) return marktguruKey;
  marktguruKey = null;
  try {
    const raw = await AsyncStorage.getItem(MARKTGURU_KEY_CACHE);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.key && Date.now() - Number(parsed.at ?? 0) < MARKTGURU_KEY_TTL) marktguruKey = String(parsed.key);
  } catch {
    /* ignore */
  }
  return marktguruKey ?? null;
}

/** Schlüssel aus der Web-App lesen (einmalig, danach gespeichert). */
async function discoverMarktguruKey(): Promise<string | null> {
  const guid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const named = /(?:x-api-key|apiKey|api_key|apikey)["'\s:=]{1,12}([A-Za-z0-9._-]{16,80})/i;
  const scan = (text: string): string | null => {
    const byName = named.exec(text);
    if (byName) return byName[1];
    const found = guid.exec(text);
    return found ? found[0] : null;
  };
  try {
    const html = await getText(MARKTGURU_HOME, { 'User-Agent': BROWSER_UA, Accept: 'text/html' });
    const direct = scan(html);
    if (direct) return direct;
    const scripts = Array.from(html.matchAll(/src="([^"]+\.js)"/gi))
      .map((m) => m[1])
      .filter((s) => /_next|static|assets|main|app/i.test(s))
      .slice(0, 4);
    for (const src of scripts) {
      const url = src.startsWith('http') ? src : `https://www.marktguru.de${src.startsWith('/') ? '' : '/'}${src}`;
      try {
        const js = await getText(url, { 'User-Agent': BROWSER_UA, Accept: 'text/javascript' }, 6000);
        const found = scan(js);
        if (found) return found;
      } catch {
        /* nächstes Skript */
      }
    }
  } catch {
    /* keine Verbindung -> Quelle meldet sich als nicht verfügbar */
  }
  return null;
}

async function marktguruApiKey(): Promise<string | null> {
  const stored = await loadStoredMarktguruKey();
  if (stored) return stored;
  const discovered = await discoverMarktguruKey();
  if (discovered) await setMarktguruKey(discovered);
  return discovered;
}

/** Zeitstempel aus ISO-Text oder Zahl lesen (Gültigkeit). */
function toTime(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Gültigkeit aus `validityDates` holen (Start/Ende, verschiedene Schreibweisen). */
function validityOf(row: any): { validFrom?: number; validTo?: number } {
  const dates = row?.validityDates ?? row?.validity ?? {};
  const list: any[] = Array.isArray(dates) ? dates : [dates];
  let validFrom: number | undefined;
  let validTo: number | undefined;
  for (const entry of list) {
    const from = toTime(entry?.start ?? entry?.from ?? entry?.validFrom ?? entry?.begin);
    const to = toTime(entry?.end ?? entry?.to ?? entry?.validTo ?? entry?.until);
    if (from && (!validFrom || from < validFrom)) validFrom = from;
    if (to && (!validTo || to > validTo)) validTo = to;
  }
  return { validFrom, validTo };
}

/** Marktguru-Antwort lesen: brand.name, price, retailers[0].name, validityDates. */
export function parseMarktguru(data: any): Deal[] {
  const rows = rowsOf(data, ['results', 'ads', 'prospekte']);
  const deals: Deal[] = [];
  for (const row of rows) {
    const brand = firstString(row?.brand?.name, row?.brand, row?.advertiser?.name, row?.advertiser);
    const product = row?.product ?? row?.article ?? {};
    const productName = firstString(product?.name, product?.title, row?.title, row?.name, row?.description);
    const name = firstString(
      brand && productName && !productName.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${productName}`
        : '',
      productName,
      brand,
    );
    if (!name) continue;
    const price = firstNumber(row?.price, row?.absolutePrice, row?.priceValue, row?.salePrice, product?.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const market =
      firstString(row?.retailers?.[0]?.name, row?.retailer?.name, row?.retailers?.[0], row?.retailer) ||
      firstString(row?.advertiser?.name, row?.company) ||
      'Marktguru';
    const parsed = sizeFromText(firstString(product?.size, row?.size, row?.description, name));
    const size = parsed?.size;
    const sizeUnit = (parsed?.unit ?? firstString(row?.priceUnit, product?.unit).toLowerCase()) || undefined;
    const link = firstString(row?.url, row?.link, row?.deeplink);
    const { validFrom, validTo } = validityOf(row);
    deals.push({
      id: `marktguru:${firstString(row?.id, row?.offerId, name)}:${price}`,
      source: 'marktguru',
      name,
      market,
      price,
      size,
      sizeUnit,
      unitPrice: unitPriceOf(price, size, sizeUnit),
      sale: true,
      url: link.startsWith('http') ? link : undefined,
      validFrom,
      validTo,
    });
  }
  return deals;
}

async function searchMarktguru(query: string, zip: string): Promise<Deal[]> {
  const key = await marktguruApiKey();
  const headers: Record<string, string> = { 'User-Agent': BROWSER_UA };
  if (key) headers['x-api-key'] = key;
  const encodedQuery = encodeURIComponent(query);
  const encodedZip = encodeURIComponent(zip);
  // 1. Suche (schnellster Weg), 2. alter Weg als Reserve.
  const urls = [
    `${MARKTGURU_SEARCH}?as=list&q=${encodedQuery}&zipCode=${encodedZip}&limit=60&offset=0`,
    `${MARKTGURU_API}?q=${encodedQuery}&zipCode=${encodedZip}&limit=60&offset=0`,
  ];
  let lastError = 'unerreichbar';
  for (const url of urls) {
    try {
      const data = await getJson(url, headers);
      const deals = parseMarktguru(data);
      if (deals.length) return deals;
      lastError = 'keine-treffer';
    } catch (e: any) {
      const message = String(e?.message ?? e);
      if (/401/.test(message) && !key) throw new Error('kein-schluessel');
      lastError = message;
    }
  }
  throw new Error(lastError);
}

/* ── Quelle 3: ALDI Süd (öffentliche JSON-Schnittstelle) ─────────────────── */

/** Mehrere Pfade, weil sich die Adresse der offenen Schnittstelle ändern kann. */
const ALDI_ENDPOINTS: ((query: string) => string)[] = [
  (q) => `https://api.mein-aldi.de/api/v1/search?query=${q}&limit=60`,
  (q) => `https://api.mein-aldi.de/api/search/products?q=${q}&limit=60`,
  (q) => `https://api.aldi-sued.de/api/v1/search?q=${q}&limit=60`,
  (q) => `https://api.aldi-sued.de/api/v1/products?search=${q}`,
  (q) => `https://www.aldi-sued.de/api/v1/search?q=${q}`,
];

function parseAldi(data: any): Deal[] {
  const rows = rowsOf(data, ['hits', 'articles', 'productList']);
  const deals: Deal[] = [];
  for (const row of rows) {
    const node = row?.product ?? row?.article ?? row?._source ?? row;
    const name = firstString(node?.name, node?.title, node?.productName, node?.description);
    if (!name) continue;
    const price = firstNumber(
      node?.price?.value,
      node?.price,
      node?.currentPrice?.value,
      node?.currentPrice,
      row?.price,
    );
    if (!Number.isFinite(price) || price <= 0) continue;
    const parsed = sizeFromText(firstString(node?.quantity, node?.size, node?.packaging?.size, node?.priceUnit, name));
    const size = parsed?.size;
    const sizeUnit = parsed?.unit;
    const link = firstString(node?.url, node?.link, row?.url);
    deals.push({
      id: `aldi:${firstString(node?.id, node?.sku, name)}:${price}`,
      source: 'aldi',
      name,
      market: 'ALDI SÜD',
      price,
      size,
      sizeUnit,
      unitPrice: unitPriceOf(price, size, sizeUnit),
      sale: node?.onSale === true || node?.isOffer === true || node?.offer === true,
      url: link.startsWith('http') ? link : undefined,
    });
  }
  return deals;
}

async function searchAldi(query: string): Promise<Deal[]> {
  const encoded = encodeURIComponent(query);
  let lastError = 'unerreichbar';
  for (const build of ALDI_ENDPOINTS) {
    try {
      const data = await getJson(build(encoded), { 'User-Agent': BROWSER_UA });
      const deals = parseAldi(data);
      if (deals.length) return deals;
      lastError = 'keine-treffer';
    } catch (e: any) {
      lastError = String(e?.message ?? e);
    }
  }
  throw new Error(lastError);
}

/* ── Treffer prüfen ──────────────────────────────────────────────────────── */

/**
 * "Monster" allein bringt auch "Monster Munch" oder "Donutmonster" – hier bleibt
 * nur übrig, was wirklich ein Energy-Drink ist.
 */
const ENERGY_MARKERS =
  /\b(energy|energie|ultra|juiced|rehab|assault|khaos|pipeline|punch|paradise|absolutely zero|the doctor|mango loco|watermelon|nitro|java|import|hitman|mule|viking|dragon|bad apple|mixxd|espresso|super fuel)\b/i;

export function looksLikeEnergyDrink(name: string): boolean {
  const value = String(name ?? '');
  if (!/\bmonster\b/i.test(value)) return false;
  if (/\bmonster energy\b/i.test(value)) return true;
  return ENERGY_MARKERS.test(value);
}

/** Treffer der gesuchten Marke (Suchbegriff oben, Energy-Merkmale unten). */
export function matchesQuery(deal: Deal, query: string): boolean {
  const words = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const haystack = `${deal.name} ${deal.market}`.toLowerCase();
  if (words.length && !words.some((w) => haystack.includes(w))) return false;
  if (/monster/i.test(query)) return looksLikeEnergyDrink(deal.name);
  return true;
}

/**
 * "monster" allein bringt bei den Quellen auch Chips und Duschgel. Weil hier
 * Dosen gesucht sind, wird daraus "Monster Energy".
 */
export function normalizeQuery(query: string): string {
  const value = String(query ?? '').trim();
  if (!value) return 'Monster Energy';
  if (/\bmonster\b/i.test(value) && !/energy|energie/i.test(value)) return `${value} Energy`;
  return value;
}

/* ── Zusammenführen ──────────────────────────────────────────────────────── */

const CACHE_KEY = 'spoonful:monstr-cache';

type SourceRunner = { source: DealSource; run: (query: string, zip: string) => Promise<Deal[]> };

const RUNNERS: SourceRunner[] = [
  { source: 'preisrunter', run: (query) => searchPreisrunter(query) },
  { source: 'marktguru', run: (query, zip) => searchMarktguru(query, zip) },
  { source: 'aldi', run: (query) => searchAldi(query) },
];

/** Billigster Literpreis zuerst, dann billigster Packungspreis, dann Name. */
export function sortDeals(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => {
    const ua = Number.isFinite(a.unitPrice) ? (a.unitPrice as number) : Number.POSITIVE_INFINITY;
    const ub = Number.isFinite(b.unitPrice) ? (b.unitPrice as number) : Number.POSITIVE_INFINITY;
    if (ua !== ub) return ua - ub;
    if (a.price !== b.price) return a.price - b.price;
    return a.name.localeCompare(b.name);
  });
}

function dedupe(deals: Deal[]): Deal[] {
  const seen = new Set<string>();
  const out: Deal[] = [];
  for (const deal of deals) {
    const key = `${deal.name.toLowerCase()}|${deal.market.toLowerCase()}|${deal.price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(deal);
  }
  return out;
}

/**
 * Alle drei Quellen parallel fragen. Fällt eine aus, kommen die anderen trotzdem.
 * `sources` sagt der Oberfläche, welche Quelle geantwortet hat ("LIVE" / "aus").
 */
export async function searchDeals(input: { query?: string; zip?: string } = {}): Promise<DealsResult> {
  const query = normalizeQuery(input.query ?? '');
  const zip = String(input.zip ?? '').trim() || '35576';

  const settled = await Promise.all(
    RUNNERS.map(async ({ source, run }) => {
      try {
        const found = await run(query, zip);
        const deals = found.filter((d) => matchesQuery(d, query));
        return { deals, report: { source, ok: true, count: deals.length } as SourceReport };
      } catch (e: any) {
        return { deals: [] as Deal[], report: { source, ok: false, count: 0, error: String(e?.message ?? e) } as SourceReport };
      }
    }),
  );

  const deals = sortDeals(dedupe(settled.flatMap((entry) => entry.deals)));
  const result: DealsResult = {
    ok: deals.length > 0,
    query,
    zip,
    fetchedAt: Date.now(),
    deals,
    sources: settled.map((entry) => entry.report),
  };
  if (result.ok) void saveDealsResult(result);
  return result;
}

/* ── Zwischenspeicher (damit die Seite sofort da ist) ────────────────────── */

export async function saveDealsResult(result: DealsResult): Promise<void> {
  try {
    // Nur die ersten 60 Treffer behalten - der Speicher soll klein bleiben.
    const slim: DealsResult = { ...result, deals: result.deals.slice(0, 60) };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(slim));
  } catch {
    /* Zwischenspeicher ist optional */
  }
}

export async function loadDealsResult(): Promise<DealsResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DealsResult;
    if (!parsed || !Array.isArray(parsed.deals)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearDealsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Grundpreis als Text: "3,78 €/l" bzw. "7,56 €/kg". */
export function formatUnitPrice(deal: Deal): string {
  if (!Number.isFinite(deal.unitPrice) || !deal.sizeUnit) return '';
  const per = deal.sizeUnit === 'l' || deal.sizeUnit === 'ml' ? 'l' : 'kg';
  return `${(deal.unitPrice as number).toFixed(2).replace('.', ',')} €/${per}`;
}

/** Packungsgröße als Text: "0,5 l". */
export function formatSize(deal: Deal): string {
  if (!deal.size || !deal.sizeUnit) return '';
  return `${String(deal.size).replace('.', ',')} ${deal.sizeUnit}`;
}

/**
 * 3.2.2: Gültigkeit der Aktion als kurzes Datum ("14.09.2026").
 * Wird im Monstr-Bildschirm hinter dem Marktnamen angezeigt.
 */
export function formatValidity(deal: Deal): string {
  const to = deal.validTo ?? deal.validFrom;
  if (!to) return '';
  try {
    return new Date(to).toLocaleDateString();
  } catch {
    return '';
  }
}
