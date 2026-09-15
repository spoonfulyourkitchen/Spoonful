/**
 * Live-Prüfung der installierten Supabase-Funktion `ai`.
 *
 * Ablauf (nur mit dem Service-Key, kein Dashboard nötig):
 *  1. Testnutzer anlegen (bestätigt)
 *  2. mit ihm anmelden → echtes Nutzer-JWT holen
 *  3. Funktion `ai` aufrufen und antworten lassen
 *  4. Testnutzer wieder löschen
 *
 * Aufruf:  node tools/ai-live-check.mjs [--keep-user]
 */
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
let botEnv = '';
try {
  botEnv = readFileSync(new URL('./recipe-bot/.env', import.meta.url), 'utf8');
} catch {
  botEnv = '';
}
const readEnv = (name) => new RegExp(`^${name}=(.*)$`, 'm').exec(env)?.[1]?.trim() ?? '';
const readBotEnv = (name) => new RegExp(`^${name}=(.*)$`, 'm').exec(botEnv)?.[1]?.trim() ?? '';
const url = readEnv('VITE_SUPABASE_URL') || 'https://gmfkleugoxafmvprqatk.supabase.co';
const anon = readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('SUPABASE_ANON_KEY');
const service = readBotEnv('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY;
const keep = process.argv.includes('--keep-user');

if (!service) {
  console.log('SUPABASE_SERVICE_ROLE_KEY fehlt (.env.local).');
  process.exit(1);
}

const adminHeaders = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
const email = `ai-check-${Date.now()}@spoonful.test`;
const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;

console.log(`Projekt: ${url}`);

const create = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ email, password, email_confirm: true }),
});
const created = await create.json().catch(() => ({}));
console.log(`Testnutzer anlegen: HTTP ${create.status}${created?.id ? ` (${created.id})` : ''}`);
if (!created?.id) console.log(JSON.stringify(created).slice(0, 300));

const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await signIn.json().catch(() => ({}));
console.log(`Anmelden: HTTP ${signIn.status}, JWT: ${session?.access_token ? 'ok' : 'fehlt'}`);

if (session?.access_token) {
  const call = await fetch(`${url}/functions/v1/ai`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: 'Antworte nur mit JSON.', user: 'Gib {"ok":true} zurück.', temperature: 0 }),
  });
  const text = await call.text();
  console.log(`Funktion ai: HTTP ${call.status}`);
  console.log(text.slice(0, 600));
}

if (created?.id && !keep) {
  const del = await fetch(`${url}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: adminHeaders });
  console.log(`Testnutzer löschen: HTTP ${del.status}`);
} else if (keep) {
  console.log('Testnutzer behalten (--keep-user).');
}
