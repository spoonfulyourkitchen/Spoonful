/**
 * 3.2.0: Offer Hopper — kostenloser MCP-Server für deutsche Supermarkt-Preise.
 *
 * Endpoint: https://mcp.offerhopper.ai/mcp (streamable-http, keine Anmeldung).
 * Wir sprechen MCP direkt: initialize -> notifications/initialized -> tools/list
 * -> tools/call. Es wird NICHTS an OpenRouter geschickt, es kostet nichts.
 *
 * Da die Parameter nicht dokumentiert abrufbar sind, liest der Client das
 * inputSchema des Tools und füllt die Felder passend (PLZ, Liste, Fahrt, Persona).
 */
const ENDPOINT = 'https://mcp.offerhopper.ai/mcp';
const PROTOCOL = '2025-06-18';

let sessionId: string | null = null;
let nextId = 1;
let ready = false;

export type McpTool = { name: string; description?: string; inputSchema?: any };

/** SSE- oder JSON-Antwort auswerten. */
function parseBody(text: string): any {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const lines = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  for (const line of lines.reverse()) {
    try {
      const json = JSON.parse(line);
      if (json?.result !== undefined || json?.error !== undefined) return json;
    } catch {
      /* weiter */
    }
  }
  return null;
}

async function rpc(method: string, params?: any, notification = false): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const payload = notification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id: nextId++, method, params };

  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = res.headers?.get?.('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  const json = parseBody(text);
  if (!res.ok && !json) throw new Error(`HTTP ${res.status}`);
  if (json?.error) throw new Error(String(json.error?.message ?? json.error));
  return json?.result ?? json;
}

/** Verbindung aufbauen (einmal pro App-Start). */
export async function connect(): Promise<boolean> {
  if (ready) return true;
  try {
    await rpc('initialize', {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: 'Spoonful Monstr', version: '3.2.0' },
    });
    try {
      await rpc('notifications/initialized', {}, true);
    } catch {
      /* notification ist optional */
    }
    ready = true;
    return true;
  } catch {
    sessionId = null;
    return false;
  }
}

/** Verfügbare Tools des Servers. */
export async function listTools(): Promise<McpTool[]> {
  const ok = await connect();
  if (!ok) return [];
  try {
    const result = await rpc('tools/list', {});
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    return tools.map((t: any) => ({ name: String(t?.name ?? ''), description: t?.description, inputSchema: t?.inputSchema }));
  } catch {
    return [];
  }
}

/** Inhalt einer tools/call-Antwort auspacken (text/JSON/structured). */
function unwrap(result: any): any {
  if (result?.structuredContent) return result.structuredContent;
  const content = Array.isArray(result?.content) ? result.content : [];
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      const raw = part.text.trim();
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          return JSON.parse(raw);
        } catch {
          /* weiter */
        }
      }
      return raw;
    }
  }
  return result ?? null;
}

export async function callTool(name: string, args: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const ok = await connect();
    if (!ok) return { ok: false, error: 'offline' };
    const result = await rpc('tools/call', { name, arguments: args ?? {} });
    return { ok: true, data: unwrap(result) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
/** Findet ein Feld im inputSchema anhand möglicher Namen. */
function pickField(schema: any, candidates: string[]): { name: string; type: string } | null {
  const props = schema?.properties ?? {};
  const keys = Object.keys(props);
  for (const want of candidates) {
    const hit =
      keys.find((k) => k.toLowerCase() === want.toLowerCase()) ??
      keys.find((k) => k.toLowerCase().includes(want.toLowerCase()));
    if (hit) {
      const def = props[hit] ?? {};
      const type = Array.isArray(def.type) ? def.type[0] : String(def.type ?? 'string');
      return { name: hit, type };
    }
  }
  return null;
}

export type RouteInput = {
  postalCode: string;
  items: string[];
  transport?: 'car' | 'bike' | 'foot';
  persona?: 'saver' | 'smart' | 'fast';
};

export type RouteOutcome = {
  ok: boolean;
  tool?: string;
  store?: string;
  total?: number;
  lines?: { label: string; value: string }[];
  raw?: any;
  error?: string;
  tools?: string[];
};

/**
 * Preise + Route für eine Produktliste abfragen.
 * Das passende Tool wird selbst gesucht ("plan_optimal_shopping_route").
 */
export async function planShoppingRoute(input: RouteInput): Promise<RouteOutcome> {
  const tools = await listTools();
  if (!tools.length) return { ok: false, error: 'no-tools' };

  const tool =
    tools.find((t) => /plan_optimal_shopping_route/i.test(t.name)) ??
    tools.find((t) => /route|plan|optim/i.test(t.name)) ??
    tools[0];
  const schema = tool?.inputSchema;

  const args: any = {};
  const zip = pickField(schema, ['postal_code', 'postalcode', 'plz', 'zip']);
  if (zip) args[zip.name] = input.postalCode;
  const items = pickField(schema, ['items', 'products', 'basket', 'list', 'shopping_list']);
  if (items) args[items.name] = input.items;
  const transport = pickField(schema, ['transport', 'mode', 'travel', 'vehicle']);
  if (transport) args[transport.name] = input.transport ?? 'car';
  const persona = pickField(schema, ['persona', 'strategy', 'profile']);
  if (persona) args[persona.name] = input.persona ?? 'smart';

  const res = await callTool(tool.name, args);
  if (!res.ok) return { ok: false, error: res.error, tools: tools.map((t) => t.name) };

  const data = res.data;
  const lines: { label: string; value: string }[] = [];
  let store: string | undefined;
  let total: number | undefined;

  /* Zahlen und Marktnamen grob aus der Antwort ziehen (Schema ist nicht fix). */
  const flat: { path: string; value: any }[] = [];
  const walk = (node: any, path: string, depth = 0) => {
    if (depth > 5 || node == null) return;
    if (typeof node !== 'object') {
      flat.push({ path, value: node });
      return;
    }
    for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, depth + 1);
  };
  walk(data, '');

  const money = flat.filter((f) => typeof f.value === 'number' && /(total|price|cost|eur|sum)/i.test(f.path));
  const names = flat.filter((f) => typeof f.value === 'string' && /(store|market|shop|name)/i.test(f.path) && f.value.length < 40);
  if (money.length) total = Math.min(...money.map((m) => Number(m.value)));
  if (names.length) store = String(names[0].value);

  for (const m of money.slice(0, 6)) lines.push({ label: m.path, value: `${Number(m.value).toFixed(2)} €` });
  for (const n of names.slice(0, 3)) lines.push({ label: n.path, value: String(n.value) });

  return { ok: true, tool: tool.name, store, total, lines, raw: data, tools: tools.map((t) => t.name) };
}

