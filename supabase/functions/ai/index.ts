/**
 * Spoonful AI proxy — keeps the OpenRouter key on the server.
 *
 * The Android app calls this function (supabase.functions.invoke('ai')); the key
 * never leaves the backend, so a decompiled APK contains no AI credentials.
 *
 * Deploy once:
 *   Dashboard → Edge Functions → New function → name it "ai" → paste this file
 *   → Deploy. Then add the secret:
 *   Edge Functions → Secrets → OPENROUTER_API_KEY = sk-or-…
 *
 * Only signed-in users are served: the JWT is verified by Supabase and the role
 * claim must be "authenticated" (the public anon key alone is rejected).
 */
const MODEL = 'openai/gpt-4o-mini';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

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

/** Reads the "role" claim of an already verified JWT. */
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

  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) return json({ error: 'OPENROUTER_API_KEY is not set' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (jwtRole(token) !== 'authenticated') {
    return json({ error: 'sign in required' }, 401);
  }

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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': Deno.env.get('SITE_URL') ?? 'https://spoonful.app',
      'X-Title': 'Spoonful',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    return json({ error: `OpenRouter ${res.status}`, detail }, 502);
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return json({ error: 'empty AI answer' }, 502);

  return json({ content });
});
