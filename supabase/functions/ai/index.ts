import { isDeepSeekPeak, peakSummary } from './peak.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PAID_MODEL = Deno.env.get('OPENROUTER_PAID_MODEL') ?? 'microsoft/phi-4';

const BEST_FREE_MODELS: string[] = [
  'particle-ai/particle-1:free',
  'baidu/ernie-5.5-flash-preview:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
];

function freeModelList(): string[] {
  const custom = (Deno.env.get('OPENROUTER_FREE_MODELS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return custom.length ? custom.slice(0, 6) : BEST_FREE_MODELS;
}

// Paid models are ordered by price: cheapest first, the most expensive last.
// completion price per token (OpenRouter, 2026-11): phi-4 0.14 $/M,
// deepseek-v4.1-flash 0.2028 $/M, gpt-4o-mini 0.60 $/M.
const MODEL_CHAIN: string[] = [
  'microsoft/phi-4',
  'deepseek/deepseek-v4.1-flash',
  'openai/gpt-4o-mini',
];

const PEAK_RESTRICTED = ['deepseek/deepseek-v4.1-flash'];

const PAID_ALLOWED = !['0', 'false', 'no', 'off'].includes(
  String(Deno.env.get('OPENROUTER_ALLOW_PAID') ?? '1').toLowerCase(),
);

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

export function modelAllowedNow(model: string, now: Date = new Date()): boolean {
  if (PEAK_RESTRICTED.includes(model) && isDeepSeekPeak(now)) return false;
  return true;
}

const VIDEO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function readJsonStringField(text: string, quoteAt: number): string {
  let i = quoteAt + 1;
  let escaped = false;
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') break;
  }
  if (i >= text.length) return '';
  try {
    return String(JSON.parse(text.slice(quoteAt, i + 1)));
  } catch {
    return '';
  }
}

function decodeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

function metaContent(html: string, name: string): string {
  const a = new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, 'i').exec(html);
  if (a?.[1]) return decodeHtml(a[1]);
  const b = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${name}"`, 'i').exec(html);
  return b?.[1] ? decodeHtml(b[1]) : '';
}

/**
 * A video page keeps its caption in different places: TikTok in the embedded
 * JSON as "desc", YouTube as "shortDescription", everything else in the meta
 * tags. All of them are collected, longest first.
 */
export function pageRecipeText(html: string): { title: string; text: string } {
  const parts: string[] = [];
  const descAt = html.indexOf('"desc":"');
  if (descAt >= 0) {
    const value = readJsonStringField(html, descAt + '"desc":'.length);
    if (value.trim()) parts.push(decodeHtml(value));
  }
  const shortAt = html.indexOf('"shortDescription":"');
  if (shortAt >= 0) {
    const value = readJsonStringField(html, shortAt + '"shortDescription":'.length);
    if (value.trim()) parts.push(decodeHtml(value));
  }
  const og = metaContent(html, 'og:description') || metaContent(html, 'description');
  if (og.trim()) parts.push(og);
  const caption =
    /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/i.exec(html)?.[1] ?? '';
  if (caption) {
    try {
      parts.push(decodeHtml(JSON.parse(`"${caption}"`)));
    } catch {}
  }
  const seen = new Set<string>();
  const text = parts
    .map((part) => part.replace(/\r/g, '\n').trim())
    .filter((part) => part.length > 0 && !seen.has(part) && (seen.add(part), true))
    .sort((a, b) => b.length - a.length)
    .join('\n\n');
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'title') ||
    decodeHtml(/<title>([^<]{2,200})<\/title>/i.exec(html)?.[1] ?? '');
  return { title, text };
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

const blockedUntil = new Map<string, number>();
function liveKeys(keys: string[]): string[] {
  const now = Date.now();
  const open = keys.filter((k) => (blockedUntil.get(k) ?? 0) < now);
  return open.length ? open : keys;
}

function freeModels(): string[] {
  return freeModelList();
}

type Attempt = { ok: boolean; status: number; content?: string; detail?: string };

type Provider = { name: string; endpoint: string; extra?: Record<string, unknown> };

