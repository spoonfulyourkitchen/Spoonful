#!/usr/bin/env node
/**
 * Spoonful — Recipe-Bot (2.1.4)
 * ---------------------------------------------------------------
 * Erzeugt für alle Länder (englische Namen A→Z, aus
 * mobile/src/lib/countries.ts) je 100 Rezepte im GLEICHEN Format wie die
 * bestehenden 1300: gleiche Spalten, gleiche Filterwerte (meal_type,
 * difficulty, dietary_restrictions), echtes Wikimedia-Commons-Bild.
 *
 * Länder, die in der Datenbank schon vollständig sind (>= --per-country
 * Rezepte), werden automatisch übersprungen — also die, die du schon
 * bestätigt hast.
 *
 * Beispiele:
 *   node bot.mjs --help
 *   node bot.mjs --verify                 # nur zeigen, was in der DB steht
 *   node bot.mjs --dry-run --countries=Italy   # 100 Rezepte bauen, nicht hochladen
 *   node bot.mjs --max-countries=3        # die nächsten 3 offenen Länder
 *   node bot.mjs                          # alle offenen Länder (dauert Stunden)
 *
 * Keys (NIE ins Repo):
 *   tools/recipe-bot/.env  →  SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const COUNTRIES_TS = path.join(ROOT, 'mobile', 'src', 'lib', 'countries.ts');
const STATE_FILE = path.join(HERE, 'state.json');
const OUT_DIR = path.join(HERE, 'out');
const LOG_DIR = path.join(HERE, 'logs');
const IMAGE_UTM = '?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled';

/* ── .env laden (einfacher Parser, kein Paket nötig) ──────────────────────── */
function loadEnv() {
  for (const file of [path.join(HERE, '.env'), path.join(ROOT, '.env.local')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]] && value) process.env[m[1]] = value;
    }
  }
}
loadEnv();

const CFG = {
  supabaseUrl: (process.env.SUPABASE_URL || 'https://gmfkleugoxafmvprqatk.supabase.co').replace(/\/$/, ''),
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  openRouterKey: process.env.OPENROUTER_API_KEY || '',
  model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
};

/** Erlaubte Filterwerte — exakt die, die im Bestand vorkommen. */
const MEAL_TYPES = ['breakfast', 'main', 'side', 'snack', 'dessert', 'drink'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIETS = ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'nut_free', 'halal', 'pescatarian', 'low_carb', 'high_protein'];

/* ── CLI ─────────────────────────────────────────────────────────────────── */
const args = new Map();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1], m[2] === undefined ? 'true' : m[2]);
}
const flag = (name) => args.has(name);
const opt = (name, fallback) => (args.has(name) ? args.get(name) : fallback);
const num = (name, fallback) => {
  const v = Number(opt(name, fallback));
  return Number.isFinite(v) ? v : fallback;
};

/** Rezept-Blockgröße: sinkt automatisch, wenn Antworten abgeschnitten werden. */
let batchOverride = 0;
function batchSizeNow() {
  return batchOverride || num('batch', 4);
}

if (flag('help')) {
  console.log(`Spoonful Recipe-Bot

  --verify                 nur DB-Report (kein Erzeugen)
  --audit                  Nachkontrolle: fehlende/doppelte Bilder, Feldprobleme (+CSV/JSON)
  --fix-images             fehlende Bilder über Commons nachtragen (mit --audit)
  --check-images           auch alle vorhandenen Bild-URLs prüfen (langsam)
  --country=X              nur ein Land (mit --audit)
  --progress               Fortschritts-Übersicht (mit --watch live aktualisieren)
  --check-keys             alle OpenRouter-Keys prüfen (gültig? Guthaben?)
  --countries=A,B          nur diese Länder (englische Namen, Komma-getrennt)
  --per-country=100        Rezepte je Land (Standard 100)
  --batch=8                Rezepte pro KI-Anfrage (sinkt automatisch bei Abschneiden)
  --model=<id>             nur ein Modell (Standard: die Gratis-Kette)
  --models=a,b,c           Modell-Kette selbst festlegen
  --inflight=6             so viele KI-Anfragen gleichzeitig (Rennen)
  --wave-ms=25000          alle X ms werden weitere Modelle nachgelegt
  --min-steps=6            Mindestzahl Schritte je Rezept (Standard 6)
  --max-rejects=8          ab so vielen schlechten Rezepten wird ein Modell zurückgestellt
  --paid-model=<id>        Notfall-Modell mit Guthaben (z. B. openai/gpt-4o-mini), nur wenn gratis nichts geht
  --quota-rounds=2         wie oft auf freies Gratis-Kontingent gewartet wird (dann Guthaben-Modell)
  --allow-tiny             auch die Mini-Modelle (lfm-2.5-2.6b, nano-omni) benutzen
  --max-tokens=16384       maximale Antwortlänge je KI-Anfrage (Reasoning-Modelle brauchen viel)
  --timeout-ms=240000      Timeout je KI-Anfrage
  --max-countries=3        nur die nächsten N offenen Länder
  --dry-run                erzeugen + prüfen, aber nichts hochladen (out/*.json)
  --no-images              keine Bildsuche (image_url = null)
  --no-audit               Auto-Nachkontrolle im Lauf abschalten
  --reasoning=off|on       Reasoning der Modelle (Standard off = viel schneller)
  --blocks=3               wie viele Rezept-Blöcke gleichzeitig laufen
  --overwrite              Land auch füllen, wenn es schon Rezepte hat
  --quiet                  weniger Konsolen-Ausgabe
`);
  process.exit(0);
}
const QUIET = flag('quiet');

