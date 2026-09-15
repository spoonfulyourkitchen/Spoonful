/**
 * Wegwerf-Prüfskript: liest die Preisrunter-Antwort genau so, wie es
 * `mobile/src/lib/deals.ts` tut, und zeigt, was am Ende übrig bleibt.
 * Aufruf:  node tools/monstr-check.mjs
 */
const API = 'https://api.preisrunter.net/wrapper/openclaw-v1/products/';

const ENERGY_MARKERS =
  /\b(energy|energie|ultra|juiced|rehab|assault|khaos|pipeline|punch|paradise|absolutely zero|the doctor|mango loco|watermelon|nitro|java|import|hitman|mule|viking|dragon|bad apple|mixxd|espresso|super fuel)\b/i;

function looksLikeEnergyDrink(name) {
  if (!/\bmonster\b/i.test(name)) return false;
  if (/\bmonster energy\b/i.test(name)) return true;
  return ENERGY_MARKERS.test(name);
}

function unitPriceOf(price, size, unit) {
  if (!Number.isFinite(price) || price <= 0 || !size || !Number.isFinite(size) || size <= 0) return undefined;
  const u = String(unit ?? '').toLowerCase();
  if (u === 'l') return price / size;
  if (u === 'ml') return price / (size / 1000);
  if (u === 'kg') return price / size;
  if (u === 'g') return price / (size / 1000);
  return undefined;
}

const first = (...values) => values.map((v) => String(v ?? '').trim()).find((v) => v) ?? '';
const num = (value) => {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').replace(/[^0-9.,-]/g, '');
  if (!raw) return NaN;
  const lc = raw.lastIndexOf(',');
  const ld = raw.lastIndexOf('.');
  let s = raw;
  if (lc >= 0 && ld >= 0) s = lc > ld ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (lc >= 0) s = raw.replace(',', '.');
  return Number(s);
};

/** Wie in deals.ts: "monster" -> "monster Energy", sonst kommt Chips/Duschgel. */
function normalizeQuery(query) {
  const value = String(query ?? '').trim();
  if (!value) return 'Monster Energy';
  if (/\bmonster\b/i.test(value) && !/energy|energie/i.test(value)) return `${value} Energy`;
  return value;
}

for (const rawQuery of ['Monster Energy', 'monster']) {
  const query = normalizeQuery(rawQuery);
  const res = await fetch(`${API}?q=${encodeURIComponent(query)}&region=de`);
  const rows = await res.json();
  const deals = [];
  for (const row of rows ?? []) {
    const name = first(row?.productName, row?.name, row?.title);
    const price = num(row?.productPrice);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    if (!looksLikeEnergyDrink(name)) continue;
    const size = num(row?.productSize);
    const unit = first(row?.productUnit).toLowerCase();
    const hasSize = Number.isFinite(size) && size > 0;
    deals.push({
      name,
      market: first(row?.productMarket),
      price,
      unitPrice: unitPriceOf(price, hasSize ? size : undefined, unit),
      size: hasSize ? `${size} ${unit}` : '',
      url: first(row?.productLink),
    });
  }
  deals.sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity) || a.price - b.price);
  console.log(`\n=== "${rawQuery}" -> "${query}" -> ${rows?.length ?? 0} roh / ${deals.length} nach Filter ===`);
  for (const d of deals.slice(0, 8)) {
    console.log(
      `${(d.unitPrice ? d.unitPrice.toFixed(2) : '--').padStart(6)} EUR/l  ${d.price.toFixed(2).padStart(5)} EUR  ` +
        `${d.name} | ${d.market} | ${d.size} | ${d.url ? 'link ok' : 'kein Link'}`,
    );
  }
  if (!deals.length) console.log('  (nichts gefunden)');
}
