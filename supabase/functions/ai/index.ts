import { isDeepSeekPeak, peakSummary } from './peak.ts';

/**
 * Spoonful AI proxy — der OpenRouter-Key bleibt auf dem Server.
 *
 * WICHTIG (Geld sparen):
 *  * Es werden **alle** vorhandenen Keys benutzt: OPENROUTER_API_KEY,
 *    OPENROUTER_API_KEY_2 … _24 (oder OPENROUTER_API_KEYS als Kommaliste).
 *    Pro Anfrage wird rotiert; Keys mit 429/402 werden kurz gesperrt.
 *  * Zuerst laufen immer die **Gratis-Modelle** (pricing == 0, live von
 *    OpenRouter geladen).
 *  * Danach kommt die feste Kette (günstig → teurer):
 *      1. meta-llama/llama-3.1-8b-instruct
 *      2. microsoft/phi-4
 *      3. deepseek/deepseek-v4.1-flash   ← **nur außerhalb der Stoßzeiten**
 *      4. openai/gpt-4o-mini             (letzter Notfall)
 *  * Die bezahlte Kette lässt sich mit OPENROUTER_ALLOW_PAID=0 abschalten;
 *    OPENROUTER_PAID_DAILY_LIMIT begrenzt sie pro Tag (Standard 300).
 *
 * Deployen: Dashboard → Edge Functions → „ai“ → diesen Code einfügen → Deploy.
 * Secrets setzen: OPENROUTER_API_KEY, OPENROUTER_API_KEY_2 … (bis _24).
 */
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PAID_MODEL = Deno.env.get('OPENROUTER_PAID_MODEL') ?? 'openai/gpt-4o-mini';

/**
 * Die **drei besten Gratis-Modelle** (vorher wurde live eine lange Liste
 * geladen und durchprobiert — das hat jeden Aufruf langsam gemacht).
 *
 * Reihenfolge nach Erfahrung aus dem Rezept-Bot:
 *  1. ling-3.0-flash-vl  — sehr schnell, gutes Deutsch
 *  2. gemma-4-31b-it     — starke Anweisungstreue (JSON)
 *  3. nemotron-3-super-120b — stärkstes Modell der Gratis-Gruppe
 *
 * Über das Secret OPENROUTER_FREE_MODELS (Kommaliste) änderbar, ohne Deploy.
 */
