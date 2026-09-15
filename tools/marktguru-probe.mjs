/**
 * Wegwerf-Sonde: Marktguru-Suche (offers/search) — liefert sie ohne Schlüssel?
 */
const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

const URLS = [
  'https://api.marktguru.de/api/v1/offers/search?as=list&q=Monster%20Energy&zipCode=35578',
  'https://api.marktguru.de/api/v1/offers/search?as=list&q=Monster%20Energy&zipCode=35578&limit=30',
  'https://api.marktguru.de/api/v1/offers?q=Monster%20Energy&zipCode=35578&limit=5',
];

for (const url of URLS) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    const text = await res.text();
    console.log(`\n=== ${url}\nHTTP ${res.status} (${text.length} Zeichen)`);
    console.log(text.slice(0, 400));
    if (res.ok && text.trim().startsWith('{')) {
      const json = JSON.parse(text);
      const rows = json.results ?? json.offers ?? json.data ?? [];
      console.log(`Treffer: ${Array.isArray(rows) ? rows.length : 0}`);
      if (Array.isArray(rows) && rows[0]) {
        const r = rows[0];
        console.log('Felder:', Object.keys(r).join(', '));
        console.log('brand.name       =', r.brand?.name);
        console.log('price            =', r.price, r.absolutePrice);
        console.log('retailers[0].name=', r.retailers?.[0]?.name);
        console.log('validityDates    =', JSON.stringify(r.validityDates));
        console.log('product/name     =', r.product?.name ?? r.name ?? r.description);
      }
    }
  } catch (e) {
    console.log(`\n=== ${url}\nFEHLER: ${e.message}`);
  }
}