const OPENROUTER: Provider = {
  name: 'openrouter',
  endpoint: ENDPOINT,
  // The free models are reasoning models. With a low reasoning budget they answer
  // in seconds; without it they spend every token on thinking and return no content.
  extra: { reasoning: { effort: 'low' } },
};

// Direct free tiers, used before OpenRouter. Both are OpenAI-compatible and were
// verified from our networks: Gemini (flash-lite ~1 s) and NVIDIA NIM
// (nemotron-3.5-lightning ~2 s). A provider without a key is skipped silently.
const FREE_TIERS: Provider[] = [
  { name: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  { name: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', extra: { reasoning_effort: 'low' } },
];

const FREE_TIER_MODELS: Record<string, string[]> = {
  gemini: ['gemini-flash-lite-latest', 'gemini-3.8-flash'],
  nvidia: ['nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'],
};

const FREE_TIER_KEYS: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
};

// A provider that reports a rejected key or missing credits is paused, so it costs
// one fast request instead of one per model on every following recipe.
const providerDown = new Map<string, number>();
function providerReady(name: string): boolean {
  return (providerDown.get(name) ?? 0) < Date.now();
}

async function attempt(
  provider: Provider,
  key: string,
  model: string,
  body: Record<string, unknown>,
  withJson: boolean,
): Promise<Attempt> {
  const variants: Record<string, unknown>[] = [provider.extra ?? {}, {}];
  let last: Attempt = { ok: false, status: 0, detail: 'not attempted' };
  for (const extra of variants) {
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': Deno.env.get('SITE_URL') ?? 'https://spoonful.app',
          'X-Title': 'Spoonful',
        },
        body: JSON.stringify({
          ...body,
          model,
          ...(withJson ? { response_format: { type: 'json_object' } } : {}),
          ...extra,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        if (res.status === 429 || res.status === 402) blockedUntil.set(key, Date.now() + 10 * 60 * 1000);
        if (res.status === 401 || res.status === 402 || res.status === 403) {
          providerDown.set(provider.name, Date.now() + 30 * 60 * 1000);
        }
        last = { ok: false, status: res.status, detail };
        if (res.status === 400 && /reasoning/i.test(detail) && Object.keys(extra).length) continue;
        return last;
      }
      const data = await res.json().catch(() => null);
      const choice = data?.choices?.[0];
      const content = choice?.message?.content || choice?.text || data?.output_text || '';
      if (!content) return { ok: false, status: 502, detail: 'empty AI answer' };
      return { ok: true, status: 200, content: String(content) };
    } catch (e) {
      return { ok: false, status: 0, detail: String(e instanceof Error ? e.message : e) };
    }
  }
  return last;
}

function jwtRole(token: string): string {
  try {
    const payload = token.split('.')[1] ?? '';
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(padded))?.role ?? '');
  } catch {
    return '';
  }
}

const AI_DAILY_LIMIT = Math.max(0, Number(Deno.env.get('AI_DAILY_LIMIT') ?? '3') || 3);

type QuotaResult = { allowed: boolean; used: number; limit: number; remaining: number; unlimited?: boolean } | null;

