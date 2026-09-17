/**
 * 3.2.1: Rezept aus einem Video-Link ziehen.
 *
 * Warum es vorher **nie** funktioniert hat (echte Ursachen, gefunden + behoben):
 *
 * 1. Die Untertitel-Adresse im YouTube-HTML ist **relativ**
 *    (`/api/timedtext?...`). Die App hat sie direkt geladen -> in React Native
 *    ergibt das "Network request failed", die Untertitel kamen also nie an.
 *    Jetzt wird die Adresse auf `https://www.youtube.com` ergänzt.
 * 2. „Zutaten/Schritte" wurde nur **zeilenweise** gesucht. Untertitel sind aber
 *    ein einziger langer Text (und Beschreibungen oft ein Absatz) -> 0 Zutaten,
 *    0 Schritte -> "kein Rezept". Jetzt wird zusätzlich nach **Sätzen**,
 *    **Abschnitten** ("Zutaten:", "Zubereitung:") und **Komma-Listen** getrennt.
 * 3. Es mussten **mindestens 2 Zutaten UND 2 Schritte** gefunden werden, sonst
 *    kam `null`. Jetzt reicht deutlich weniger, und wenn gar nichts passt,
 *    darf einmal die **KI (Gratis-Modelle)** den Text ordnen.
 *
 * Reihenfolge pro Video:
 *   Beschreibung + Untertitel holen -> lokal ordnen -> notfalls KI ordnen.
 */
import { aiRecipeFromText } from './ai';

export type VideoRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  source: string;
  language: string;
  /** 3.2.1: woher der Text kam (für die Hinweiszeile in der App). */
  textSource?: 'description' | 'captions' | 'mixed' | 'ai' | 'ai-captions';
  /** true = bitte einmal drüberschauen (Text war unklar). */
  needsReview?: boolean;
};