/* ── Logging ─────────────────────────────────────────────────────────────── */
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `bot-${new Date().toISOString().slice(0, 10)}.log`);
function log(msg, level = 'info') {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  fs.appendFileSync(LOG_FILE, line + '\n');
  if (level === 'debug') return; // Detail-Kram nur ins Logfile
  if (QUIET && level === 'info') return;
  console.log(line);
}
/** Kompakte Fortschritts-Datei für `--progress` (und zum Anschauen im Editor). */
function writeStatus(patch) {
  const file = path.join(HERE, 'status.json');
  let current = {};
  try {
    if (fs.existsSync(file)) current = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* egal */
  }
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  try {
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
  } catch {
    /* egal */
  }
  return next;
}
function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(path.join(HERE, 'status.json'), 'utf8'));
  } catch {
    return {};
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
/** Führt tasks mit begrenzter Parallelität aus (Reihenfolge bleibt erhalten). */
async function pool(items, limit, worker) {
  const result = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      result[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return result;
}

/* ── Länderliste aus der App (single source of truth) ────────────────────── */
function readCountries() {
  const src = fs.readFileSync(COUNTRIES_TS, 'utf8');
  const list = [];
  const re = /\{\s*code:\s*'([A-Z]{2})'\s*,\s*name:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = re.exec(src))) list.push({ code: m[1], name: m[2] });
  if (!list.length) throw new Error(`Keine Länder in ${COUNTRIES_TS} gefunden`);
  return list;
}

/* ── Supabase REST ───────────────────────────────────────────────────────── */
const HEADERS = () => ({
  apikey: CFG.serviceKey,
  Authorization: `Bearer ${CFG.serviceKey}`,
  'Content-Type': 'application/json',
});

async function rest(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const url = `${CFG.supabaseUrl}/rest/v1/${pathAndQuery}`;
  const headers = HEADERS();
  if (prefer) headers.Prefer = prefer;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 429 || res.status >= 500) {
        const wait = attempt * 1500;
        log(`REST ${res.status} — neuer Versuch in ${wait} ms`, 'warn');
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`REST ${res.status} ${method} ${pathAndQuery}: ${text.slice(0, 300)}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(attempt * 1200);
    }
  }
  return null;
}

/** Alle vorhandenen IDs (für Eindeutigkeit + fortlaufende Nummer). */
async function fetchExistingIds() {
  const ids = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest(`recipes?select=id&order=id.asc&limit=1000&offset=${offset}`);
    if (!rows || !rows.length) break;
    ids.push(...rows.map((r) => r.id));
    if (rows.length < 1000) break;
  }
  return ids;
}

/** Länder, die in der DB schon Rezepte haben. */
async function fetchDbCounts() {
  const counts = new Map();
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest(`recipes?select=cuisine&limit=1000&offset=${offset}`);
    if (!rows || !rows.length) break;
    for (const r of rows) {
      const key = (r.cuisine || '').trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (rows.length < 1000) break;
  }
  return counts;
}

async function insertRecipes(rows) {
  return rest('recipes?on_conflict=id', {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

/* ── State (Wiederaufsetzen) ─────────────────────────────────────────────── */
function loadState(ids) {
  let state = { version: 1, nextSuffix: 0, done: {}, noImage: [] };
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
    } catch {
      log('state.json unlesbar — starte neu', 'warn');
    }
  }
  if (!state.nextSuffix) {
    const suffixes = ids.map((id) => Number((/-(\d+)$/.exec(id) || [])[1] || 0)).filter((n) => n > 0);
    state.nextSuffix = (suffixes.length ? Math.max(...suffixes) : 0) + 1;
  }
  return state;
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/* ── KI (OpenRouter) ─────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are the recipe data agent for the cooking app "Spoonful".
You produce the public recipe catalogue: authentic, everyday dishes of a country, written in English.

Every recipe you return must satisfy ALL of these rules:
- title: exactly the dish name you were given (English Wikipedia spelling)
- slug: kebab-case ASCII, no numbers, e.g. "lemon-garlic-chicken"
- description: English, 60-320 characters, 1-2 sentences: what the dish is, how it tastes, how much effort it needs
- ingredients: array of 5-20 strings, each "amount unit item" with a metric unit
  ("200 g flour", "2 tbsp olive oil", "3 cloves garlic", "1 can tomatoes"), never vague like "some salt"
- steps: array of 6-14 strings. EVERY step is a complete instruction of 40-400 characters that a
  beginner can follow without guessing. One clear action per step, in cooking order, and each step
  names the amount of the ingredient, the pan or pot, the heat level, the time and how to see that
  it is done. Example: "Fry 1 chopped onion in 2 tbsp olive oil over medium heat for 4 minutes until
  it turns translucent and smells sweet, stirring every minute."
  Start with the preparation (washing, peeling, chopping, preheating), then the cooking, then the
  finishing (resting, seasoning, plating, serving). Split long actions into separate steps instead of
  packing everything into one. No numbering, no "Step 1:", no emojis, no markdown.
- prep_time: integer minutes 0-240
- cook_time: integer minutes 0-600 (realistic, not rounded off)
- difficulty: exactly one of ${DIFFICULTIES.join(' | ')} and it must match the real work involved
- meal_type: exactly one of ${MEAL_TYPES.join(' | ')}
- calories, protein, carbs, fat: integers PER SERVING, calories 20-1200, macros plausible for the dish
- dietary_restrictions: array, only from ${DIETS.join(', ')}; must match the content
  (vegetarian/vegan must not contain meat, poultry, fish or seafood)
  (halal only when the country's cuisine is Muslim-majority and the dish has no pork and no alcohol)

Write in metric units (g, ml, °C), use plain English and vary your sentence openings. The reader
must understand what is happening and why, so never skip a step or a timing detail.

Return ONLY a JSON object of the shape {"recipes":[{...},{...}]} — no prose, no markdown.`;

const NAME_PROMPT = `You are the dish-name curator for a cooking app.
You list dishes that are TRULY typical for one country: dishes whose origin and everyday
tradition are that country. Never list dishes that belong to another country and never invent
fusion food. Use the names as they appear on English Wikipedia (local name, transliterated
if needed).

Prefer WELL-KNOWN dishes that are documented and photographed (Wikipedia articles, Wikimedia
Commons photos). Avoid very obscure regional specialties that nobody can look up, and never list
the same dish twice with a different spelling or a suffix like "with custard" or "style".

Return ONLY JSON:
{"dishes":[{"name":"<dish name>","slug":"<kebab-case>","meal_type":"<${MEAL_TYPES.join('|')}>"}]}
No prose, no markdown, no duplicate names, none of the names I ask you to avoid.`;

/* ── Modell-Rotation: Gratis-Modelle mit automatischem Wechsel ───────────── */
/** Alle gratis auf OpenRouter (Stand 12.09.2026).
 *  Reihenfolge nach Erfahrung: schnell + brauchbar zuerst, Mini-Modelle zuletzt
 *  (sie liefern zu kurze Schritte und fallen ohnehin durch die Prüfung). */
const FREE_MODELS = [
  'inclusionai/ling-3.0-flash-vl:free',
  'google/gemma-4-31b-it:free',
  'nex-agi/nex-n2.5-mini:free',
  'google/gemma-4-26b-a4b-it:free',
  'nex-agi/nex-n2.5-pro:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'liquid/lfm-2.5-2.6b:free',
];
const modelState = new Map(); // model -> { until, fails, calls }

/* ── OpenRouter-Keys: jeder Key hat sein eigenes Gratis-Kontingent ───────── */
function readKeys() {
  const keys = [];
  const add = (v) =>
    String(v || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 20)
      .forEach((k) => {
        if (!keys.includes(k)) keys.push(k);
      });
  add(process.env.OPENROUTER_API_KEYS);
  add(process.env.OPENROUTER_API_KEY);
  for (let i = 2; i <= 24; i++) add(process.env[`OPENROUTER_API_KEY_${i}`]);
  return keys;
}
const KEYS = readKeys();
/** Cooldown pro Modell UND Key — ein 429 trifft nur dieses Paar. */
const pairState = new Map();
const keyCursor = { i: 0 };
/** Qualitäts-Malus: Modelle, deren Rezepte die Prüfung nicht bestehen. */
const modelQuality = new Map();
/** Modelle, die grundsätzlich nicht dürfen (403 „only available …“). */
const disabledModels = new Set();
function noteRejects(model, count = 1) {
  if (!model) return;
  const q = modelQuality.get(model) || { rejects: 0 };
  q.rejects += count;
  modelQuality.set(model, q);
}

function pairStateOf(model, keyIndex) {
  const id = `${model}|${keyIndex}`;
  let st = pairState.get(id);
  if (!st) {
    st = { until: 0, fails: 0, calls: 0 };
    pairState.set(id, st);
  }
  return st;
}

/** Nächster Key, der für dieses Modell nicht im Cooldown ist (-1 = alle im Limit). */
function pickKey(model) {
  for (let n = 0; n < KEYS.length; n++) {
    const idx = (keyCursor.i + n) % KEYS.length;
    if (Date.now() >= pairStateOf(model, idx).until) {
      keyCursor.i = (idx + 1) % KEYS.length;
      return idx;
    }
  }
  return -1;
}

/** Zu kleine Modelle: schnell, aber sie liefern zu kurze Schritte bzw. schwache
 *  Gerichtslisten. Standardmäßig übersprungen; mit --allow-tiny wieder dabei. */
const TINY_MODELS = new Set(['liquid/lfm-2.5-2.6b:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free']);

/** Modelle sortieren: ohne Fehler zuerst, kaputte nach hinten, blockierte zuletzt. */
function candidateModels() {
  const allowTiny = flag('allow-tiny');
  const score = (model) => {
    let fails = 0;
    let blocked = 0;
    for (let i = 0; i < KEYS.length; i++) {
      const st = pairStateOf(model, i);
      fails += st.fails;
      if (Date.now() < st.until) blocked++;
    }
    const rejects = modelQuality.get(model)?.rejects || 0;
    const weight = fails + rejects * 2; // schlechte Rezepte zählen doppelt
    return { weight, blocked, rank: KEYS.length - blocked === 0 ? 2 : weight > 0 ? 1 : 0 };
  };
  return modelList()
    .filter((m) => !disabledModels.has(m) && (allowTiny || !TINY_MODELS.has(m)))
    .map((m, i) => ({ m, i, s: score(m) }))
    .sort((a, b) => a.s.rank - b.s.rank || a.s.weight - b.s.weight || a.i - b.i)
    .map((x) => x.m);
}

/** Reihenfolge der Modelle: --models=… > --model=… > OPENROUTER_MODEL > FREE_MODELS */
function modelList() {
  const explicit = String(opt('models', '')).split(',').map((s) => s.trim()).filter(Boolean);
  if (explicit.length) return explicit;
  const single = String(opt('model', '')).trim();
  if (single) return [single];
  const fromEnv = String(process.env.OPENROUTER_MODEL || '').trim();
  return fromEnv ? [fromEnv, ...FREE_MODELS.filter((m) => m !== fromEnv)] : FREE_MODELS;
}

/** JSON aus einer KI-Antwort holen — auch aus Code-Fences, Text oder Arrays. */
function jsonFrom(text) {
  const cleaned = String(text)
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* weiter mit der nächsten Klammerart */
    }
  }
  throw new Error('kein JSON gefunden');
}

/** Reasoning standardmäßig AUS: die Denkphase der Gratis-Modelle frisst sonst
 *  das Token-Budget und die Antworten werden abgeschnitten. --reasoning=on schaltet sie an. */
const REASONING_OFF = String(opt('reasoning', 'off')).toLowerCase() !== 'on';

/**
 * Eine einzelne Anfrage: ein Modell auf einem Key.
 * Bei 429 geht nur dieses Modell-Key-Paar in den Cooldown.
 */
