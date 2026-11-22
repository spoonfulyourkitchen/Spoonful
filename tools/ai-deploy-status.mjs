

import { readFileSync } from 'node:fs';

const REF = 'gmfkleugoxafmvprqatk';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const token = (/^SUPABASE_ACCESS_TOKEN=(sbp_\S+)/m.exec(env)?.[1] ?? '').trim();
if (!token) {
  console.log('Kein SUPABASE_ACCESS_TOKEN in .env.local.');
  process.exit(1);
}
const head = { Authorization: `Bearer ${token}` };

const info = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/ai`, { headers: head });
const data = await info.json().catch(() => ({}));
console.log(`Funktion: HTTP ${info.status}`);
console.log(`  slug=${data?.slug} status=${data?.status} version=${data?.version} updated=${data?.updated_at}`);

const bodyRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/ai/body`, { headers: head });
const body = await bodyRes.text();
console.log(`Quelltext: HTTP ${bodyRes.status}, ${body.length} Zeichen`);
for (const marker of [
  'MODEL_CHAIN',
  'paidCallsToday',
  'deepseek/deepseek-v4.1-flash',
  'peakSummary',
  'BEST_FREE_MODELS',
  'ling-3.0-flash-vl:free',
  'gemma-4-31b-it:free',
  'nemotron-3-super-120b-a12b:free',
  'KEYS_PER_MODEL = 1',
]) {
  console.log(`  ${body.includes(marker) ? 'OK   ' : 'FEHLT'} ${marker}`);
}
console.log(`  ${body.includes('MODELS_ENDPOINT') ? 'FEHLT (alter Live-Abruf noch drin)' : 'OK    kein Live-Abruf der Modell-Liste mehr'}`);