/** YouTube-ID aus allen üblichen Linkformen. */
export function youtubeId(url: string): string | null {
  const value = String(url ?? '').trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /\/shorts\/([A-Za-z0-9_-]{6,})/,
    /\/embed\/([A-Za-z0-9_-]{6,})/,
    /\/live\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = p.exec(value);
    if (m) return m[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'other';

export function platformOf(url: string): VideoPlatform {
  const u = String(url ?? '').toLowerCase();
  if (/youtu\.be|youtube\.com/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/instagram\.com/.test(u)) return 'instagram';
  return 'other';
}

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  'Accept-Language': 'de,en;q=0.8',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

/** Text aus einer JSON-Zeichenkette befreien (\n, \uXXXX, \" ...). */
function unescapeJson(raw: string): string {
  let out = String(raw ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  return out;
}

/**
 * Schneidet ein ausbalanciertes JSON-Objekt/-Array ab `fromIndex` heraus
 * (Anführungszeichen und Escapes werden beachtet).
 */
function sliceBalanced(text: string, fromIndex: number, open: string, close: string): string | null {
  const start = text.indexOf(open, fromIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonAt<T>(text: string, marker: string, open: string, close: string): T | null {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const slice = sliceBalanced(text, at + marker.length, open, close);
  if (!slice) return null;
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}

/** Untertitel-Adresse absolut machen und JSON-Escapes auflösen. */
export function absoluteCaptionUrl(rawUrl: string): string {
  let url = unescapeJson(String(rawUrl ?? '').replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
  return url;
}

/* ── YouTube: Beschreibung + Untertitel ──────────────────────────────────── */

type CaptionTrack = { baseUrl?: string; languageCode?: string; kind?: string; name?: any };

type YouTubeData = {
  title: string;
  description: string;
  captions: string;
  language: string;
  hasCaptions: boolean;
};

function trackName(track: CaptionTrack): string {
  return String(track?.name?.simpleText ?? track?.name?.runs?.[0]?.text ?? '');
}

/** Beste Spur wählen: gewünschte Sprachen, sonst erste (keine Automatik bevorzugt). */
function pickTrack(tracks: CaptionTrack[], langs: string[]): CaptionTrack | null {
  if (!tracks.length) return null;
  for (const lang of langs) {
    const exact = tracks.find((t) => String(t?.languageCode ?? '').toLowerCase().startsWith(lang));
    if (exact) return exact;
  }
  const manual = tracks.find((t) => String(t?.kind ?? '') !== 'asr');
  return manual ?? tracks[0];
}

/** Untertitel (json3 bevorzugt, XML als Reserve) in reinen Text wandeln. */
export async function captionText(track: CaptionTrack): Promise<string> {
  const base = absoluteCaptionUrl(String(track?.baseUrl ?? ''));
  if (!base) return '';
  const attempts: { url: string; fmt: 'json3' | 'xml' }[] = [
    { url: `${base}${base.includes('?') ? '&' : '?'}fmt=json3`, fmt: 'json3' },
    { url: base, fmt: 'xml' },
  ];
  for (const attempt of attempts) {
    try {
      const body = await fetch(attempt.url, { headers: BROWSER_HEADERS }).then((r) => r.text());
      if (!body) continue;
      const text = attempt.fmt === 'json3' ? textFromJson3(body) : textFromTimedText(body);
      if (text.trim()) return text;
    } catch {
      /* nächster Versuch */
    }
  }
  return '';
}

export function textFromJson3(body: string): string {
  try {
    const parsed = JSON.parse(body) as { events?: { segs?: { utf8?: string }[] }[] };
    const text = (parsed?.events ?? [])
      .flatMap((e) => (e?.segs ?? []).map((s) => String(s?.utf8 ?? '')))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  } catch {
    return '';
  }
}

export function textFromTimedText(xml: string): string {
  const withBreaks = String(xml ?? '').replace(/<\/text>/g, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' '))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Video-Daten von YouTube holen.
 * Der HTML-Weg ist der einzige, der ohne Schlüssel und ohne Konto funktioniert
 * (youtubei/timedtext sind für Server-Netze gesperrt).
 */
export async function fetchYouTube(id: string, langs: string[] = ['de', 'en']): Promise<YouTubeData | null> {
  let html = '';
  try {
    html = await fetch(`https://www.youtube.com/watch?v=${id}&hl=de`, { headers: BROWSER_HEADERS }).then((r) => r.text());
  } catch {
    return null;
  }
  if (!html) return null;

  const details = parseJsonAt<any>(html, '"videoDetails":', '{', '}');
  let title = String(details?.title ?? '');
  let description = String(details?.shortDescription ?? '');

  if (!title) {
    const meta = /<meta name="title" content="([^"]{2,200})"/.exec(html) ?? /<title>([^<]{2,200})<\/title>/.exec(html);
    title = decodeEntities(String(meta?.[1] ?? '').replace(/ - YouTube$/, ''));
  }
  if (!description) {
    const metaDesc =
      /<meta name="description" content="((?:[^"\\]|\\.)*)"/.exec(html) ??
      /<meta property="og:description" content="((?:[^"\\]|\\.)*)"/.exec(html);
    if (metaDesc?.[1]) description = decodeEntities(unescapeJson(metaDesc[1]));
  }
  if (!description) {
    const raw = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html);
    if (raw?.[1]) description = unescapeJson(raw[1]);
  }

  const listAt = html.indexOf('"captionTracks":');
  let tracks: CaptionTrack[] = [];
  if (listAt >= 0) {
    const slice = sliceBalanced(html, listAt + '"captionTracks":'.length, '[', ']');
    if (slice) {
      try {
        const parsed = JSON.parse(unescapeJson(slice).replace(/\\u0026/g, '&'));
        if (Array.isArray(parsed)) tracks = parsed as CaptionTrack[];
      } catch {
        /* Regex-Reserve unten */
      }
    }
  }
  if (!tracks.length) {
    const first = /"captionTracks":\[[^\]]*?"baseUrl":"([^"]+)"/.exec(html);
    if (first?.[1]) tracks = [{ baseUrl: first[1] }];
  }

  const track = pickTrack(tracks, langs);
  const captions = track ? await captionText(track) : '';
  return {
    title,
    description,
    captions,
    language: String(track?.languageCode ?? '') || (track ? trackName(track) : ''),
    hasCaptions: !!captions.trim(),
  };
}

/* ── TikTok / Instagram ───────────────────────────────────────────────────── */

