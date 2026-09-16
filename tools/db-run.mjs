/**
 * SQL direkt auf das Supabase-Projekt ausführen (Management API „Run a query“).
 *
 * Nutzung:
 *   node tools/db-run.mjs --file tools/sql/xy.sql
 *   node tools/db-run.mjs --sql "select count(*) from shared_recipes"
 *
 * Token kommt aus `SUPABASE_ACCESS_TOKEN` oder aus der (git-ignorierten)
 * `.env.local`. Das ist derselbe Weg, über den die Funktion `ai` deployt wird.
 */
import { readFileSync } from 'node:fs';

const REF = 'gmfkleugoxafmvprqatk';

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    return (/^SUPABASE_ACCESS_TOKEN=(sbp_\S+)/m.exec(env)?.[1] ?? '').trim();
  } catch {
    return '';
  }
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const sqlIndex = args.indexOf('--sql');
let sql = '';
if (fileIndex !== -1) sql = readFileSync(args[fileIndex + 1], 'utf8');
else if (sqlIndex !== -1) sql = args[sqlIndex + 1];
else {
  console.error('Bitte --file <pfad> oder --sql "<query>" angeben.');
  process.exit(1);
}

const token = accessToken();
if (!token) {
  console.error('Kein Supabase-Access-Token gefunden (.env.local → SUPABASE_ACCESS_TOKEN=sbp_…).');
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
console.log(`HTTP ${response.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 4000));
} catch {
  console.log(text.slice(0, 4000));
}
if (!response.ok) process.exit(1);