async function callOnce(model, keyIndex, messages, temperature, controller) {
  const st = pairStateOf(model, keyIndex);
  const tag = `${model} [K${keyIndex + 1}]`;
  const send = (withReasoning) =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEYS[keyIndex]}`,
        'HTTP-Referer': 'https://spoonful.app',
        'X-Title': 'Spoonful Recipe Bot',
      },
      signal: controller.signal,
      // bewusst KEIN response_format: viele Gratis-Modelle unterstützen es nicht
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: num('max-tokens', 16384),
        ...(withReasoning && REASONING_OFF ? { reasoning: { enabled: false } } : {}),
        messages,
      }),
    });

  let res;
  try {
    res = await send(true);
    // Modell kennt den reasoning-Parameter nicht → einmal ohne versuchen
    if (res.status === 400 && REASONING_OFF) res = await send(false);
  } catch (e) {
    // Abbruch, weil ein anderes Modell gewonnen hat oder das Rennen vorbei ist
    // → zählt nicht als Fehler für dieses Modell
    if (controller.signal.aborted && e?.name === 'AbortError' && controller.signal.reason !== 'timeout') {
      return { ok: false, silent: true, reason: '' };
    }
    st.fails++;
    return { ok: false, reason: `${tag}: ${e?.name === 'TimeoutError' || controller.signal.reason === 'timeout' ? 'Timeout' : e?.message || 'Netzwerkfehler'}` };
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') || 0);
    st.fails++;
    // Gratis-Modelle haben vor allem ein Limit PRO MINUTE → klein anfangen und
    // bei Wiederholung wachsen (45 s, 90 s, 3 min, 6 min, 12 min, max 15 min).
    const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(15 * 60_000, Math.round(45_000 * Math.pow(2, Math.min(5, st.fails - 1))));
    st.until = Date.now() + wait;
    return { ok: false, reason: `${tag}: 429 — Pause ${wait >= 60_000 ? Math.round(wait / 60_000) + ' min' : Math.round(wait / 1000) + ' s'}` };
  }
  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    st.fails++;
    if (/only available|not available|requires/i.test(text)) disabledModels.add(model);
    return { ok: false, reason: `${tag}: HTTP 403 ${text.slice(0, 70)}` };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    st.fails++;
    return { ok: false, reason: `${tag}: HTTP ${res.status} ${text.slice(0, 80)}` };
  }
  const data = await res.json().catch(() => null);
  const choice = data?.choices?.[0] ?? {};
  const apiError = data?.error?.message;
  const text = String(choice?.message?.content || choice?.message?.reasoning || '');
  st.calls++;
  if (!text.trim()) {
    st.fails++;
    return { ok: false, reason: `${tag}: ${apiError ? String(apiError).slice(0, 80) : `leere Antwort (finish=${choice?.finish_reason || '?'})`}` };
  }
  return { ok: true, text, model, keyIndex, finish: choice?.finish_reason };
}

/**
 * Paralleles Rennen: `--parallel` Modelle (auf verschiedenen Keys) starten
 * gleichzeitig, der erste brauchbare JSON-Antwort gewinnt, der Rest wird
 * abgebrochen. Nächste Welle = nächste Modelle.
 */
/**
 * Kontinuierliches Rennen: es sind immer bis zu `--inflight` Anfragen
 * gleichzeitig unterwegs (verschiedene Modelle, verschiedene Keys). Der erste
 * brauchbare JSON-Antwort gewinnt, alles andere wird sofort abgebrochen; alle
 * `--wave-ms` wird nachgelegt. So gibt es keine Wartezeit mehr — auch nicht auf
 * langsame Modelle.
 */
/** Bezahltes Notfall-Modell (nur wenn die Gratis-Modelle im Limit sind). */
const PAID_MODEL = String(opt('paid-model', process.env.OPENROUTER_PAID_MODEL || '')).trim();

/** Kleinste Restzeit, bis irgendein Modell-Key-Paar wieder frei ist (0 = sofort frei). */
function minCooldownMs() {
  let min = Infinity;
  for (const model of candidateModels()) {
    for (let i = 0; i < KEYS.length; i++) {
      const until = pairState.get(`${model}|${i}`)?.until || 0;
      const rest = until - Date.now();
      if (rest <= 0) return 0;
      if (rest < min) min = rest;
    }
  }
  return Number.isFinite(min) ? min : 0;
}

/** Ein Durchlauf über die Modellliste (das eigentliche Rennen). */
async function askModelOnce(messages, temperature, validate) {
  const maxInflight = Math.max(1, num('inflight', 12));
  const topUpMs = Math.max(3000, num('wave-ms', 8000));
  const timeoutMs = num('timeout-ms', 240000);
  const maxRejects = num('max-rejects', 8);
  const allModels = candidateModels();
  const freshModels = allModels.filter((m) => (modelQuality.get(m)?.rejects || 0) < maxRejects);
  // Wenn die "guten" Modelle alle auffällig waren, nehmen wir trotzdem alle —
  // lieber ein schwaches Rezept als ein übersprungenes Land.
  const models = freshModels.length ? freshModels : allModels;
  if (!models.length) throw new Error('keine Modelle mehr verfügbar');
  const errors = [];
  const controllers = new Set();
  let next = 0;
  let inflight = 0;
  let done = false;
  let pending = 0;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearInterval(timer);
      for (const c of controllers) {
        try {
          c.abort('done');
        } catch {
          /* schon beendet */
        }
      }
      controllers.clear();
    };
    const win = (result) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };
    const fail = () => {
      if (done || inflight > 0 || next < models.length) return;
      done = true;
      cleanup();
      reject(new Error(errors.slice(-3).join(' | ')));
    };
    const handle = (r) => {
      if (done) return;
      if (r.ok) {
        let json = null;
        try {
          json = jsonFrom(r.text);
        } catch {
          const why = r.finish === 'length' ? 'abgeschnitten' : 'kein JSON';
          errors.push(`${r.model}: ${why}`);
          log(`  ✗ ${r.model.split('/').pop()}: ${why}`, 'debug');
        }
        if (json && (!validate || validate(json))) {
          win({ json, model: r.model, keyIndex: r.keyIndex, truncated: r.finish === 'length' });
          return;
        }
        if (json) {
          errors.push(`${r.model}: falsches Format`);
          log(`  ✗ ${r.model.split('/').pop()}: falsches Format`, 'debug');
        }
      } else if (!r.silent && r.reason) {
        errors.push(r.reason);
        log(`  ✗ ${r.reason}`, 'debug');
      }
      fail();
    };
    const pump = () => {
      if (done) return;
      while (inflight < maxInflight && next < models.length) {
        const model = models[next++];
        const keyIndex = pickKey(model);
        if (keyIndex < 0) {
          errors.push(`${model}: alle Keys im Limit`);
          continue;
        }
        const controller = new AbortController();
        const timer2 = setTimeout(() => controller.abort('timeout'), timeoutMs);
        controllers.add(controller);
        inflight++;
        pending++;
        if (!QUIET) log(`  → ${model.split(':')[0].split('/').pop()} [K${keyIndex + 1}]`, 'debug');
        callOnce(model, keyIndex, messages, temperature, controller)
          .then((r) => {
            clearTimeout(timer2);
            controllers.delete(controller);
            inflight--;
            pending--;
            handle(r);
          })
          .catch((e) => {
            clearTimeout(timer2);
            controllers.delete(controller);
            inflight--;
            pending--;
            errors.push(`${model}: ${e?.message || 'Fehler'}`);
            handle({ ok: false, silent: true, reason: '' });
          });
      }
      fail();
    };
    const timer = setInterval(pump, topUpMs);
    pump();
  });
}

/**
 * Rennen mit Geduld: sind alle Gratis-Modelle im Limit, wird gewartet (das Kontingent
 * ist pro Konto, nicht pro Key). Erst wenn das mehrfach nicht hilft, kommt das
 * bezahlte Notfall-Modell (OPENROUTER_PAID_MODEL / --paid-model).
 */
async function askModel(messages, temperature, validate) {
  const rounds = Math.max(1, num('quota-rounds', 2));
  let lastError = null;
  for (let round = 1; round <= rounds; round++) {
    try {
      return await askModelOnce(messages, temperature, validate);
    } catch (e) {
      lastError = e;
      const wait = minCooldownMs();
      // Wenn ein Paar frei ist, aber trotzdem nichts Brauchbares kam, hilft Warten nicht
      if (!wait) break;
      const sleepMs = Math.min(wait + 1500, num('quota-wait-max', 45000));
      log(`  Gratis-Kontingent erschöpft — warte ${Math.round(sleepMs / 1000)} s (${round}/${rounds})`, 'info');
      await sleep(sleepMs);
    }
  }
  if (PAID_MODEL) {
    log(`  Fallback auf bezahltes Modell: ${PAID_MODEL}`, 'warn');
    for (let i = 0; i < KEYS.length; i++) {
      const controller = new AbortController();
      const r = await callOnce(PAID_MODEL, i, messages, temperature, controller);
      if (r.ok) {
        try {
          const json = jsonFrom(r.text);
          if (!validate || validate(json)) return { json, model: PAID_MODEL, keyIndex: i, truncated: r.finish === 'length' };
        } catch {
          /* unlesbar → nächster Key */
        }
      }
      if (r.reason) log(`  ${r.reason}`, 'debug');
    }
  }
  throw lastError || new Error('kein Modell verfügbar');
}


/** Phase 1: authentische Gerichtsnamen für ein Land. */
async function askDishNames(country, count, avoid) {
  const user = `Country: ${country}