/** TikTok: oEmbed liefert die Bildunterschrift ohne Login. */
async function tiktokText(url: string): Promise<{ text: string; title: string }> {
  let title = '';
  let text = '';
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { headers: BROWSER_HEADERS });
    const json: any = await res.json();
    title = String(json?.title ?? '');
    text = [title, String(json?.author_name ?? '')].filter(Boolean).join('\n');
  } catch {
    /* unten Meta-Tags */
  }
  if (!text.trim()) {
    const og = await openGraphText(url);
    return { text: og.text, title: title || og.title };
  }
  return { text, title };
}

/** Beschreibung + Titel aus den Meta-Tags einer beliebigen Seite. */
async function openGraphText(url: string): Promise<{ text: string; title: string }> {
  try {
    const html = await fetch(url, { headers: BROWSER_HEADERS }).then((r) => r.text());
    return textFromHtml(html);
  } catch {
    return { text: '', title: '' };
  }
}

export function textFromHtml(html: string): { text: string; title: string } {
  const ogDesc =
    /<meta\s+property="og:description"\s+content="((?:[^"\\]|\\.)*)"/i.exec(html) ??
    /<meta\s+name="description"\s+content="((?:[^"\\]|\\.)*)"/i.exec(html) ??
    /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/i.exec(html);
  const ogTitle =
    /<meta\s+property="og:title"\s+content="((?:[^"\\]|\\.)*)"/i.exec(html) ?? /<title>([^<]{2,200})<\/title>/i.exec(html);
  const text = [ogTitle?.[1], ogDesc?.[1]]
    .filter(Boolean)
    .map((s) => decodeEntities(unescapeJson(String(s))))
    .join('\n');
  return { text, title: decodeEntities(unescapeJson(String(ogTitle?.[1] ?? ''))) };
}

/**
 * Instagram: `/embed/captioned/` ist ohne Login abrufbar und enthält die
 * Bildunterschrift - bei Rezept-Videos steht dort der ganze Text.
 */
async function instagramText(url: string): Promise<{ text: string; title: string }> {
  const match = /\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  if (match) {
    try {
      const embed = await fetch(`https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`, {
        headers: BROWSER_HEADERS,
      }).then((r) => r.text());
      const caption =
        /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/.exec(embed) ??
        /class="Caption"[\s\S]{0,200}?>([\s\S]{10,4000}?)<\/(?:div|span)>/.exec(embed);
      if (caption?.[1]) {
        const text = decodeEntities(unescapeJson(String(caption[1]).replace(/<br\s*\/?>/gi, '\n')));
        if (text.trim()) return { text, title: '' };
      }
    } catch {
      /* Meta-Tags unten */
    }
  }
  return openGraphText(url);
}

/* ── Text -> Rezept ──────────────────────────────────────────────────────── */

const UNIT_WORDS =
  '(g|kg|mg|ml|l|cl|dl|gramm|kilo|liter|milliliter|tl|el|tsp|tbsp|cup|cups|tasse|tassen|stück|stueck|stk|prise|prisen|bund|dose|dosen|packung|päckchen|paekchen|packl|becher|scheiben|scheibe|zehen|zehe|cloves?|handful|pinch|esslöffel|teelöffel|el\\.|tl\\.)';

const AMOUNT_AT_START = new RegExp(
  `^(?:\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|ein(?:e|en)?|zwei|drei|vier|fünf|fuenf|sechs|halb(?:e)?|half)\\s*` +
    `(?:\\d+\\/\\d+\\s*)?(?:${UNIT_WORDS}\\b\\.?\\s*)?`,
  'i',
);

const COOKING_VERB =
  /(hinzu|dazugeben|dazugeb|misch|rühr|ruehr|koch|brat|back|schneid|wasch|schäl|schael|anbrat|dünst|duenst|gar|servier|zumisch|hinzugeb|erhitz|abschmeck|bestreu|verteil|gieß|giess|leg|stell|füll|fuell|knet|mix|pürier|puerier|würz|wuerz|abkühl|abkuehl|ziehen lassen|durchziehen|vermeng|verrühr|verruehr|tropf|tupf|röste|roeste|dampf|frittier|reduzier|ablösch|abloesch|streu|schöp|schoep|wende|grill|marinier|auftrag|bestreich|garnier|zerkleiner|zerdrück|zerdrueck|schwenk|zufüg|zufueg|add|mix|stir|cook|fry|bake|chop|heat|simmer|serve|pour|whisk|season|place|combine|sauté|saute|drain|fold|preheat|transfer|cover|pour|repeat|sprinkle|caramelize|reduce|remove|knead|wrap|chill|assemble|dust|brush)/i;

