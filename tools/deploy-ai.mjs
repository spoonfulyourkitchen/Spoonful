

import { readFileSync } from 'node:fs';

const REF = 'gmfkleugoxafmvprqatk';
const DO_SECRETS = process.argv.includes('--secrets');
const DO_DEPLOY = process.argv.includes('--deploy') || !DO_SECRETS;
const API = `https://api.supabase.com/v1/projects/${REF}`;

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    return (/^SUPABASE_ACCESS_TOKEN=(sbp_\S+)/m.exec(env)?.[1] ?? '').trim();
  } catch {
    return '';
  }
}

const TOKEN = accessToken();

if (!TOKEN.startsWith('sbp_')) {
  console.log('Kein Personal Access Token gefunden.');
  console.log('Entweder SUPABASE_ACCESS_TOKEN setzen oder in .env.local eintragen:');
  console.log('  SUPABASE_ACCESS_TOKEN=sbp_…');
  process.exit(1);
}

const head = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function collectSecrets() {
  const files = [new URL('../.env.local', import.meta.url), new URL('./recipe-bot/.env', import.meta.url)];
  const out = new Map();
  for (const file of files) {
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^(OPENROUTER_API_KEY(_\d+)?)=(sk-or-v1-[^\s#]+)/.exec(line.trim());
      if (match) out.set(match[1], match[3]);
    }
  }
  out.set('OPENROUTER_PAID_MODEL', process.env.OPENROUTER_PAID_MODEL ?? 'openai/gpt-4o-mini');
  out.set('OPENROUTER_PAID_DAILY_LIMIT', process.env.OPENROUTER_PAID_DAILY_LIMIT ?? '100');
  return out;
}

if (DO_SECRETS) {
  const secrets = collectSecrets();
  console.log(`Secrets setzen: ${[...secrets.keys()].join(', ')}`);
  const res = await fetch(`${API}/secrets`, {
    method: 'POST',
    headers: head,
    body: JSON.stringify([...secrets].map(([name, value]) => ({ name, value }))),
  });
  console.log(`Secrets: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

if (DO_DEPLOY) {
  const dir = new URL('../supabase/functions/ai/', import.meta.url);
  const indexSrc = readFileSync(new URL('index.ts', dir), 'utf8');
  const peakSrc = readFileSync(new URL('peak.ts', dir), 'utf8');

  

  const bundle = () => {
    const peakInline = peakSrc.replace(/^export\s+(?=(const|function|type|interface|async)\b)/gm, '');
    const importLine = /^import .*from '\.\/peak\.ts';\r?\n/m;
    if (!importLine.test(indexSrc)) throw new Error('Import-Zeile für peak.ts nicht gefunden');
    const out = indexSrc.replace(
      importLine,
      `/* ── peak.ts (beim Deploy eingefügt) ── */\n${peakInline}/* ── /peak.ts ── */\n`,
    );
    if (/from '\.\//.test(out)) throw new Error('Es gibt noch einen lokalen Import');
    return out;
  };

  const source = bundle();
  console.log(`Funktion deployen (${source.length} Zeichen Quelltext, peak.ts eingefügt)…`);

  const res = await fetch(`${API}/functions/ai`, {
    method: 'PATCH',
    headers: head,
    body: JSON.stringify({ name: 'ai', verify_jwt: false, body: source }),
  });
  const text = await res.text();
  console.log(`Funktion: HTTP ${res.status} ${text.slice(0, 300)}`);

  /* Kontrolle: liegt der neue Code wirklich auf dem Server? */
  const check = await fetch(`${API}/functions/ai/body`, { headers: head });
  const deployed = await check.text();
  const markers = ['MODEL_CHAIN', 'paidCallsToday', 'deepseek/deepseek-v4.1-flash', 'peakSummary'];
  for (const marker of markers) {
    console.log(`  ${deployed.includes(marker) ? 'OK   ' : 'FEHLT'} ${marker}`);
  }
}