List exactly ${count} dishes whose origin and tradition are ${country} (nothing from other countries).
Prefer dishes that are really cooked at home. Spread the meal types: most main, plus side,
breakfast, snack, dessert and drink.
${avoid.length ? `Never use any of these names: ${avoid.slice(0, 220).join('; ')}` : ''}
Return exactly ${count} entries in the JSON object described in the system prompt.`;
  const messages = [
    { role: 'system', content: NAME_PROMPT },
    { role: 'user', content: user },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { json, model } = await askModel(messages, 0.6, (j) => Array.isArray(j?.dishes) && j.dishes.length > 0);
    const list = Array.isArray(json) ? json : json?.dishes;
    const names = (list || [])
      .map((d) => ({ name: String(d?.name ?? '').trim(), slug: String(d?.slug ?? '').trim(), meal_type: String(d?.meal_type ?? '').trim() }))
      .filter((d) => d.name.length > 2);
    if (names.length) return { names: names.slice(0, count), model };
    log(`  ${model}: keine brauchbaren Gerichtsnamen — neuer Versuch`, 'warn');
  }
  throw new Error(`kein Modell lieferte für ${country} Gerichtsnamen`);
}

/** Phase 2: vollständige Rezepte für genau diese Gerichte. */
async function askLLM(country, names) {
  const user = `Country: ${country}