const INGREDIENT_HEADING = /^(zutaten|zutatenliste|ingredients|ingredient|was du brauchst|du brauchst|you need|für den teig|fuer den teig|teig|füllung|fuellung|filling|topping|guss|glasur|sauce|soße|sosse|marinade|dressing)/i;
const STEP_HEADING = /^(zubereitung|anleitung|schritte|arbeitsschritte|so geht'?s|so gehst du vor|methode|method|instructions?|steps?|directions?|vorgehen|rezept|recipe|preparation|how to)/i;

/** Absätze/Zeilen/Sätze/Komma-Stücke in einzelne Kandidaten zerlegen. */
export function toSegments(text: string): string[] {
  return String(text ?? '')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[•●▪·*]/g, '\n')
    .replace(/([.!?])\s+(?=[A-ZÄÖÜ0-9])/g, '$1\n')
    // Automatik-Untertitel haben oft keine Satzzeichen - Übergangswörter helfen.
    .replace(/\s+(?:dann|danach|anschließend|anschliessend|zum schluss|nun|daraufhin|zuerst|now|then|next|finally|afterwards|first)\s+/gi, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/\s*[–—]\s*/g, ' ')
        .replace(/\(\s*(?:ca\.?|approx\.?)?\s*\d+[^)]*\)/gi, ' ')
        .trim(),
    )
    .flatMap((line) => (line.length > 90 && line.includes(',') ? line.split(/,\s*(?=[\dA-ZÄÖÜ])/g) : [line]))
    .map((line) => line.replace(/\s+/g, ' ').replace(/^[-–—:]+/, '').trim())
    .filter((line) => line.length > 1);
}

const hasAmount = (segment: string) => AMOUNT_AT_START.test(segment) || new RegExp(`\\b\\d+([.,]\\d+)?\\s*${UNIT_WORDS}\\b`, 'i').test(segment);

/**
 * Zutaten und Schritte aus Beschreibung/Untertiteln holen.
 *
 * Neu in 3.2.1: Abschnitte ("Zutaten:", "Zubereitung:"), Sätze und
 * Komma-Listen werden erkannt - vorher wurde nur zeilenweise gesucht und
 * Untertitel bestehen aus einer einzigen langen Zeile.
 */
export function parseRecipeFromText(text: string): { ingredients: string[]; steps: string[] } {
  const segments = toSegments(text);
  const ingredients: string[] = [];
  const steps: string[] = [];
  const seenIng = new Set<string>();
  const seenStep = new Set<string>();
  let section: 'none' | 'ingredients' | 'steps' = 'none';

  const pushIngredient = (raw: string) => {
    const clean = raw.replace(/\s+/g, ' ').replace(/^[-–—:]+/, '').replace(/[.!]+$/, '').trim();
    if (clean.length < 2 || clean.length > 70) return;
    if (COOKING_VERB.test(clean)) return;
    const key = clean.toLowerCase();
    if (seenIng.has(key)) return;
    seenIng.add(key);
    ingredients.push(clean);
  };

  const pushStep = (raw: string) => {
    const clean = raw.replace(/\s+/g, ' ').replace(/^\s*\d+[.)]\s*/, '').trim();
    if (clean.length < 10 || clean.length > 400) return;
    const key = clean.toLowerCase();
    if (seenStep.has(key)) return;
    seenStep.add(key);
    steps.push(clean.charAt(0).toUpperCase() + clean.slice(1));
  };

  for (const segment of segments) {
    if (segment.length < 2) continue;
    const withoutNumber = segment.replace(/^\d+[.)]\s*/, '');
    if (INGREDIENT_HEADING.test(withoutNumber) && withoutNumber.length < 40) {
      section = 'ingredients';
      continue;
    }
    if (STEP_HEADING.test(withoutNumber) && withoutNumber.length < 40) {
      section = 'steps';
      continue;
    }

    const numbered = /^\d+[.)]\s+/.test(segment);
    const amount = hasAmount(segment);
    const words = segment.split(/\s+/).length;
    const verb = COOKING_VERB.test(segment);

    /* Zutaten-Stücke auch mitten im Satz herausfischen
       ("... zuerst 500 g Mehl in eine Schüssel ...", "250 ml Wasser dazugeben"). */
    if (segment.length > 25) {
      const snippets = segment.match(
        new RegExp(`\\d+(?:[.,]\\d+)?\\s*${UNIT_WORDS}\\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9-]{2,20}`, 'gi'),
      );
      for (const snippet of snippets ?? []) pushIngredient(snippet);
    }

    if (section === 'steps' || (numbered && !amount) || (verb && words >= 4 && !amount)) {
      pushStep(segment);
      continue;
    }
    if (amount && words <= 14 && !verb) {
      pushIngredient(segment);
      if (section === 'none') section = 'ingredients';
      continue;
    }
    if (section === 'ingredients' && words <= 8 && !verb) {
      pushIngredient(segment);
      continue;
    }
    if (words >= 5 && verb) pushStep(segment);
    if (ingredients.length >= 40 && steps.length >= 30) break;
  }

  return { ingredients: ingredients.slice(0, 40), steps: steps.slice(0, 30) };
}