async function consumeQuota(token: string, requestId?: string): Promise<QuotaResult> {
  const url = `${Deno.env.get('SUPABASE_URL') ?? ''}/rest/v1/rpc/ai_usage_consume`;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url.startsWith('http') || !anon) return null; 
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: AI_DAILY_LIMIT, p_request_id: requestId ?? null }),
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

  // Video import: the page is fetched here because TikTok and YouTube send no
  // CORS headers, so the browser cannot read their captions at all.
  if (typeof payload?.video === 'string' && payload.video.trim()) {
    const link = payload.video.trim().slice(0, 500);
    if (!/^https?:\/\//i.test(link)) return json({ error: 'invalid video url' }, 400);
    try {
      const res = await fetch(link, {
        headers: { 'User-Agent': VIDEO_UA, 'Accept-Language': 'de-DE,de;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      const html = (await res.text()).slice(0, 900_000);
      const meta = pageRecipeText(html);
      const firstLine = meta.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? '';
      const genericTitle = !meta.title || /tiktok - make your day|^https?:\/\//i.test(meta.title);
      const host = (() => {
        try {
          return new URL(res.url || link).hostname;
        } catch {
          return '';
        }
      })();
      return json({
        platform: /tiktok/.test(host) ? 'tiktok' : /youtube|youtu\.be/.test(host) ? 'youtube' : /instagram/.test(host) ? 'instagram' : 'other',
        url: res.url || link,
        status: res.status,
        title: (genericTitle ? firstLine : meta.title).replace(/[⬇️]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90),
        text: meta.text.slice(0, 12_000),
      });
    } catch (e) {
      return json({ error: 'video fetch failed', detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
    }
  }

  // Diagnostics: reachability and allowance of the APInex free tier, no quota used.

  

  const requestId = typeof payload?.requestId === 'string' ? payload.requestId.slice(0, 80) : undefined;
  const usage = await consumeQuota(token, requestId);
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
    max_tokens: 3000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  

  const openRouterPool = liveKeys(keys);
  const models = freeModels();
  const errors: string[] = [];
  const freeErrors: string[] = [];
  const skipped: string[] = [];
  let deadline = Date.now() + 60_000;
  const KEYS_PER_MODEL = 1;

  const note = (message: string, paid: boolean) => {
    errors.push(message);
    if (!paid) freeErrors.push(message);
  };

  const tryModel = async (
    model: string,
    paid: boolean,
    provider: Provider = OPENROUTER,
    keyOverride?: string,
  ): Promise<Response | null> => {
    const pool = keyOverride ? [keyOverride] : openRouterPool;
    let tried = 0;
    for (const key of pool) {
      if (tried >= KEYS_PER_MODEL) break;
      if (Date.now() > deadline) {
        note(`${model}: Zeitgrenze erreicht`, paid);
        break;
      }
      tried += 1;
      const first = await attempt(provider, key, model, body, true);
      if (first.ok) {
        if (paid) notePaidCall();
        
        return json({
          content: first.content,
          model,
          paid,
          paidCallsToday: paidCalls.count,
          freeModelsTried: models.length,
          ...(usage ? { usage } : {}),
          ...(skipped.length ? { skipped } : {}),
          ...(freeErrors.length ? { freeErrors } : {}),
        });
      }
      if (first.status === 400 && /response_format|json/i.test(String(first.detail ?? ''))) {
        const second = await attempt(provider, key, model, body, false);
        if (second.ok) {
          if (paid) notePaidCall();
          return json({
            content: second.content,
            model,
            paid,
            paidCallsToday: paidCalls.count,
            freeModelsTried: models.length,
            ...(usage ? { usage } : {}),
            ...(freeErrors.length ? { freeErrors } : {}),
          });
        }
        note(`${model}: ${second.status} ${String(second.detail ?? '').slice(0, 80)}`, paid);
        break; 
      }
      if (/empty AI answer/i.test(String(first.detail ?? ''))) {
        // Some free providers return 200 with no content when JSON mode is requested.
        const plain = await attempt(provider, key, model, body, false);
        if (plain.ok) {
          if (paid) notePaidCall();
          return json({
            content: plain.content,
            model,
            paid,
            paidCallsToday: paidCalls.count,
            freeModelsTried: models.length,
            ...(usage ? { usage } : {}),
            ...(freeErrors.length ? { freeErrors } : {}),
          });
        }
        note(`${model}: leere Antwort`, paid);
        continue;
      }
      note(`${model}: ${first.status} ${String(first.detail ?? '').slice(0, 80)}`, paid);
      if (first.status === 429 || first.status === 402) continue; 
      break; 
    }
    return null;
  };

  // 1) Direct free tiers (Gemini, NVIDIA), each with its own key and quota.
  for (const tier of FREE_TIERS) {
    const key = (Deno.env.get(FREE_TIER_KEYS[tier.name]) ?? '').trim();
    if (!key || !providerReady(tier.name)) continue;
    deadline = Date.now() + 25_000;
    for (const model of FREE_TIER_MODELS[tier.name] ?? []) {
      const done = await tryModel(model, false, tier, key);
      if (done) return done;
    }
  }

  // 2) OpenRouter free models.
  deadline = Date.now() + 60_000;
  for (const model of models) {
    const done = await tryModel(model, false);
    if (done) return done;
  }

  

  deadline = Date.now() + 35_000;
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