Write one complete recipe for each of these ${names.length} ${country} dishes:
${names.map((n, i) => `${i + 1}. ${n.name}${n.meal_type ? ` (meal_type: ${n.meal_type})` : ''}`).join('\n')}
The title must be exactly the dish name above, one recipe per dish.
Every recipe needs the full 6-14 steps described in the system prompt, each step with amount, heat
level, time and the sign that it is done.
Return exactly ${names.length} entries in the JSON object described in the system prompt.`;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];

    const { json, model } = await askModel(messages, 0.8, (j) => Array.isArray(j?.recipes) && j.recipes.length > 0);
    const list = Array.isArray(json) ? json : json?.recipes;
    if (Array.isArray(list) && list.length) return { list, model };
  throw new Error(`kein Modell lieferte für ${country} Rezepte`);
}

/* ── Bilder: Wikimedia Commons (wie im Bestand) ──────────────────────────── */
const COMMONS_UA = 'SpoonfulRecipeBot/2.1.4 (https://github.com/spoonfulyourkitchen/Spoonful)';
const usedImages = new Set();
/** Zählt Bilder, die nicht gerichtsspezifisch sind (Land/Küche als Ersatz). */
let placeholderCount = 0;

async function commonsSearch(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: '8',
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1280',
    origin: '*',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': COMMONS_UA } }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => null);
  const pages = data?.query?.pages ?? {};
  return Object.values(pages)
    .map((p) => {
      const info = p.imageinfo?.[0] ?? {};
      const link = info.thumburl || info.url;
      return link ? { title: String(p.title || ''), mime: String(info.mime || ''), url: link.replace(/^http:/, 'https:') } : null;
    })
    .filter(Boolean);
}

/** Prüft, ob die URL wirklich ein Bild ist (HTTP 200 + image/*). */
async function imageIsReachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': COMMONS_UA } });
    const type = String(res.headers.get('content-type') || '');
    return res.ok && type.startsWith('image/');
  } catch {
    return false;
  }
}

const stopWords = new Set(['the', 'and', 'with', 'of', 'a', 'an', 'in', 'style', 'salad', 'soup', 'cake']);
function wordsOf(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/** Bild über die Wikipedia-Artikelsuche (Fallback, wenn Commons nichts hat). */
async function wikipediaImage(dish, lang) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  const params = {
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: dish,
    gsrlimit: '3',
    prop: 'pageimages',
    piprop: 'thumbnail|original',
    pithumbsize: '1280',
    origin: '*',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': COMMONS_UA } }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => null);
  const pages = Object.values(data?.query?.pages ?? {});
  const out = [];
  for (const p of pages) {
    const link = p?.thumbnail?.source || p?.original?.source;
    if (link) out.push({ title: String(p.title || ''), url: String(link).replace(/^http:/, 'https:').split('?')[0] });
  }
  return out;
}

/**
 * Sucht ein echtes Bild zum Gericht; nimmt bevorzugt Treffer, deren Dateiname
 * die wichtigsten Wörter des Gerichts enthält. Doppelte Bilder werden vermieden.
 * Fallback: Artikelbild der Wikipedia (englisch, dann deutsch).
 */
async function findImage(dish, country) {
  const dishWords = wordsOf(dish);
  const queries = [dish, `${dish} ${country}`, `${dish} dish food`];
  const candidates = [];
  for (const q of queries) {
    const found = await commonsSearch(q);
    candidates.push(...found);
    if (candidates.length >= 8) break;
    await sleep(120);
  }
  const scored = candidates
    .map((c) => {
      const fileWords = wordsOf(c.title.replace(/^File:/i, ''));
      const hits = dishWords.filter((w) => fileWords.includes(w)).length;
      return { ...c, hits, score: hits / Math.max(1, dishWords.length) };
    })
    .filter((c) => c.mime.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(c.url))
    .sort((a, b) => b.hits - a.hits || a.title.length - b.title.length);

  for (const c of scored.slice(0, 4)) {
    if (usedImages.has(c.url)) continue;
    if (c.hits === 0 && dishWords.length > 1) continue; // nur thematisch passende Bilder
    if (await imageIsReachable(c.url)) {
      const clean = String(c.url).split('?')[0];
      usedImages.add(clean);
      // Commons hängt eigene utm-Parameter an → durch unseren Standard-Anhang ersetzen
      return clean + IMAGE_UTM;
    }
  }

  // Fallback Stufe 2: bestes Wikipedia-Suchergebnis, auch wenn der Titel nicht passt
  for (const lang of ['en', 'de']) {
    const found = await wikipediaImage(dish, lang).catch(() => []);
    for (const c of found) {
      if (usedImages.has(c.url)) continue;
      if (await imageIsReachable(c.url)) {
        usedImages.add(c.url);
        placeholderCount++;
        return c.url + IMAGE_UTM;
      }
    }
    await sleep(120);
  }

  // Fallback Stufe 3: Bild des Küchen-/Länderartikels (z. B. „Austrian cuisine")
  if (country) {
    for (const query of [`${country} cuisine`, country]) {
      for (const lang of ['en', 'de']) {
        const found = await wikipediaImage(query, lang).catch(() => []);
        for (const c of found) {
          if (usedImages.has(c.url)) continue;
          if (await imageIsReachable(c.url)) {
            usedImages.add(c.url);
            placeholderCount++;
            log(`  Ersatzbild (${query}) für: ${dish}`, 'debug');
            return c.url + IMAGE_UTM;
          }
        }
      }
    }
  }

  // Fallback Stufe 4: Küchenfotos des Landes über Commons (möglichst verschiedene)
  if (country) {
    for (const query of [`${country} cuisine`, `${country} food`, `${country} dish`]) {
      for (const c of await commonsSearch(query)) {
        const clean = String(c.url).split('?')[0];
        if (usedImages.has(clean)) continue;
        if (await imageIsReachable(clean)) {
          usedImages.add(clean);
          placeholderCount++;
          log(`  Ersatzbild (Commons: ${query}) für: ${dish}`, 'debug');
          return clean + IMAGE_UTM;
        }
      }
    }
  }
  return null;
}

/* ── Prüfung + Umwandlung in das DB-Format ───────────────────────────────── */
const MEAT_WORDS = /\b(beef|pork|chicken|lamb|mutton|veal|turkey|duck|goat|bacon|ham|sausage|salami|prosciutto|fish|salmon|tuna|cod|trout|shrimp|prawn|squid|octopus|anchovy|anchovies|lard|gelatine|gelatin)\b/i;

function problemsOf(r) {
  const p = [];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  if (!str(r.slug) && !str(r.title)) p.push('slug/title fehlt');
  if (!Array.isArray(r.ingredients) || r.ingredients.length < 5 || r.ingredients.length > 20) p.push('ingredients 5-20');
  const minSteps = Math.max(3, num('min-steps', 6));
  if (!Array.isArray(r.steps) || r.steps.length < minSteps || r.steps.length > 14) p.push(`steps ${minSteps}-14`);
  const title = str(r.title);
  if (title.length < 3 || title.length > 80) p.push('title Länge');
  const desc = str(r.description);
  if (desc.length < 50 || desc.length > 340) p.push(`description Länge (${desc.length})`);
  if (!DIFFICULTIES.includes(str(r.difficulty))) p.push('difficulty');
  if (!MEAL_TYPES.includes(str(r.meal_type))) p.push('meal_type');
  const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
  const kcal = int(r.calories);
  if (!(kcal >= 20 && kcal <= 1200)) p.push('calories');
  for (const k of ['protein', 'carbs', 'fat']) {
    const v = int(r[k]);
    if (!(v >= 0 && v <= 150)) p.push(k);
  }
  const prep = int(r.prep_time);
  const cook = int(r.cook_time);
  if (!(prep >= 0 && prep <= 240)) p.push('prep_time');
  if (!(cook >= 0 && cook <= 600)) p.push('cook_time');
  if (Array.isArray(r.dietary_restrictions) && r.dietary_restrictions.some((d) => !DIETS.includes(String(d)))) p.push('dietary_restrictions unbekannt');
  if (Array.isArray(r.ingredients)) {
    const bad = r.ingredients.filter((i) => typeof i !== 'string' || i.trim().length < 3);
    if (bad.length) p.push('ingredients Strings');
    // höchstens eine Zutat ohne Menge ("salt to taste")
    // Gewürze/Zubehör zählen dabei nicht als vollwertige Zutat
    const SEASONING = /\b(salt|pepper|water|to taste|garnish|optional|as needed|seasoning|for serving|for frying)\b/i;
    const withoutAmount = r.ingredients.filter(
      (i) => typeof i === 'string' && !/\d|½|¼|¾/.test(i) && !SEASONING.test(i),
    );
    if (withoutAmount.length > 1) p.push('ingredients ohne Menge');
  }
  if (Array.isArray(r.steps)) {
    // jeder Schritt muss eine echte Anleitung sein: 40-420 Zeichen, keine Nummerierung
    const bad = r.steps.filter((s) => typeof s !== 'string' || s.trim().length < 40 || s.trim().length > 420 || /^(step\s*\d|\d+[.)]\s)/i.test(s.trim()));
    if (bad.length) p.push('steps zu kurz/nummeriert');
  }
  const diets = Array.isArray(r.dietary_restrictions) ? r.dietary_restrictions.map(String) : [];
  if (diets.includes('vegan') || diets.includes('vegetarian')) {
    const text = [...(r.ingredients || []), ...(r.steps || [])].join(' ');
    if (MEAT_WORDS.test(text)) p.push('vegetarisch, aber Fleisch/Fisch im Text');
  }
  const macroKcal = 4 * int(r.protein) + 4 * int(r.carbs) + 9 * int(r.fat);
  if (Number.isFinite(macroKcal) && Number.isFinite(kcal) && kcal > 0) {
    const ratio = macroKcal / kcal;
    if (ratio < 0.6 || ratio > 1.5) p.push(`Makros passen nicht zu kcal (${Math.round(ratio * 100)}%)`);
  }
  return p;
}

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

/** Titel ohne Füllwörter — für die Dubletten-Erkennung ("Bint al-Sittah custard"). */
const FILLER = new Set(['with', 'and', 'style', 'custard', 'sauce', 'classic', 'traditional', 'homemade', 'fresh', 'version', 'the', 'a', 'an', 'of', 'in', 'on', 'mit', 'und']);
function titleKey(text) {
  return wordsOf(text)
    .filter((w) => !FILLER.has(w))
    .join(' ');
}

function toRow(r, country, suffix) {
  const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const slug = slugify(r.slug || r.title);
  return {
    id: `${slug}-${String(suffix).padStart(4, '0')}`,
    title: String(r.title).trim().slice(0, 80),
    description: String(r.description).trim(),
    ingredients: r.ingredients.map((i) => String(i).trim()),
    steps: r.steps.map((s) => String(s).trim()),
    prep_time: num(r.prep_time, 240),
    cook_time: num(r.cook_time, 600),
    cuisine: country,
    dietary_restrictions: (r.dietary_restrictions || []).map(String).filter((d) => DIETS.includes(d)),
    difficulty: String(r.difficulty),
    calories: num(r.calories, 1200),
    protein: num(r.protein, 150),
    carbs: num(r.carbs, 150),
    fat: num(r.fat, 150),
    meal_type: String(r.meal_type),
  };
}

/* ── Rezepte für ein Land erzeugen ───────────────────────────────────────── */
function nextId(slug, state, existingIds) {
  let suffix = state.nextSuffix;
  let id = `${slug}-${String(suffix).padStart(4, '0')}`;
  while (existingIds.has(id)) {
    suffix++;
    id = `${slug}-${String(suffix).padStart(4, '0')}`;
  }
  state.nextSuffix = suffix + 1;
  existingIds.add(id);
  return { id, suffix };
}

async function buildForCountry(countryName, perCountry, state, existingIds, knownTitles) {
  const rows = [];
  const rejected = [];
  if (!knownTitles.length) {
    // vorhandene Titel dieses Landes gegen Duplikate laden
    const existing = await rest(`recipes?select=title&cuisine=eq.${encodeURIComponent(countryName)}&limit=1000`);
    knownTitles = (existing || []).map((r) => String(r.title || ''));
  }
  const titles = new Set(knownTitles.map((t) => String(t).toLowerCase()));
  /** Titel, die schon als Rezept existieren (DB + bereits gebaute) — nur dagegen prüfen. */
  const accepted = new Set(titles);
  /** Normalisierte Titel (ohne Füllwörter) gegen Fast-Dubletten. */
  const acceptedKeys = new Set([...titles].map(titleKey));
  const batchSize = batchSizeNow();

  /* Phase 1 — Gerichtsnamen sammeln (authentisch für dieses Land) */
  const wanted = [];
  let nameRounds = 0;
  while (wanted.length < perCountry && nameRounds < 8) {
    nameRounds++;
    const need = Math.min(50, perCountry - wanted.length);
    const avoid = [...titles, ...wanted.map((w) => w.name)];
    let names = [];
    let usedModel = '';
    try {
      const res = await askDishNames(countryName, need, avoid);
      names = res.names;
      usedModel = res.model;
    } catch (e) {
      log(`  ${countryName}: ${e.message}`, 'warn');
      break;
    }
    for (const n of names) {
      const key = n.name.toLowerCase();
      if (titles.has(key) || wanted.some((w) => w.name.toLowerCase() === key)) continue;
      titles.add(key);
      wanted.push(n);
      if (wanted.length >= perCountry) break;
    }
    if (wanted.length >= perCountry) log(`  ${countryName}: ${wanted.length}/${perCountry} Gerichte gesammelt`);
    writeStatus({ country: countryName, namesDone: wanted.length, namesTotal: perCountry });
    await sleep(200);
  }
  if (!wanted.length) return { rows, rejected };

  /* Phase 2 — Rezepte schreiben (in Blöcken, Fehlversuche werden wiederholt) */
  let queue = [...wanted];
  let round = 0;
  while (queue.length && round < 20) {
    round++;
    const retry = [];
    // mehrere Blöcke GLEICHZEITIG (jeder Block rennt intern über mehrere Modelle)
    await pool(chunk(queue, batchSize), Math.max(1, num('blocks', 3)), async (part) => {
      let list = [];
      let usedModel = '';
      try {
        const res = await askLLM(countryName, part);
        list = res.list;
        usedModel = res.model;
      } catch (e) {
        if (/abgeschnitten/.test(e.message)) {
          batchOverride = Math.max(3, batchSizeNow() - 1);
          log(`  ${countryName}: Antwort abgeschnitten → Blockgröße jetzt ${batchOverride}`, 'warn');
        }
        retry.push(...part);
        return;
      }
      const asked = new Map(part.map((n) => [slugify(n.name), n]));
      for (const r of list) {
        if (rows.length >= perCountry) break;
        const slug = slugify(r.slug || r.title);
        const title = String(r.title || '').trim();
        if (!asked.has(slug)) {
          rejected.push({ title, problems: ['Titel gehört nicht zur vorgegebenen Liste'] });
          noteRejects(usedModel);
          log(`  verworfen: "${title}" (${slug}) — Titel passt nicht zur Namensliste`, 'debug');
          continue;
        }
        if (accepted.has(title.toLowerCase())) {
          rejected.push({ title, problems: ['Titel schon vorhanden'] });
          noteRejects(usedModel);
          retry.push(asked.get(slug));
          continue;
        }
        const key = titleKey(title);
        if (acceptedKeys.has(key)) {
          rejected.push({ title, problems: ['ähnlicher Titel schon vorhanden'] });
          noteRejects(usedModel);
          retry.push(asked.get(slug));
          continue;
        }
        const problems = problemsOf(r);
        if (problems.length) {
          rejected.push({ title, problems });
          noteRejects(usedModel);
          log(`  verworfen: "${title}" — ${problems.join(', ')}`, 'debug');
          retry.push(asked.get(slug));
          continue;
        }
        const { id, suffix } = nextId(slug, state, existingIds);
        rows.push({ ...toRow(r, countryName, suffix), id });
        accepted.add(title.toLowerCase());
        acceptedKeys.add(key);
        asked.delete(slug);
      }
      retry.push(...asked.values());
      saveState(state);
      // Zwischenstand sichern: ein Absturz oder Standby verliert so kein ganzes Land
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, `${slugify(countryName)}.partial.json`), JSON.stringify(rows, null, 2));
      writeStatus({ country: countryName, written: rows.length });
      log(`  ${countryName}: ${rows.length}/${perCountry} Rezepte${rejected.length ? ` (${rejected.length} verworfen)` : ''}`);
    });
    queue = retry.slice(0, 20);
  }
  return { rows, rejected };
}

/* ── Bilder anhängen ─────────────────────────────────────────────────────── */
async function attachImages(rows, country, state) {
  let without = 0;
  await pool(rows, 4, async (row) => {
    const url = await findImage(row.title, country).catch(() => null);
    row.image_url = url || null;
    if (!url) {
      without++;
      if (!state.noImage.includes(row.id)) state.noImage.push(row.id);
      log(`  kein Bild: ${row.title} (${row.id})`, 'warn');
    }
  });
  saveState(state);
  return without;
}

/* ── Hochladen ───────────────────────────────────────────────────────────── */
async function pushRows(rows, country) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${slugify(country)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  const partial = path.join(OUT_DIR, `${slugify(country)}.partial.json`);
  if (fs.existsSync(partial)) fs.unlinkSync(partial);
  if (flag('dry-run')) {
    log(`  dry-run: ${rows.length} Rezepte in ${path.relative(ROOT, outFile)} geschrieben (nicht hochgeladen)`);
    return rows.length;
  }
  let written = 0;
  for (const part of chunk(rows, 50)) {
    try {
      await insertRecipes(part);
      written += part.length;
    } catch (e) {
      log(`  Batch-Upload fehlgeschlagen (${country}): ${e.message}`, 'warn');
      // Einzelfall-Rettung: nur die guten Zeilen behalten
      for (const row of part) {
        try {
          await insertRecipes([row]);
          written++;
        } catch (err) {
          log(`  verworfen ${row.id}: ${err.message}`, 'warn');
        }
      }
    }
  }
  return written;
}

/* ── Report ──────────────────────────────────────────────────────────────── */
function printCountryReport(countries, dbCounts, perCountry) {
  const done = [];
  const open = [];
  for (const c of countries) {
    const n = dbCounts.get(c.name) || 0;
    (n >= perCountry ? done : open).push({ ...c, n });
  }
  console.log(`\nFertig (>= ${perCountry}): ${done.length} Länder`);
  console.log(done.map((c) => `  ${c.name} (${c.n})`).join('\n') || '  —');
  console.log(`\nOffen: ${open.length} Länder`);
  const missing = [...dbCounts.keys()].filter((name) => !countries.some((c) => c.name === name));
  if (missing.length) console.log(`\nIn der DB, aber nicht in countries.ts: ${missing.join(', ')}`);
  console.log('');
}

/* ── Key-Check (--check-keys) ────────────────────────────────────────────── */
async function checkKeys() {
  if (!KEYS.length) {
    console.log('Keine OpenRouter-Keys gefunden (tools/recipe-bot/.env).');
    return;
  }
  console.log(`\nPrüfe ${KEYS.length} OpenRouter-Keys …\n`);
  console.log('   #  Key      Status   Guthaben/Limit');
  let valid = 0;
  let paid = 0;
  for (let i = 0; i < KEYS.length; i++) {
    const short = `…${KEYS[i].slice(-4)}`;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${KEYS[i]}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.log(`  ${String(i + 1).padStart(2)}  ${short}  FEHLER ${res.status} ${String(body?.error?.message ?? '').slice(0, 60)}`);
        continue;
      }
      const d = body?.data ?? {};
      const freeTier = d.is_free_tier === true;
      if (!freeTier) paid++;
      valid++;
      const limit = d.limit === null || d.limit === undefined ? 'unbegrenzt' : String(d.limit);
      const usage = d.usage === null || d.usage === undefined ? '0' : String(Math.round(Number(d.usage)));
      console.log(`  ${String(i + 1).padStart(2)}  ${short}  ok       Limit ${limit.padEnd(10)} benutzt ${usage.padEnd(9)} ${freeTier ? 'Free-Tier (50/Tag)' : 'mit Guthaben (1000/Tag)'}`);
    } catch (e) {
      console.log(`  ${String(i + 1).padStart(2)}  ${short}  Fehler: ${e?.message || 'unbekannt'}`);
    }
    await sleep(120);
  }
  console.log(`\n  ${valid}/${KEYS.length} Keys gültig, davon ${paid} mit Guthaben (höheres Gratis-Limit).\n`);
}

/* ── Fortschritt (--progress) ────────────────────────────────────────────── */
async function showProgress() {
  const perCountry = num('per-country', 100);
  const countries = readCountries();
  const db = await fetchDbCounts();
  const total = [...db.values()].reduce((a, b) => a + b, 0);
  const done = countries.filter((c) => (db.get(c.name) || 0) >= perCountry);
  const partial = countries.filter((c) => {
    const n = db.get(c.name) || 0;
    return n > 0 && n < perCountry;
  });
  const open = countries.filter((c) => (db.get(c.name) || 0) === 0);
  const st = readStatus();
  const rule = '─'.repeat(60);
  const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–');
  const ago = (iso) => {
    if (!iso) return '–';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!Number.isFinite(s)) return '–';
    return s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`;
  };

  console.log(`\n  Spoonful Rezept-Bot — Fortschritt`);
  console.log(`  ${rule}`);
  console.log(`  In der Datenbank:    ${total} Rezepte`);
  console.log(`  Fertige Länder:      ${done.length} von ${countries.length}   (Ziel: ${perCountry} je Land)`);
  console.log(`  Angefangen:          ${partial.length ? partial.map((c) => `${c.name} (${db.get(c.name)})`).join(', ') : '–'}`);
  console.log(`  Noch offen:          ${open.length} Länder`);
  console.log(`  ${rule}`);
  if (st.country) {
    const written = st.written || 0;
    const need = st.need || perCountry;
    const started = st.countryStartedAt ? new Date(st.countryStartedAt).getTime() : 0;
    const mins = started ? Math.max(0.3, (Date.now() - started) / 60000) : 0;
    const rate = mins && written ? written / mins : 0;
    const rest = rate > 0 ? Math.round((need - written) / rate) : 0;
    console.log(`  Aktuell:             ${st.country}`);
    console.log(`                       Gerichte ${st.namesDone ?? '?'}/${st.namesTotal ?? need}  ·  Rezepte ${written}/${need}`);
    if (rate > 0) console.log(`                       ${rate.toFixed(1)} Rezepte/Min ab Start${rest > 0 ? `  ·  noch ca. ${rest >= 60 ? Math.round(rest / 60) + ' h' : rest + ' min'}` : ''}`);
    console.log(`                       seit ${hhmm(st.countryStartedAt)}  ·  letzte Meldung vor ${ago(st.updatedAt)}`);
  } else {
    console.log(`  Aktuell:             ${st.running === false ? 'gestoppt' : 'kein Lauf aktiv'}`);
  }
  if (st.lastDone) console.log(`  Zuletzt fertig:      ${st.lastDone.country} mit ${st.lastDone.count} Rezepten (${hhmm(st.lastDone.at)})`);
  const noImg = (st.noImage || []).length;
  if (noImg) console.log(`  Ohne Bild:           ${noImg} Rezepte (siehe state.json → noImage)`);
  console.log(`  ${rule}`);
  if (done.length) console.log('  Fertig: ' + done.map((c) => c.name).join(', ') + '\n');
  console.log(flag('watch') ? '  (aktualisiert alle 10 s — Strg+C beendet nur diese Anzeige)\n' : '');
}