/* ── Ablauf: Link -> Rezept ──────────────────────────────────────────────── */

const isUsable = (found: { ingredients: string[]; steps: string[] }) =>
  (found.ingredients.length >= 2 && found.steps.length >= 1) ||
  (found.ingredients.length >= 1 && found.steps.length >= 2);

/**
 * 3.3.0: Typische „Video-Müll"-Zeilen erkennen — Abo-Aufrufe, Links, Hashtags,
 * Werbung, Zeitstempel. Solche Zeilen dürfen nicht als Zutat oder Schritt im
 * Rezept landen (das war der Hauptgrund, warum die Video-Erkennung „tot" wirkte).
 */
export function isJunkLine(line: string): boolean {
  const s = String(line ?? '').trim();
  if (!s) return true;
  if (/https?:\/\/|www\.|\.com|\.de\b|\.net|bit\.ly|youtu\.be/i.test(s)) return true;
  if (/(^|\s)#[^\s#]+/.test(s)) return true;
  if (/^\s*\d{1,2}:\d{2}/.test(s)) return true;                       /* 00:42 Zeitstempel */
  if (/[❤️🔥👌😍👇🙏✅💯]/u.test(s)) return true;
  return /(subscribe|abonnier|abonniert|kanal|channel|follow (me|us)|folge mir|like (this|the) video|daumen hoch|teile das video|share (this|the) video|bewert|kommentier|comment below|schreib.*kommentar|glocke|bell icon|benachrichtigung|notification|link in (the )?bio|link in der beschreibung|bio|patreon|sponsor|werbung|ad\b|giveaway|gewinnspiel|rabattcode|discount code|watch (the )?full|ganzes video|thanks for watching|danke f.rs zuschauen|bis zum n.chsten|see you (next|in)|new video|playlist)/i.test(s);
}

/** Zutaten-/Schritt-Zeilen von Video-Müll befreien. */
export function cleanJunkLines(lines: string[]): string[] {
  return lines.map((l) => String(l ?? '').trim()).filter((l) => l && !isJunkLine(l));
}

/**
 * 3.2.3: Zutaten aus dem Video und von der KI zusammenführen — die Video-Angaben
 * gewinnen, die KI füllt nur auf, was dort fehlt.
 */
export function mergeIngredients(video: string[], ai: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß ]/g, ' ').replace(/\s+/g, ' ').trim();
  const add = (raw: string) => {
    const value = raw.trim();
    const key = norm(value);
    if (!key || seen.has(key)) return;
    if (out.some((existing) => norm(existing).includes(key) || key.includes(norm(existing)))) return;
    seen.add(key);
    out.push(value);
  };
  video.forEach(add);
  ai.forEach(add);
  return out.slice(0, 40);
}

/**
 * Rezept aus einem Video-Link ziehen.
 *
 * `null` gibt es nur noch, wenn wirklich kein Text zu holen war (Link falsch,
 * Video ohne Beschreibung/Untertitel). Sonst kommt immer ein Ergebnis zurück -
 * notfalls als „bitte prüfen" (`needsReview`).
 */
