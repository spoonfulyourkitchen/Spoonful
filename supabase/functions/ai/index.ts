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

// APInex free tier: every request is charged against a daily allowance with a
// model weight (1 to 5), so the cheapest model is asked first.
// Only models with allowFree come without a subscription. free/drex-v2.0 is a
// decision model and rejects /v1/chat/completions, so it is not listed here.
const APINEX_FREE_MODELS: string[] = [
  // weight 3 = cheapest billable tier
  'free/deepseek-v4.1-flash',
  'free/glm-5.3-flash',
  'free/gpt-6-luna',
  'free/qwen-3.8-max',
  'free/minimax-m3.1-flash',
  'free/deepseek-v4-flash-0731',
  'free/deepseek-v4-pro-0813',
  'free/glm-5.3-flashx',
  // weight 4
  'free/glm-5.3',
  // weight 5
  'free/gemini-4-hydrogen',
];

function apinexModelList(): string[] {
  const custom = (Deno.env.get('APINEX_FREE_MODELS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return custom.length ? custom : APINEX_FREE_MODELS;
}

// Hugging Face Inference Providers no longer has free models: a free account gets
// no monthly credits, so every call answers 402 until credits are bought (or PRO
// is active with its 2 $ a month). The router stays wired as the second stage,
// cheapest model first, and is switched off for a while after a billing error.
const HUGGINGFACE_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const HF_MODELS: string[] = [
  'zai-org/GLM-5.3-Flash', // 0.0356 / 0.0815 $ per M tokens
  'openai/gpt-oss-20b', // 0.018 / 0.09
  'google/gemma-4-31B-it', // 0.1 / 0.1
  'deepseek-ai/DeepSeek-V4-Flash', // 0.0426 / 0.14
];

function hfModelList(): string[] {
  const custom = (Deno.env.get('HUGGINGFACE_FREE_MODELS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return custom.length ? custom : HF_MODELS;
}

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

type Provider = { name: 'openrouter' | 'apinex' | 'huggingface'; endpoint: string };

const OPENROUTER: Provider = { name: 'openrouter', endpoint: ENDPOINT };
const APINEX: Provider = { name: 'apinex', endpoint: 'https://api.apinex.bond/v1/chat/completions' };
const HUGGINGFACE: Provider = { name: 'huggingface', endpoint: HUGGINGFACE_ENDPOINT };

// A provider that answers 402 (no credits) or 401 (bad key) is paused, so a
// missing top-up costs one fast request instead of one per model.
const providerDown = new Map<string, number>();
function providerReady(name: string): boolean {
  return (providerDown.get(name) ?? 0) < Date.now();
}

function reasoningExtra(provider: Provider): Record<string, unknown> {
  if (provider.name === 'huggingface') return {};
  return provider.name === 'apinex' ? { reasoning_effort: 'low' } : { reasoning: { effort: 'low' } };
}

async function attempt(
  provider: Provider,
  key: string,
  model: string,
  body: Record<string, unknown>,
  withJson: boolean,
): Promise<Attempt> {
  // The free models are reasoning models. With a low reasoning budget they answer
  // in seconds; without it they spend every token on thinking and return no content.
  const variants: Record<string, unknown>[] = [reasoningExtra(provider), {}];
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
        if (res.status === 402 || res.status === 401 || res.status === 403) {
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

  // Diagnostics: is the Hugging Face router reachable, and does the key have credits?
  if (payload?.diagnose === 'huggingface') {
    const key = (Deno.env.get('HUGGINGFACE_API_KEY') ?? '').trim();
    if (!key.startsWith('hf_')) return json({ error: 'HUGGINGFACE_API_KEY missing' }, 500);
    const models = hfModelList();
    const probe: unknown[] = [];
    for (const model of models.slice(0, 3)) {
      const t0 = Date.now();
      const r = await attempt(
        HUGGINGFACE,
        key,
        model,
        {
          temperature: 0,
          max_tokens: 200,
          messages: [{ role: 'user', content: 'Antworte nur mit JSON: {"ok":true}' }],
        },
        true,
      );
      probe.push({
        model,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - t0,
        detail: r.ok ? String(r.content ?? '').slice(0, 40) : String(r.detail ?? '').slice(0, 120),
      });
    }
    return json({ huggingface: { models, probe, paused: !providerReady('huggingface') } });
  }

  // Diagnostics: reachability and allowance of the APInex free tier, no quota used.
  if (payload?.diagnose === 'apinex') {
    const key = (Deno.env.get('APINEX_API_KEY') ?? '').trim();
    if (!key.startsWith('sk-ap')) return json({ error: 'APINEX_API_KEY missing' }, 500);
    const info: Record<string, unknown> = {};
    for (const path of ['/api/public/models', '/subscription']) {
      try {
        const r = await fetch(`https://api.apinex.bond${path}`, { headers: { Authorization: `Bearer ${key}` } });
        const text = await r.text();
        if (path === '/subscription') {
          info.subscription = { status: r.status, body: text.slice(0, 400) };
        } else {
          let free: unknown = 'parse failed';
          try {
            const data = JSON.parse(text);
            free = (data.models ?? [])
              .filter((m: any) => String(m.id ?? '').startsWith('free/') && m.allowFree !== false)
              .map((m: any) => `${m.id}:w${m.weight}`);
          } catch {}
          info.catalog = { status: r.status, free };
        }
      } catch (e) {
        info[path] = String(e);
      }
    }
    const variants: { name: string; headers: Record<string, string> }[] = [
      { name: 'bearer', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } },
      {
        name: 'bearer+ua',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
      {
        name: 'bearer+origin',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Origin: 'https://apinex.bond',
          Referer: 'https://apinex.bond/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
      { name: 'x-api-key', headers: { 'x-api-key': key, 'Content-Type': 'application/json' } },
      { name: 'no-auth', headers: { 'Content-Type': 'application/json' } },
    ];
    const variantProbe: unknown[] = [];
    for (const variant of variants) {
      try {
        const r = await fetch('https://api.apinex.bond/v1/models', {
          headers: variant.headers,
          signal: AbortSignal.timeout(15000),
        });
        const body = (await r.text()).slice(0, 80).replace(/\s+/g, ' ');
        variantProbe.push({ variant: variant.name, status: r.status, body });
      } catch (e) {
        variantProbe.push({ variant: variant.name, error: String(e) });
      }
    }
    info.variants = variantProbe;

    const probe: unknown[] = [];
    for (const model of apinexModelList().slice(0, 3)) {
      const t0 = Date.now();
      const r = await attempt(APINEX, key, model, {
        temperature: 0,
        max_tokens: 600,
        messages: [{ role: 'user', content: 'Antworte nur mit JSON: {"ok":true}' }],
      }, true);
      probe.push({
        model,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - t0,
        detail: r.ok ? String(r.content ?? '').slice(0, 40) : String(r.detail ?? '').slice(0, 120),
      });
    }
    return json({ apinex: { info, probe } });
  }

  

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
  const apinexKey = (Deno.env.get('APINEX_API_KEY') ?? '').trim();
  // APInex /v1 works again (the Cloudflare block is gone), but the free models need a
  // one-time 5 $ top-up; without it every model answers 402 and the stage pauses.
  const apinexEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(Deno.env.get('APINEX_ENABLED') ?? '').toLowerCase(),
  );
  const apinexAvailable = apinexEnabled && apinexKey.startsWith('sk-ap');
  const hfKey = (Deno.env.get('HUGGINGFACE_API_KEY') ?? '').trim();
  const hfAvailable = hfKey.startsWith('hf_');
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

  const tryModel = async (model: string, paid: boolean, provider: Provider = OPENROUTER): Promise<Response | null> => {
    const pool =
      provider.name === 'apinex'
        ? apinexAvailable
          ? [apinexKey]
          : []
        : provider.name === 'huggingface'
          ? hfAvailable
            ? [hfKey]
            : []
          : openRouterPool;
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

  // 1) APInex free tier, cheapest weight first.
  if (apinexAvailable && providerReady('apinex')) {
    deadline = Date.now() + 45_000;
    for (const model of apinexModelList()) {
      const done = await tryModel(model, false, APINEX);
      if (done) return done;
    }
  }

  // 2) Hugging Face router, cheapest model first.
  if (hfAvailable && providerReady('huggingface')) {
    deadline = Date.now() + 25_000;
    for (const model of hfModelList()) {
      const done = await tryModel(model, false, HUGGINGFACE);
      if (done) return done;
    }
  }

  // 3) OpenRouter free models.
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
