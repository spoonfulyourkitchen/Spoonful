/**
 * Spoonful AI proxy — der OpenRouter-Key bleibt auf dem Server.
 *
 * WICHTIG (Geld sparen):
 *  * Es werden **alle** vorhandenen Keys benutzt: OPENROUTER_API_KEY,
 *    OPENROUTER_API_KEY_2 … _24 (oder OPENROUTER_API_KEYS als Kommaliste).
 *    Pro Anfrage wird rotiert; Keys mit 429/402 werden kurz gesperrt.
 *  * Standardmäßig laufen nur **Gratis-Modelle** (pricing == 0, live von
 *    OpenRouter geladen). Das bezahlte Modell wird **nur** benutzt, wenn
 *    ALLES fehlschlägt und ausdrücklich OPENROUTER_ALLOW_PAID=1 gesetzt ist.
 *
 * Deployen: Dashboard → Edge Functions → „ai“ → diesen Code einfügen → Deploy.
 * Secrets setzen: OPENROUTER_API_KEY, OPENROUTER_API_KEY_2 … (bis _24).
 */
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const PAID_MODEL = Deno.env.get('OPENROUTER_PAID_MODEL') ?? 'openai/gpt-4o-mini';
const PAID_ALLOWED = ['1', 'true', 'yes'].includes(String(Deno.env.get('OPENROUTER_ALLOW_PAID') ?? '').toLowerCase());

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

/** Gratis-Modelle live von OpenRouter holen (10 Minuten gecacht). */
let freeCache: { at: number; models: string[] } = { at: 0, models: [] };
async function freeModels(): Promise<string[]> {
  if (Date.now() - freeCache.at < 10 * 60 * 1000 && freeCache.models.length) return freeCache.models;
  try {
    const res = await fetch(MODELS_ENDPOINT);
    const data = await res.json();
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    const free = rows
      .filter((m) => {
        const p = m?.pricing ?? {};
        return Number(p.prompt ?? 1) === 0 && Number(p.completion ?? 1) === 0;
      })
      .map((m) => String(m?.id ?? ''))
      .filter(Boolean);
    /* Gute Allrounder zuerst (JSON-fähig, große Kontexte). */
    const score = (id: string) =>
      /gpt-oss/i.test(id) ? 0 : /qwen.*(instruct|235b|72b)/i.test(id) ? 1 : /llama.*(70b|instruct)/i.test(id) ? 2 : /mistral|gemma|deepseek/i.test(id) ? 3 : 4;
    free.sort((a, b) => score(a) - score(b));
    freeCache = { at: Date.now(), models: free.slice(0, 12) };
    return freeCache.models;
  } catch {
    return freeCache.models;
  }
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

  /* 1) Gratis-Modelle über alle Keys durchprobieren. */
  const pool = liveKeys(keys);
  const models = await freeModels();
  const errors: string[] = [];

  for (const model of models) {
    for (const key of pool) {
      const first = await attempt(key, model, body, true);
      if (first.ok) return json({ content: first.content, model, paid: false });
      if (first.status === 400 && /response_format|json/i.test(String(first.detail ?? ''))) {
        const second = await attempt(key, model, body, false);
        if (second.ok) return json({ content: second.content, model, paid: false });
        errors.push(`${model}: ${second.status} ${String(second.detail ?? '').slice(0, 80)}`);
        break; /* Modell kann kein JSON → nächstes Modell */
      }
      errors.push(`${model}: ${first.status} ${String(first.detail ?? '').slice(0, 80)}`);
      if (first.status === 429 || first.status === 402) continue; /* nächster Key */
      break; /* anderer Fehler → nächstes Modell */
    }
  }

  /* 2) Notfall: bezahltes Modell — nur mit ausdrücklicher Freigabe. */
  if (PAID_ALLOWED) {
    for (const key of pool) {
      const paid = await attempt(key, PAID_MODEL, body, true);
      if (paid.ok) return json({ content: paid.content, model: PAID_MODEL, paid: true });
      errors.push(`paid ${PAID_MODEL}: ${paid.status}`);
      if (paid.status !== 429 && paid.status !== 402) break;
    }
  }

  return json(
    {
      error: 'all attempts failed',
      paidAllowed: PAID_ALLOWED,
      keys: keys.length,
      freeModels: models.length,
      detail: errors.slice(-4).join(' | ') || 'no free model available',
    },
    502,
  );
});
