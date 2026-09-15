/**
 * Deployt die Supabase-Funktion `ai` samt Secrets — in einem Befehl.
 *
 * Voraussetzung: ein **Personal Access Token** von Supabase
 *   Dashboard → Account → Access Tokens → „Generate new token“ (sbp_…)
 *
 * Einmalig setzen (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *
 * Dann:
 *   node tools/deploy-ai.mjs --secrets     # OpenRouter-Keys als Secrets setzen
 *   node tools/deploy-ai.mjs               # nur Funktion deployen
 *   node tools/deploy-ai.mjs --secrets --deploy
 *
 * Ohne Token läuft nichts — der Service-Role-Key reicht für Deploys NICHT aus.
 */
import { readFileSync, readdirSync } from 'node:fs';

const REF = 'gmfkleugoxafmvprqatk';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const DO_SECRETS = process.argv.includes('--secrets');
const DO_DEPLOY = process.argv.includes('--deploy') || !DO_SECRETS;
const API = `https://api.supabase.com/v1/projects/${REF}`;

if (!TOKEN.startsWith('sbp_')) {
  console.log('Kein Personal Access Token gefunden (SUPABASE_ACCESS_TOKEN=sbp_…).');
  process.exit(1);
}

const head = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

/** Keys aus .env.local und aus dem Bot sammeln (OPENROUTER_API_KEY … _24). */
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
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, content: readFileSync(new URL(name, dir), 'utf8') }));
  console.log(`Funktion deployen (${files.map((f) => f.name).join(', ')})…`);

  const listRes = await fetch(`${API}/functions`, { headers: head });
  const listJson = await listRes.json().catch(() => []);
  const existing = Array.isArray(listJson) ? listJson.find((entry) => entry?.slug === 'ai') : null;

  const body = JSON.stringify({
    slug: 'ai',
    name: 'ai',
    verify_jwt: false,
    entrypoint_path: 'index.ts',
    files,
  });
  const res = existing
    ? await fetch(`${API}/functions/ai`, { method: 'PATCH', headers: head, body })
    : await fetch(`${API}/functions`, { method: 'POST', headers: head, body });
  console.log(`Funktion: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
}