const BEST_FREE_MODELS: string[] = [
  'inclusionai/ling-3.0-flash-vl:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

function freeModelList(): string[] {
  const custom = (Deno.env.get('OPENROUTER_FREE_MODELS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return custom.length ? custom.slice(0, 3) : BEST_FREE_MODELS;
}

/**
 * Bezahlte Kette: **nur als letzter Notfall** (erst wenn alle Gratis-Modelle
 * gescheitert sind) und nur innerhalb des Tageslimits.
 *
 * Abschalten:   OPENROUTER_ALLOW_PAID=0   → dann läuft ausschließlich Gratis.
 * Limit:        OPENROUTER_PAID_DAILY_LIMIT=50  (0 = kein Limit)
 *
 * Kosten je Anfrage (OpenRouter, Stand September 2026, Richtwerte):
 *  llama-3.1-8b-instruct  ~0,0002 $   (billigstes Modell der Kette)
 *  phi-4                  ~0,0004 $
 *  deepseek-v4.1-flash    ~0,001 $ off-peak (in der Stoßzeit doppelt so teuer)
 *  gpt-4o-mini            ~0,001 $    (letzter Ausweg)
 */
const MODEL_CHAIN: string[] = [
  'meta-llama/llama-3.1-8b-instruct',
  'microsoft/phi-4',
  'deepseek/deepseek-v4.1-flash',
  'openai/gpt-4o-mini',
];

/** Modelle, die nur außerhalb der DeepSeek-Stoßzeit erlaubt sind. */
const PEAK_RESTRICTED = ['deepseek/deepseek-v4.1-flash'];

/** Bezahlte Kette erlaubt? (OPENROUTER_ALLOW_PAID=0 schaltet sie komplett ab.) */
const PAID_ALLOWED = !['0', 'false', 'no', 'off'].includes(
  String(Deno.env.get('OPENROUTER_ALLOW_PAID') ?? '1').toLowerCase(),
);

/**
 * Sicherheitsnetz gegen hohe Rechnungen: höchstens so viele bezahlte Anfragen
 * pro Tag (Standard 100 ≈ wenige Cent). 0 = kein Limit.
 */
const PAID_DAILY_LIMIT = Math.max(
  0,
  Number(Deno.env.get('OPENROUTER_PAID_DAILY_LIMIT') ?? 100) || 0,
);
let paidCalls = { day: '', count: 0 };

function paidBudgetLeft(): boolean {
  if (!PAID_DAILY_LIMIT) return true;
  const day = new Date().toISOString().slice(0, 10);
  if (paidCalls.day !== day) paidCalls = { day, count: 0 };
  return paidCalls.count < PAID_DAILY_LIMIT;
}

function notePaidCall() {
  paidCalls.count += 1;
}


/** Ist dieses Modell jetzt erlaubt? (DeepSeek nur außerhalb der Stoßzeit) */
export function modelAllowedNow(model: string, now: Date = new Date()): boolean {
  if (PEAK_RESTRICTED.includes(model) && isDeepSeekPeak(now)) return false;
  return true;
}


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Alle verfügbaren Keys (bis zu 20+). */
function readKeys(): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => {
    for (const part of String(v ?? '').split(',')) {
      const k = part.trim();
      if (k.startsWith('sk-') && !out.includes(k)) out.push(k);
    }
  };
  add(Deno.env.get('OPENROUTER_API_KEYS'));
  add(Deno.env.get('OPENROUTER_API_KEY'));
  for (let i = 2; i <= 24; i++) add(Deno.env.get(`OPENROUTER_API_KEY_${i}`));
  return out;
}

/** Keys, die gerade gesperrt sind (429/402), kurz überspringen. */
const blockedUntil = new Map<string, number>();
function liveKeys(keys: string[]): string[] {
  const now = Date.now();
  const open = keys.filter((k) => (blockedUntil.get(k) ?? 0) < now);
  return open.length ? open : keys;
}

/** Gratis-Modelle für diesen Aufruf (feste kurze Liste — kein Live-Abruf mehr). */
function freeModels(): string[] {
  return freeModelList();
}

type Attempt = { ok: boolean; status: number; content?: string; detail?: string };

/** Ein einzelner Versuch bei OpenRouter. */
async function attempt(key: string, model: string, body: Record<string, unknown>, withJson: boolean): Promise<Attempt> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': Deno.env.get('SITE_URL') ?? 'https://spoonful.app',
        'X-Title': 'Spoonful',
      },
      body: JSON.stringify(withJson ? { ...body, model, response_format: { type: 'json_object' } } : { ...body, model }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      if (res.status === 429 || res.status === 402) blockedUntil.set(key, Date.now() + 10 * 60 * 1000);
      return { ok: false, status: res.status, detail };
    }
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, status: 502, detail: 'empty AI answer' };
    return { ok: true, status: 200, content: String(content) };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e instanceof Error ? e.message : e) };
  }
}

/** Liest die "role"-Angabe aus einem bereits geprüften JWT. */
function jwtRole(token: string): string {
  try {
    const payload = token.split('.')[1] ?? '';
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(padded))?.role ?? '');
  } catch {
    return '';
  }
}

/**
 * 3.2.3: Tageslimit prüfen und verbrauchen.
 *
 * Die Zählung liegt in der Datenbank (`public.ai_usage_consume`), damit sie
 * geräteübergreifend gilt und nicht durch einen Neustart der App zurückgesetzt
 * werden kann. Mods/Admins bekommen `unlimited: true`.
 */
const AI_DAILY_LIMIT = Math.max(0, Number(Deno.env.get('AI_DAILY_LIMIT') ?? '3') || 3);

type QuotaResult = { allowed: boolean; used: number; limit: number; remaining: number; unlimited?: boolean } | null;

