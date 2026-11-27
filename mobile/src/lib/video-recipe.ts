

import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiRecipeFromText } from './ai';
import { supabase } from './supabase';

export type VideoRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  source: string;
  language: string;
  
  textSource?: 'description' | 'captions' | 'mixed' | 'ai' | 'ai-captions';
  
  needsReview?: boolean;
};

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

/** TikTok keeps the whole caption in its page JSON as "desc". */
export function tiktokCaption(html: string): string {
  const at = html.indexOf('"desc":"');
  if (at < 0) return '';
  return decodeEntities(readJsonStringField(html, at + '"desc":'.length)).trim();
}

/**
 * The page is fetched on the server: TikTok and YouTube send no CORS headers,
 * so in the browser the app cannot read their captions at all.
 */
async function videoMetaFromServer(link: string): Promise<{ text: string; title: string; url: string } | null> {
  try {
    const call = supabase.functions.invoke('ai', { body: { video: link } });
    const timeout = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 20_000),
    );
    const { data, error } = await Promise.race([call as any, timeout]);
    if (error) return null;
    const text = String((data as any)?.text ?? '').trim();
    if (!text) return null;
    return { text, title: String((data as any)?.title ?? ''), url: String((data as any)?.url ?? link) };
  } catch {
    return null;
  }
}

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

export function absoluteCaptionUrl(rawUrl: string): string {
  let url = unescapeJson(String(rawUrl ?? '').replace(/\\(u0026|\/)/g, (_m: string, code: string) => (code === 'u0026' ? '&' : '/')));
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) url = `https://www.youtube.com${url}`;
  return url;
}

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

function pickTrack(tracks: CaptionTrack[], langs: string[]): CaptionTrack | null {
  if (!tracks.length) return null;
  for (const lang of langs) {
    const exact = tracks.find((t) => String(t?.languageCode ?? '').toLowerCase().startsWith(lang));
    if (exact) return exact;
  }
  const manual = tracks.find((t) => String(t?.kind ?? '') !== 'asr');
  return manual ?? tracks[0];
}

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
    } catch {}
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
      } catch {}
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