export async function recipeFromVideo(
  url: string,
  opts: { languages?: string[]; allowAi?: boolean } = {},
): Promise<VideoRecipe | null> {
  const link = String(url ?? '').trim();
  if (!link) return null;
  const platform = platformOf(link);
  const langs = (opts.languages ?? []).filter(Boolean);
  const languagePrefs = langs.length ? langs : ['de', 'en'];
  const allowAi = opts.allowAi !== false;

  let text = '';
  let title = '';
  let language = '';
  let origin: 'description' | 'captions' | 'mixed' = 'description';
  let source = link;

  try {
    if (platform === 'youtube') {
      const id = youtubeId(link);
      if (!id) return null;
      source = `https://www.youtube.com/watch?v=${id}`;
      const data = await fetchYouTube(id, languagePrefs);
      if (!data) return null;
      title = data.title;
      language = data.language;
      const hasDescription = !!data.description.trim();
      const hasCaptions = !!data.captions.trim();
      text = [data.description, data.captions].filter((part) => part.trim()).join('\n\n');
      origin = hasDescription && hasCaptions ? 'mixed' : hasCaptions ? 'captions' : 'description';
    } else if (platform === 'tiktok') {
      const tt = await tiktokText(link);
      text = tt.text;
      title = tt.title;
    } else if (platform === 'instagram') {
      const ig = await instagramText(link);
      text = ig.text;
      title = ig.title;
    } else {
      const og = await openGraphText(link);
      text = og.text;
      title = og.title;
    }
  } catch {
    return null;
  }

  if (!text.trim()) return null;

  const local = parseRecipeFromText(text);

  /**
   * 3.3.0: Video-Text sauber machen. Beschreibungen enthalten fast immer Dinge,
   * die kein Rezept sind (Abo-Aufrufe, Links, Hashtags, Werbung). Diese Zeilen
   * fliegen raus, und wenn etwas gefunden wurde, ordnet die KI den Text noch
   * einmal komplett — so landen keine Fremdsätze als Zutat/Schritt im Rezept.
   */
  const cleaned = {
    ingredients: cleanJunkLines(local.ingredients),
    steps: cleanJunkLines(local.steps),
  };
  const junkFound = cleaned.ingredients.length !== local.ingredients.length || cleaned.steps.length !== local.steps.length;
  const tooFewSteps = cleaned.ingredients.length >= 2 && cleaned.steps.length < 3;
  const aiAvailable = allowAi && text.trim().length >= 120;

  /**
   * 3.2.3/3.3.0: Die KI ergänzt zu kurze Rezepte (typisch bei Reels) und räumt
   * Text auf. Die Zutaten aus dem Video bleiben dabei erhalten.
   */
  if ((tooFewSteps || junkFound) && aiAvailable) {
    const structured = await aiRecipeFromText({ title, text }).catch(() => null);
    if (structured && structured.steps.length >= 2) {
      const ingredients = mergeIngredients(cleaned.ingredients, structured.ingredients);
      return {
        title: structured.title || title || ingredients[0] || structured.steps[0].slice(0, 60),
        ingredients,
        steps: structured.steps,
        source,
        language,
        textSource: 'ai',
        needsReview: ingredients.length < 3,
      };
    }
  }

  if (isUsable(cleaned)) {
    return {
      title: title || cleaned.ingredients[0] || cleaned.steps[0].slice(0, 60),
      ingredients: cleaned.ingredients,
      steps: cleaned.steps,
      source,
      language,
      textSource: origin,
      needsReview: cleaned.ingredients.length < 3,
    };
  }

  /* Notfall: die KI (Gratis-Modelle) ordnet den Text. */
  if (allowAi && text.trim().length >= 200) {
    const structured = await aiRecipeFromText({ title, text }).catch(() => null);
    if (structured && structured.ingredients.length && structured.steps.length) {
      return {
        title: structured.title || title || structured.ingredients[0],
        ingredients: structured.ingredients,
        steps: structured.steps,
        source,
        language,
        textSource: 'ai',
        needsReview: true,
      };
    }
  }

  /* Immer noch nichts? Dann wenigstens den Text zeigen statt "kein Rezept". */
  const lines = toSegments(text)
    .filter((line) => line.length >= 12 && line.length <= 200)
    .slice(0, 25);
  if (lines.length >= 4) {
    return {
      title: title || lines[0].slice(0, 60),
      ingredients: local.ingredients,
      steps: local.steps.length ? local.steps : lines,
      source,
      language,
      textSource: origin,
      needsReview: true,
    };
  }

  return null;
}