async function consumeQuota(token: string): Promise<QuotaResult> {
  const url = `${Deno.env.get('SUPABASE_URL') ?? ''}/rest/v1/rpc/ai_usage_consume`;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url.startsWith('http') || !anon) return null; /* kein Limit möglich → nicht blockieren */
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: AI_DAILY_LIMIT }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    return {
      allowed: data.allowed !== false,
      used: Number(data.used ?? 0),
      limit: Number(data.limit ?? AI_DAILY_LIMIT),
      remaining: Number(data.remaining ?? 0),
      unlimited: !!data.unlimited,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const keys = readKeys();
  if (!keys.length) return json({ error: 'no OpenRouter key configured' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (jwtRole(token) !== 'authenticated') return json({ error: 'sign in required' }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  /**
   * 3.2.3: Tageslimit — 3 Nutzungen pro Nutzer und Tag, alle drei Chef-
   * Funktionen zusammen. Mods/Admins sind ausgenommen (das entscheidet die
   * Datenbankfunktion anhand von `public.users.role`).
   *
   * Der Zugriff passiert mit dem JWT des Nutzers, damit `auth.uid()` in der
   * Datenbankfunktion gesetzt ist.
   */
  const usage = await consumeQuota(token);
  if (usage && usage.allowed === false) {
    return json(
      {
        error: 'daily_limit_reached',
        message: 'Daily AI limit reached',
        used: usage.used,
        limit: usage.limit,
        remaining: 0,
      },
      429,
    );
  }

  const system = String(payload?.system ?? '');
  const user = String(payload?.user ?? '');
  if (!user.trim()) return json({ error: 'user prompt is required' }, 400);
  if (user.length > 12000 || system.length > 12000) return json({ error: 'prompt too long' }, 413);

  const temperature = Math.max(0, Math.min(1.2, Number(payload?.temperature ?? 0.7) || 0.7));
  const body = {
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  /* 1) Die drei besten Gratis-Modelle der Reihe nach (je 1 Versuch).
        Bewusst kurz gehalten: jeder zusätzliche Versuch kostet nur Zeit. */
  const pool = liveKeys(keys);
  const models = freeModels();
  const errors: string[] = [];
  const skipped: string[] = [];
  let deadline = Date.now() + 20_000;
  const KEYS_PER_MODEL = 1;

  const tryModel = async (model: string, paid: boolean): Promise<Response | null> => {
    let tried = 0;
    for (const key of pool) {
      if (tried >= KEYS_PER_MODEL) break;
      if (Date.now() > deadline) {
        errors.push(`${model}: Zeitgrenze erreicht`);
        break;
      }
      tried += 1;
      const first = await attempt(key, model, body, true);
      if (first.ok) {
        if (paid) notePaidCall();
        /* `paid: true` heißt: kein Gratis-Modell hat geantwortet. */
        return json({
          content: first.content,
          model,
          paid,
          paidCallsToday: paidCalls.count,
          freeModelsTried: models.length,
          ...(usage ? { usage } : {}),
          ...(skipped.length ? { skipped } : {}),
        });
      }
      if (first.status === 400 && /response_format|json/i.test(String(first.detail ?? ''))) {
        const second = await attempt(key, model, body, false);
        if (second.ok) {
          if (paid) notePaidCall();
          return json({
            content: second.content,
            model,
            paid,
            paidCallsToday: paidCalls.count,
            freeModelsTried: models.length,
            ...(usage ? { usage } : {}),
          });
        }
        errors.push(`${model}: ${second.status} ${String(second.detail ?? '').slice(0, 80)}`);
        break; /* Modell kann kein JSON → nächstes Modell */
      }
      errors.push(`${model}: ${first.status} ${String(first.detail ?? '').slice(0, 80)}`);
      if (first.status === 429 || first.status === 402) continue; /* nächster Key */
      break; /* anderer Fehler → nächstes Modell */
    }
    return null;
  };

  for (const model of models) {
    const done = await tryModel(model, false);
    if (done) return done;
  }

  /* 2) Letzter Notfall: billige Kette, nur außerhalb der DeepSeek-Stoßzeit
        und nur innerhalb des Tageslimits. Dafür bekommt sie eine eigene,
        frische Zeitgrenze — sonst wäre sie nach den Gratis-Versuchen tot. */
  deadline = Date.now() + 30_000;
  if (PAID_ALLOWED) {
    for (const model of MODEL_CHAIN) {
      if (!modelAllowedNow(model)) {
        skipped.push(`${model} (Stoßzeit: ${peakSummary()})`);
        continue;
      }
      if (!paidBudgetLeft()) {
        skipped.push(`${model} (Tageslimit ${PAID_DAILY_LIMIT} erreicht)`);
        break;
      }
      const done = await tryModel(model, true);
      if (done) return done;
    }
    /* Letzter Notfall, falls konfiguriert und nicht schon in der Kette. */
    if (PAID_MODEL && !MODEL_CHAIN.includes(PAID_MODEL) && modelAllowedNow(PAID_MODEL) && paidBudgetLeft()) {
      const paid = await tryModel(PAID_MODEL, true);
      if (paid) return paid;
    }
  }

  return json(
    {
      error: 'all attempts failed',
      paidAllowed: PAID_ALLOWED,
      keys: keys.length,
      freeModels: models.length,
      deepseekPeak: isDeepSeekPeak(),
      peakInfo: peakSummary(),
      paidCallsToday: paidCalls.count,
      paidLimit: PAID_DAILY_LIMIT,
      skipped,
      detail: errors.slice(-4).join(' | ') || 'no free model available',
    },
    502,
  );
});