async function tiktokText(url: string): Promise<{ text: string; title: string }> {
  let title = '';
  let text = '';
  let canonical = url;

  // oEmbed often returns no title at all, so the caption is read from the
  // video page itself, where TikTok stores it as "desc".
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    canonical = String((res as any)?.url || url);
    const caption = tiktokCaption(await res.text());
    if (caption) {
      const firstLine = caption.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? '';
      return { text: caption, title: firstLine.slice(0, 120) };
    }
  } catch {
  }

  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`, { headers: BROWSER_HEADERS });
    const json: any = await res.json();
    title = String(json?.title ?? '');
    text = [title, String(json?.author_name ?? '')].filter(Boolean).join('\n');
  } catch {
  }
  if (!text.trim()) {
    const og = await openGraphText(url);
    return { text: og.text, title: title || og.title };
  }
  return { text, title };
}

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
    } catch {}
  }
  return openGraphText(url);
}

const UNIT_WORDS =
  '(g|kg|mg|ml|l|cl|dl|gramm|kilo|liter|milliliter|tl|el|tsp|tbsp|cup|cups|tasse|tassen|stück|stueck|stk|prise|prisen|bund|dose|dosen|packung|päckchen|paekchen|packl|becher|scheiben|scheibe|zehen|zehe|cloves?|handful|pinch|esslöffel|teelöffel|el\\.|tl\\.)';

const AMOUNT_AT_START = new RegExp(
  `^(?:\\d+(?:[.,]\\d+)?(?:\\s*(?:-|–|bis|to)\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\/\\d+|ein(?:e|en)?|zwei|drei|vier|fünf|fuenf|sechs|halb(?:e)?|half)\\s*` +
    `(?:${UNIT_WORDS}\\b\\.?\\s*)?`,
  'i',
);

const COOKING_VERB =
  /(hinzu|dazugeben|dazugeb|misch|rühr|ruehr|koch|brat|back|schneid|wasch|schäl|schael|anbrat|dünst|duenst|gar|servier|zumisch|hinzugeb|erhitz|abschmeck|bestreu|verteil|gieß|giess|leg|stell|füll|fuell|knet|mix|pürier|puerier|würz|wuerz|abkühl|abkuehl|ziehen lassen|durchziehen|vermeng|verrühr|verruehr|tropf|tupf|röste|roeste|dampf|frittier|reduzier|ablösch|abloesch|streu|schöp|schoep|wende|grill|marinier|auftrag|bestreich|garnier|zerkleiner|zerdrück|zerdrueck|schwenk|zufüg|zufueg|add|mix|stir|cook|fry|bake|chop|heat|simmer|serve|pour|whisk|season|place|combine|sauté|saute|drain|fold|preheat|transfer|cover|pour|repeat|sprinkle|caramelize|reduce|remove|knead|wrap|chill|assemble|dust|brush)/i;

const INGREDIENT_HEADING =
  /^(zutaten|zutatenliste|ingredients|ingredient|was du brauchst|du brauchst|you need|für den teig|fuer den teig|teig|für die füllung|für die fuellung|für die sauce|für das dressing|für den belag|für den boden|füllung|fuellung|filling|topping|belag|guss|glasur|streusel|sauce|soße|sosse|marinade|dressing|crust|boden|für den guss)/i;
const STEP_HEADING =
  /^(zubereitung|anleitung|schritte|arbeitsschritte|so geht'?s|so wird'?s|so gehst du vor|los geht'?s|schritt für schritt|methode|method|instructions?|steps?|directions?|vorgehen|rezept|recipe|preparation|how to|how i make|cooking)/i;

const FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

export function normalizeQuantities(text: string): string {
  let out = String(text ?? '');
  out = out.replace(/(\d)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/g, (_m, whole: string, frac: string) => `${whole} ${FRACTIONS[frac]}`);
  out = out.replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (f) => FRACTIONS[f]);
  out = out.replace(/(\d+)\s+(\d+)\/(\d+)/g, (m, whole: string, num: string, den: string) => {
    const value = Number(whole) + Number(num) / Number(den);
    return Number.isFinite(value) && Number(den) ? String(Math.round(value * 100) / 100) : m;
  });
  out = out.replace(/(\d+)\/(\d+)/g, (m, num: string, den: string) => {
    const value = Number(num) / Number(den);
    return Number.isFinite(value) && Number(den) ? String(Math.round(value * 100) / 100) : m;
  });
  return out.replace(/(\d)\s+(?:bis|to)\s+(\d)\s*(?=[A-Za-zÄÖÜäöüß])/g, '$1-$2');
}

export function toSegments(text: string): string[] {
  return normalizeQuantities(text)
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[•●▪·*▢◻□✓✔→]/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .replace(/([.!?])\s+(?=[A-ZÄÖÜ0-9])/g, '$1\n')
    .replace(
      /\s+(?:und dann|und danach|und anschließend|und anschliessend|dann|danach|anschließend|anschliessend|zum schluss|nun|daraufhin|zuerst|als nächstes|now|then|next|finally|afterwards|first|and then|after that)\s+/gi,
      '\n',
    )
    .split('\n')
    .map((line) =>
      line
        .replace(/(^|\D)\s*[-–]\s*(?=\D|$)/g, '$1 ')
        .replace(/\(\s*(?:ca\.?|approx\.?)?\s*\d+[^)]*\)/gi, ' ')
        .trim(),
    )
    .flatMap((line) => (line.length > 90 && line.includes(',') ? line.split(/,\s*(?=[\dA-ZÄÖÜ])/g) : [line]))
    .map((line) => line.replace(/\s+/g, ' ').replace(/^[-–:]+/, '').trim())
    .filter((line) => line.length > 1);
}

const hasAmount = (segment: string) => AMOUNT_AT_START.test(segment) || new RegExp(`\\b\\d+([.,]\\d+)?\\s*${UNIT_WORDS}\\b`, 'i').test(segment);

export function parseRecipeFromText(text: string): { ingredients: string[]; steps: string[] } {
  const segments = toSegments(text);
  const ingredients: string[] = [];
  const steps: string[] = [];
  const seenIng = new Set<string>();
  const seenStep = new Set<string>();
  let section: 'none' | 'ingredients' | 'steps' = 'none';

  const pushIngredient = (raw: string) => {
    const clean = raw.replace(/\s+/g, ' ').replace(/^[-–:]+/, '').replace(/[.!]+$/, '').trim();
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


const isUsable = (found: { ingredients: string[]; steps: string[] }) =>
  (found.ingredients.length >= 2 && found.steps.length >= 1) ||
  (found.ingredients.length >= 1 && found.steps.length >= 2);

export function isJunkLine(line: string): boolean {
  const s = String(line ?? '').trim();
  if (!s) return true;
  if (/https?:\/\/|www\.|\.com|\.de\b|\.net|bit\.ly|youtu\.be/i.test(s)) return true;
  if (/(^|\s)#[^\s#]+/.test(s)) return true;
  if (/^\s*\d{1,2}:\d{2}/.test(s)) return true;  if (/[❤️🔥👌😍👇🙏✅💯]/u.test(s)) return true;
  return /(subscribe|abonnier|abonniert|kanal|channel|follow (me|us)|folge mir|like (this|the) video|daumen hoch|teile das video|share (this|the) video|bewert|kommentier|comment below|schreib.*kommentar|glocke|bell icon|benachrichtigung|notification|abos?\b|abonn|liket|like das video|knacken|follower|link in (the )?bio|link in der beschreibung|bio|patreon|sponsor|werbung|ad\b|giveaway|gewinnspiel|rabattcode|discount code|watch (the )?full|ganzes video|thanks for watching|danke f.rs zuschauen|bis zum n.chsten|see you (next|in)|new video|playlist)/i.test(s);
}

export function cleanJunkLines(lines: string[]): string[] {
  return lines.map((l) => String(l ?? '').trim()).filter((l) => l && !isJunkLine(l));
}

export function craftTitle(raw: string, fallback = ''): string {
  const source = String(raw ?? '');
  const parts = source
    .split(/[|•·>»«–-]|\s{2,}|\s-\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  const cleaned = parts
    .map((part) =>
      part
        .replace(/#[^\s#]+/g, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/[\u2190-\u21FF\u2600-\u27BF\uFE0F\uD83C-\uDBFF\uDC00-\uDFFF]/g, ' ')
        .replace(/\b(rezept|recipe|rezepte|recipes|shorts?|video|vlog|tutorial|subscribe|abonnieren)\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((part) => part.replace(/[^A-Za-z\u00C0-\u024F\u0600-\u06FF]/g, '').length >= 4);

  const best = cleaned.find((part) => !isJunkLine(part)) ?? cleaned[0] ?? '';
  const tidy = best.replace(/\s{2,}/g, ' ').trim();
  if (!tidy) return String(fallback ?? '').trim();
  const letters = tidy.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
  const shouty = letters.length > 6 && letters === letters.toUpperCase();
  const normal = shouty ? tidy.charAt(0).toUpperCase() + tidy.slice(1).toLowerCase() : tidy.charAt(0).toUpperCase() + tidy.slice(1);
  return normal.slice(0, 70);
}

export function mergeIngredients(video: string[], ai: string[]): string[] {
  const out: string[] = [];
  const norm = (s: string) =>
    s.toLowerCase().replace(/\d+([.,]\d+)?/g, ' ').replace(/[^a-z0-9äöüß ]/g, ' ').replace(/\s+/g, ' ').trim();
  const add = (raw: string) => {
    const value = String(raw ?? '').trim();
    if (!value || isJunkLine(value)) return;
    const key = norm(value);
    if (!key) return;
    const near = out.findIndex((existing) => {
      const other = norm(existing);
      return other === key || (other && (other.includes(key) || key.includes(other)));
    });
    if (near >= 0) {
      if (!hasAmount(out[near]) && hasAmount(value)) out[near] = value;
      return;
    }
    out.push(value);
  };
  video.forEach(add);
  ai.forEach(add);
  return out.slice(0, 40);
}

export type VideoFailure = 'no-link' | 'no-text' | 'no-recipe';

export type VideoResult = { recipe: VideoRecipe | null; reason?: VideoFailure; cached?: boolean };

// v2: v1 entries were built from empty metadata (TikTok without CORS).
const CACHE_PREFIX = 'spoonful:video-recipe:v2:';

export const VIDEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export function videoCacheKey(link: string): string {
  const value = String(link ?? '').trim();
  const id = youtubeId(value);
  if (id) return `${CACHE_PREFIX}yt:${id}`;
  const clean = value.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  return CACHE_PREFIX + clean;
}

export async function readVideoCache(link: string): Promise<VideoRecipe | null> {
  try {
    const raw = await AsyncStorage.getItem(videoCacheKey(link));
    if (!raw) return null;
    const hit = JSON.parse(raw) as { at?: number; recipe?: VideoRecipe };
    if (!hit || typeof hit.at !== 'number' || Date.now() - hit.at > VIDEO_CACHE_TTL) return null;
    const recipe = hit.recipe;
    if (!recipe || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) return null;
    if (!recipe.ingredients.length || !recipe.steps.length) return null;
    return recipe;
  } catch {
    return null;
  }
}

export async function writeVideoCache(link: string, recipe: VideoRecipe): Promise<void> {
  try {
    await AsyncStorage.setItem(videoCacheKey(link), JSON.stringify({ at: Date.now(), recipe }));
  } catch {}
}

type ComposeInput = {
  text: string;
  title: string;
  source: string;
  language: string;
  origin: 'description' | 'captions' | 'mixed';
};

async function composeRecipe(input: ComposeInput, allowAi: boolean): Promise<VideoRecipe | null> {
  const text = String(input.text ?? '');
  const local = parseRecipeFromText(text);
  const cleaned = {
    ingredients: cleanJunkLines(local.ingredients),
    steps: cleanJunkLines(local.steps),
  };
  const tag = { source: input.source, language: input.language };

  // The description is the source of truth: it is handed to the AI untouched,
  // before the local heuristic parser can cut it into lines and lose amounts.
  if (allowAi && text.trim().length >= 60) {
    const structured = await aiRecipeFromText({ title: input.title, text }).catch(() => null);
    if (structured && structured.steps.length >= 2) {
      const ingredients = mergeIngredients(cleaned.ingredients, structured.ingredients);
      return {
        title:
          structured.title ||
          craftTitle(input.title, ingredients[0] ?? '') ||
          structured.steps[0].slice(0, 60),
        ingredients,
        steps: structured.steps,
        ...tag,
        textSource: 'ai',
        needsReview: ingredients.length < 3,
      };
    }
  }

  if (isUsable(cleaned)) {
    return {
      title: craftTitle(input.title, cleaned.ingredients[0] ?? '') || cleaned.steps[0].slice(0, 60),
      ingredients: cleaned.ingredients,
      steps: cleaned.steps,
      ...tag,
      textSource: input.origin,
      needsReview: cleaned.ingredients.length < 3,
    };
  }

  const lines = toSegments(text)
    .filter((line) => line.length >= 12 && line.length <= 200)
    .slice(0, 25);
  if (lines.length >= 4) {
    return {
      title: craftTitle(input.title, lines[0]) || lines[0].slice(0, 60),
      ingredients: local.ingredients,
      steps: local.steps.length ? local.steps : lines,
      ...tag,
      textSource: input.origin,
      needsReview: true,
    };
  }

  return null;
}

export async function recipeFromText(args: {
  text: string;
  title?: string;
  allowAi?: boolean;
}): Promise<VideoRecipe | null> {
  const raw = String(args?.text ?? '').trim();
  if (raw.length < 20) return null;
  return composeRecipe(
    { text: raw, title: String(args?.title ?? ''), source: 'pasted-text', language: '', origin: 'description' },
    args?.allowAi !== false,
  );
}

export async function recipeFromVideo(
  url: string,
  opts: { languages?: string[]; allowAi?: boolean; reason?: { value?: VideoFailure } } = {},
): Promise<VideoRecipe | null> {
  const fail = (reason: VideoFailure): null => {
    if (opts.reason) opts.reason.value = reason;
    return null;
  };
  const link = String(url ?? '').trim();
  if (!link) return fail('no-link');
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
    // Server first for everything but YouTube: reliable in the browser, where
    // the platforms' pages cannot be read because they send no CORS headers.
    if (platform !== 'youtube') {
      const meta = await videoMetaFromServer(link);
      if (meta) {
        text = meta.text;
        title = meta.title;
        source = meta.url || link;
      }
    }
    if (!text.trim() && platform === 'youtube') {
      const id = youtubeId(link);
      if (!id) return fail('no-link');
      source = `https://www.youtube.com/watch?v=${id}`;
      const data = await fetchYouTube(id, languagePrefs);
      if (!data) return fail('no-text');
      title = data.title;
      language = data.language;
      const hasDescription = !!data.description.trim();
      const hasCaptions = !!data.captions.trim();
      text = [data.description, data.captions].filter((part) => part.trim()).join('\n\n');
      origin = hasDescription && hasCaptions ? 'mixed' : hasCaptions ? 'captions' : 'description';
    } else if (!text.trim() && platform === 'tiktok') {
      const tt = await tiktokText(link);
      text = tt.text;
      title = tt.title;
    } else if (!text.trim() && platform === 'instagram') {
      const ig = await instagramText(link);
      text = ig.text;
      title = ig.title;
    } else if (!text.trim()) {
      const og = await openGraphText(link);
      text = og.text;
      title = og.title;
    }
  } catch {
    text = '';
  }

  if (!text.trim()) {
    const meta = await videoMetaFromServer(link);
    if (meta) {
      text = meta.text;
      title = meta.title || title;
      source = meta.url || link;
      origin = 'description';
    }
  }

  if (!text.trim()) return fail('no-text');

  const recipe = await composeRecipe({ text, title, source, language, origin }, allowAi);
  return recipe ?? fail('no-recipe');
}

export async function recipeFromVideoDetailed(
  url: string,
  opts: { languages?: string[]; allowAi?: boolean; useCache?: boolean } = {},
): Promise<VideoResult> {
  const link = String(url ?? '').trim();
  if (!link) return { recipe: null, reason: 'no-link' };
  if (opts.useCache !== false) {
    const hit = await readVideoCache(link);
    if (hit) return { recipe: hit, cached: true };
  }
  const reason: { value?: VideoFailure } = {};
  const recipe = await recipeFromVideo(link, { ...opts, reason });
  if (recipe) {
    void writeVideoCache(link, recipe);
    return { recipe };
  }
  return { recipe: null, reason: reason.value ?? 'no-recipe' };
}