async function progressLoop() {
  if (!flag('watch')) {
    await showProgress();
    return;
  }
  for (;;) {
    process.stdout.write('\u001Bc');
    await showProgress();
    await sleep(num('refresh', 10000));
  }
}

/* ── Hilfsfunktionen für die Nachkontrolle ───────────────────────────────── */
const RECIPE_COLS =
  'id,title,cuisine,image_url,description,ingredients,steps,prep_time,cook_time,difficulty,meal_type,calories,protein,carbs,fat,dietary_restrictions';

/** Rezepte laden (optional nur für bestimmte Länder). */
async function loadRecipes(names = []) {
  const filter = names.length ? `&cuisine=in.(${names.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})` : '';
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const part = await rest(`recipes?select=${RECIPE_COLS}${filter}&order=id.asc&limit=1000&offset=${offset}`);
    if (!part || !part.length) break;
    out.push(...part);
    if (part.length < 1000) break;
  }
  return out;
}

/** Sucht für alle Rezepte ohne Bild ein Commons-Bild und trägt es nach. */
async function fixMissingImages(rows) {
  let fixed = 0;
  let failed = 0;
  const placeholdersBefore = placeholderCount;
  await pool(rows, 4, async (r) => {
    const url = await findImage(String(r.title || ''), String(r.cuisine || '')).catch(() => null);
    if (!url) {
      failed++;
      log(`  kein Bild gefunden: ${r.title} (${r.id})`, 'warn');
      return;
    }
    try {
      await rest(`recipes?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { image_url: url }, prefer: 'return=minimal' });
      fixed++;
      log(`  + Bild ergänzt: ${r.title} (${r.id})`, 'debug');
    } catch (e) {
      failed++;
      log(`  ! Bild ${r.id}: ${e.message}`, 'warn');
    }
  });
  return { fixed, failed, placeholders: placeholderCount - placeholdersBefore };
}

/** Kompakter Report über eine Rezeptmenge. */
async function auditRows(rows, { fixImages = false, label = '', files = false } = {}) {
  const problems = new Map();
  const titles = new Map();
  const images = new Map();
  const urlGroups = new Map();
  const keySeen = new Map();
  for (const r of rows) {
    const list = problemsOf({ ...r, slug: r.id });
    if (!r.image_url) list.push('ohne Bild');
    const t = String(r.title || '').trim().toLowerCase();
    if (titles.has(t)) list.push('doppelter Titel');
    else titles.set(t, r.id);
    const k = titleKey(String(r.title || ''));
    if (keySeen.has(k)) list.push('ähnlicher Titel');
    else keySeen.set(k, r.id);
    if (r.image_url) {
      const clean = String(r.image_url).split('?')[0];
      if (images.has(clean)) list.push('doppelte Bild-URL');
      else images.set(clean, r.id);
      const group = urlGroups.get(clean) || [];
      group.push(r.id);
      urlGroups.set(clean, group);
    }
    if (list.length) problems.set(r.id, { row: r, list });
  }
  const dupeGroups = [...urlGroups.entries()].filter(([, ids]) => ids.length > 1);
  const dupeRecipes = dupeGroups.reduce((n, [, ids]) => n + ids.length, 0);
  const withoutImage = rows.filter((r) => !r.image_url);
  const reasons = new Map();
  for (const { list } of problems.values()) for (const why of list) reasons.set(why, (reasons.get(why) || 0) + 1);

  let fix = { fixed: 0, failed: 0 };
  if (fixImages && withoutImage.length) fix = await fixMissingImages(withoutImage);

  if (files) {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const jsonFile = path.join(OUT_DIR, `audit-${stamp}.json`);
    fs.writeFileSync(
      jsonFile,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          checked: rows.length,
          withoutImage: withoutImage.map((r) => ({ id: r.id, cuisine: r.cuisine, title: r.title })),
          duplicateImageUrls: dupeGroups.map(([url, ids]) => ({ url, count: ids.length, ids })),
          problems: [...problems.entries()].map(([id, v]) => ({ id, cuisine: v.row.cuisine, title: v.row.title, problems: v.list })),
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(OUT_DIR, `audit-${stamp}.csv`),
      'id,cuisine,title,probleme\n' +
        [...problems.entries()]
          .map(([id, v]) => `${id},"${v.row.cuisine}","${String(v.row.title).replace(/"/g, '""')}","${v.list.join('; ')}"`)
          .join('\n'),
    );
    log(`  Nachkontrolle-Datei: ${path.relative(ROOT, jsonFile)}`);
  }
  const tag = label ? `${label}: ` : '';
  log(
    `  ${tag}Nachkontrolle: ${rows.length} Rezepte · ${withoutImage.length} ohne Bild${fixImages ? ` (${fix.fixed} ergänzt, ${fix.failed} offen)` : ''} · ${problems.size} auffällig${
      reasons.size ? ` — ${[...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${n}× ${w}`).join(', ')}` : ''
    }`,
  );
  if (dupeGroups.length) {
    for (const [url, ids] of dupeGroups.sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
      log(`    ${ids.length}× ${url.split('/').pop()} → ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? ' …' : ''}`, 'debug');
    }
  }

  return { total: rows.length, noImg: withoutImage.length, bad: problems.size, ...fix };
}

/* ── Nachkontrolle (--audit) ─────────────────────────────────────────────── */
async function auditMode() {
  const perCountry = num('per-country', 100);
  const only = String(opt('country', '') || opt('countries', ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log('\n  Nachkontrolle: lade alle Rezepte …');
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const part = await rest(
      `recipes?select=id,title,cuisine,image_url,description,ingredients,steps,prep_time,cook_time,difficulty,meal_type,calories,protein,carbs,fat,dietary_restrictions&order=id.asc&limit=1000&offset=${offset}`,
    );
    if (!part || !part.length) break;
    all.push(...part);
    if (part.length < 1000) break;
  }
  const scope = only.length ? all.filter((r) => only.some((c) => c.toLowerCase() === String(r.cuisine || '').toLowerCase())) : all;
  console.log(`  Geprüft: ${scope.length} Rezepte${only.length ? ` (nur ${only.join(', ')})` : ''}\n`);

  const problems = new Map();
  const titles = new Map();
  const images = new Map();
  const urlGroups = new Map();
  for (const r of scope) {
    const list = problemsOf({ ...r, slug: r.id });
    if (!r.image_url) list.push('ohne Bild');
    const t = String(r.title || '').trim().toLowerCase();
    if (titles.has(t)) list.push('doppelter Titel');
    else titles.set(t, r.id);
    if (r.image_url) {
      const clean = String(r.image_url).split('?')[0];
      if (images.has(clean)) list.push('doppelte Bild-URL');
      else images.set(clean, r.id);
      const group = urlGroups.get(clean) || [];
      group.push(r.id);
      urlGroups.set(clean, group);
    }
    if (list.length) problems.set(r.id, { row: r, list });
  }

  if (flag('check-images')) {
    const withImage = scope.filter((r) => r.image_url);
    console.log(`  Prüfe ${withImage.length} Bild-URLs (kann dauern) …`);
    await pool(withImage, 8, async (r) => {
      const ok = await imageIsReachable(String(r.image_url).split('?')[0]);
      if (!ok) {
        const entry = problems.get(r.id) || { row: r, list: [] };
        entry.list.push('Bild nicht erreichbar');
        problems.set(r.id, entry);
      }
    });
    console.log('  Bild-Check fertig.\n');
  }

  const byCountry = new Map();
  for (const r of scope) {
    const key = String(r.cuisine || '?');
    const e = byCountry.get(key) || { total: 0, noImg: 0, bad: 0 };
    e.total++;
    if (!r.image_url) e.noImg++;
    if (problems.has(r.id)) e.bad++;
    byCountry.set(key, e);
  }
  const rowsSorted = [...byCountry.entries()].sort((a, b) => b[1].noImg - a[1].noImg || a[0].localeCompare(b[0]));
  console.log('  ' + 'Land'.padEnd(26) + 'gesamt'.padStart(8) + 'ohne Bild'.padStart(11) + 'auffällig'.padStart(11));
  console.log('  ' + '─'.repeat(56));
  for (const [name, e] of rowsSorted) {
    console.log('  ' + name.padEnd(26) + String(e.total).padStart(8) + String(e.noImg).padStart(11) + String(e.bad).padStart(11));
  }

  const reasons = new Map();
  for (const { list } of problems.values()) for (const why of list) reasons.set(why, (reasons.get(why) || 0) + 1);
  const withoutImage = scope.filter((r) => !r.image_url);
  console.log('  ' + '─'.repeat(56));
  console.log(`  GESAMT: ${scope.length} Rezepte · ${withoutImage.length} ohne Bild · ${problems.size} auffällig`);
  for (const [why, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}× ${why}`);
  const thin = [...byCountry.entries()].filter(([, e]) => e.total < perCountry);
  if (thin.length) console.log(`  Länder unter ${perCountry}: ${thin.map(([n, e]) => `${n} (${e.total})`).join(', ')}`);
  const dupeGroups = [...urlGroups.entries()].filter(([, ids]) => ids.length > 1);
  if (dupeGroups.length) {
    console.log(`  Doppelte Bild-URLs: ${dupeGroups.length} Gruppen (${dupeGroups.reduce((n, [, ids]) => n + ids.length, 0)} Rezepte)`);
    for (const [url, ids] of dupeGroups.sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
      console.log(`    ${String(ids.length).padStart(3)}× ${url.split('/').pop()}  →  ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ' …' : ''}`);
    }
  }


  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonFile = path.join(OUT_DIR, `audit-${stamp}.json`);
  const csvFile = path.join(OUT_DIR, `audit-${stamp}.csv`);
  const report = {
    generatedAt: new Date().toISOString(),
    checked: scope.length,
    withoutImage: withoutImage.map((r) => ({ id: r.id, cuisine: r.cuisine, title: r.title })),
    countries: [...byCountry.entries()].map(([name, e]) => ({ country: name, ...e })),
    problems: [...problems.entries()].map(([id, v]) => ({ id, cuisine: v.row.cuisine, title: v.row.title, problems: v.list })),
  };
  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    csvFile,
    'id,cuisine,title,probleme\n' +
      report.problems
        .map((p) => `${p.id},"${p.cuisine}","${String(p.title).replace(/"/g, '""')}","${p.problems.join('; ')}"`)
        .join('\n'),
  );
  console.log(`\n  Dateien: ${path.relative(ROOT, jsonFile)}\n           ${path.relative(ROOT, csvFile)}`);

  if (flag('fix-images')) {
    if (!withoutImage.length) {
      console.log('\n  Keine fehlenden Bilder — nichts zu tun.\n');
      return;
    }
    console.log(`\n  Trage Bilder nach für ${withoutImage.length} Rezepte …\n`);
    let fixed = 0;
    let failed = 0;
    await pool(withoutImage, 4, async (r) => {
      const url = await findImage(String(r.title || ''), String(r.cuisine || '')).catch(() => null);
      if (!url) {
        failed++;
        log(`  kein Bild gefunden: ${r.title} (${r.id})`, 'warn');
        return;
      }
      try {
        await rest(`recipes?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { image_url: url }, prefer: 'return=minimal' });
        fixed++;
        log(`  + Bild ergänzt: ${r.title} (${r.id})`, 'info');
      } catch (e) {
        failed++;
        log(`  ! ${r.id}: ${e.message}`, 'warn');
      }
    });
    console.log(`\n  Bilder ergänzt: ${fixed} · weiterhin ohne Bild: ${failed}`);
    console.log(`  (Dateien von VOR der Reparatur: ${path.relative(ROOT, jsonFile)})\n`);
  } else if (withoutImage.length) {
    console.log(`  Tipp: fehlende Bilder nachtragen mit  node bot.mjs --audit --fix-images\n`);
  } else {
    console.log('');
  }
}

/* ── Hauptlauf ───────────────────────────────────────────────────────────── */
async function main() {
  if (flag('audit')) {
    await auditMode();
    return;
  }
  if (flag('progress')) {
    await progressLoop();
    return;
  }
  if (flag('check-keys')) {
    await checkKeys();
    return;
  }
  if (!CFG.serviceKey) {
    console.error('Fehlt: SUPABASE_SERVICE_ROLE_KEY — lege tools/recipe-bot/.env an (siehe .env.example).');
    process.exit(1);
  }
  const countries = readCountries();
  const perCountry = num('per-country', 100);
  log(`Bot gestartet — ${countries.length} Länder in der Liste, ${perCountry} Rezepte je Land`);
  log(`Modelle: ${modelList().join(' → ')}`);
  log(`OpenRouter-Keys: ${KEYS.length}${KEYS.length > 1 ? ' (Rotation aktiv)' : ''}`);

  const existingIds = new Set(await fetchExistingIds());
  const dbCounts = await fetchDbCounts();
  log(`DB: ${existingIds.size} Rezepte in ${dbCounts.size} Küchen`);
  writeStatus({ running: true, startedAt: new Date().toISOString(), perCountry });

  if (flag('verify')) {
    printCountryReport(countries, dbCounts, perCountry);
    return;
  }

  const state = loadState([...existingIds]);
  const onlyNames = String(opt('countries', '')).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = onlyNames.filter((n) => !countries.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  if (unknown.length) log(`Unbekannte Ländernamen (Schreibweise wie in countries.ts): ${unknown.join(', ')}`, 'warn');

  let todo = countries.filter((c) => (onlyNames.length ? onlyNames.some((n) => n.toLowerCase() === c.name.toLowerCase()) : true));
  if (!flag('overwrite')) todo = todo.filter((c) => (dbCounts.get(c.name) || 0) < perCountry);
  if (args.has('max-countries')) todo = todo.slice(0, num('max-countries', 1));

  printCountryReport(countries, dbCounts, perCountry);
  if (!todo.length) {
    log('Nichts zu tun — alle Länder haben schon genug Rezepte. (--overwrite erzwingt einen Lauf.)');
    return;
  }
  if (!CFG.openRouterKey) {
    console.error('Fehlt: OPENROUTER_API_KEY — für das Erzeugen nötig (tools/recipe-bot/.env).');
    process.exit(1);
  }
  log(`Geplant: ${todo.map((c) => c.name).join(', ')}`);
  const started = Date.now();
  let totalNew = 0;
  let totalNoImage = 0;
  const summary = [];
  let auditCounter = 0;

  // Mehrere Durchgänge: übersprungene Länder (alle Modelle im Limit) kommen später nochmal dran.
  let pending = [...todo];
  for (let pass = 1; pass <= 3 && pending.length; pass++) {
    if (pass > 1) {
      log(`Runde ${pass}: ${pending.length} Länder nochmal (Namen: ${pending.slice(0, 6).map((c) => c.name).join(', ')}${pending.length > 6 ? ' …' : ''})`);
      await sleep(num('retry-pause', 90000));
    }
    const deferred = [];
    for (const country of pending) {
      const t0 = Date.now();
      const already = dbCounts.get(country.name) || 0;
      const need = Math.max(0, perCountry - already);
      if (!need) continue;
      log(`── ${country.name} ─────────────────────────────`);
      log(`   vorhanden: ${already}, fehlend: ${need}`);
      writeStatus({
        running: true,
        country: country.name,
        need,
        written: 0,
        namesDone: 0,
        namesTotal: need,
        countryStartedAt: new Date().toISOString(),
      });
      const { rows, rejected } = await buildForCountry(country.name, need, state, existingIds, []);
      if (!rows.length) {
        log(`${country.name}: nichts erzeugt (Modelle im Limit) — kommt in die nächste Runde`, 'warn');
        deferred.push(country);
        continue;
      }
      const without = flag('no-images') ? 0 : await attachImages(rows, country.name, state);
      if (flag('no-images')) rows.forEach((r) => (r.image_url = null));
      const written = await pushRows(rows, country.name);
      totalNew += written;
      totalNoImage += without;
      dbCounts.set(country.name, already + written);
      state.done[country.name] = { count: written, withoutImage: without, at: new Date().toISOString() };
      saveState(state);
      writeStatus({ country: null, lastDone: { country: country.name, count: written, at: new Date().toISOString() } });
      const secs = Math.round((Date.now() - t0) / 1000);
      summary.push({ country: country.name, written, without, rejected: rejected.length, secs });
      log(`${country.name}: ${written} hochgeladen, ${without} ohne Bild, ${rejected.length} verworfen (${secs}s)`);
      // Länder unter 100 werden in der nächsten Runde aufgefüllt
      if ((dbCounts.get(country.name) || 0) < perCountry) deferred.push(country);

      /* Auto-Nachkontrolle: nach jedem Land die Bilder, nach je 2 Ländern ein Report. */
      if (!flag('no-audit')) {
        const countryRows = await loadRecipes([country.name]);
        await auditRows(countryRows, { fixImages: true, label: country.name });
        auditCounter++;
        if (auditCounter % 2 === 0) {
          const allRows = await loadRecipes();
          await auditRows(allRows, { files: true, fixImages: false });
          if (!flag('no-images')) {
            const missing = allRows.filter((r) => !r.image_url);
            if (missing.length) await fixMissingImages(missing);
          }
        }
      }
    }
    pending = deferred;
  }
  if (pending.length) log(`Nicht geschafft (Modelle im Limit): ${pending.map((c) => c.name).join(', ')} — später erneut starten`, 'warn');

  console.log('\n══════ Zusammenfassung ══════');
  console.log('Land'.padEnd(24) + 'neu'.padStart(5) + 'o. Bild'.padStart(9) + 'verw.'.padStart(7) + 'Sek.'.padStart(7));
  for (const s of summary) {
    console.log(s.country.padEnd(24) + String(s.written).padStart(5) + String(s.without).padStart(9) + String(s.rejected).padStart(7) + String(s.secs).padStart(7));
  }
  console.log(`\nGesamt neu: ${totalNew} Rezepte, davon ${totalNoImage} ohne Bild.`);
  writeStatus({ running: false, country: null, finishedAt: new Date().toISOString(), plannedCountries: [] });
  console.log(`Dauer: ${Math.round((Date.now() - started) / 1000)}s. Log: ${path.relative(ROOT, LOG_FILE)}`);
  console.log('Rezepte ohne Bild stehen in state.json unter "noImage"; mit --countries=… --overwrite erneut laufen lassen.\n');
}

process.on('SIGINT', () => {
  writeStatus({ running: false, country: null, stoppedAt: new Date().toISOString() });
  console.log('\nAbgebrochen — Fortschritt steht in state.json, einfach neu starten.');
  process.exit(130);
});

main().catch((e) => {
  console.error('\nFehler:', e.message);
  log(`Abbruch: ${e.stack || e.message}`, 'error');
  process.exit(1);
});
