/**
 * 3.2.0: Rezept aus einem Video-Link ziehen — **ohne KI**, also ohne Kosten.
 *
 * Ablauf: YouTube-Link → Seite holen → Untertitel-Spur finden → Untertitel
 * laden → Zutaten und Schritte aus dem Text herausfiltern. Findet sich kein
 * Rezept, kommt `null` zurück ("im Video ist kein Rezept").
 *
 * Es wird KEIN Guthaben verbraucht: hier läuft kein Sprachmodell.
 */

export type VideoRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  source: string;
  language: string;
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
  let out = String(raw ?? '').replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  return out;
}

/**
 * Quelle für ein Video holen: **Untertitel UND Beschreibung**.
 * Die Beschreibung enthält bei Kochvideos fast immer das Rezept - sie ist
 * damit der zuverlässigste Weg, auch wenn es keine Untertitel gibt.
 */
async function fetchTranscript(id: string): Promise<{ text: string; title: string; language: string } | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    'Accept-Language': 'de,en;q=0.8',
  };
  const page = await fetch(`https://www.youtube.com/watch?v=${id}&hl=de`, { headers }).then((r) => r.text());
  const titleMatch =
    /"title":"([^"]{2,160})"/.exec(page) ?? /<meta name="title" content="([^"]{2,160})"/.exec(page) ?? /<title>([^<]{2,160})<\/title>/.exec(page);
  const title = decodeEntities(String(titleMatch?.[1] ?? '').replace(/ - YouTube$/, ''));

  /* Beschreibung (JSON oder Meta-Tag) */
  let description = '';
  const jsonDesc = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(page);
  if (jsonDesc?.[1]) description = unescapeJson(jsonDesc[1]);
  else {
    const metaDesc =
      /<meta name="description" content="([^"]*)"/.exec(page) ?? /<meta property="og:description" content="([^"]*)"/.exec(page);
    if (metaDesc?.[1]) description = decodeEntities(unescapeJson(metaDesc[1]));
  }

  /* Untertitel (erste Spur, bevorzugt keine Automatik-Untertitel) */
  let captions = '';
  let language = '';
  const tracks = [...page.matchAll(/"baseUrl":"([^"]+)"[^}]*?"languageCode":"([^"]*)"([^}]*)/g)];
  const single = /"captionTracks":\[[^\]]*?"baseUrl":"([^"]+)"/.exec(page);
  const track = tracks.length ? tracks.find((t) => !/kind":"asr/.test(t[3] ?? '')) ?? tracks[0] : null;
  const captionUrl = track ? track[1] : single ? single[1] : '';
  if (captionUrl) {
    language = track ? String(track[2] ?? '') : '';
    try {
      const xml = await fetch(decodeEntities(captionUrl.replace(/\\u0026/g, '&')), { headers }).then((r) => r.text());
      captions = plainFromTimedText(xml);
    } catch {
      captions = '';
    }
  }

  const text = [description, captions].filter((part) => part && part.length > 0).join('\n');
  if (!text.trim()) return null;
  return { text, title, language };
}

function plainFromTimedText(xml: string): string {
  const withBreaks = xml.replace(/<\/text>/g, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' '))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

const UNIT_WORDS =
  '(g|kg|ml|l|cl|dl|gramm|kilo|liter|milliliter|tl|el|tsp|tbsp|cup|cups|tasse|tassen|stück|stueck|stk|prise|prisen|bund|dose|dosen|packung|päckchen|paekchen|becher|scheiben|scheibe|zehen|zehe|cloves?|handful|pinch)';

/** Zutaten und Schritte aus dem Untertitel-Text filtern. */
export function parseRecipeFromText(text: string): { ingredients: string[]; steps: string[] } {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*·]\s*/, '').trim())
    .filter((l) => l.length > 2);

  const ingredients: string[] = [];
  const seenIng = new Set<string>();
  const ingredientRe = new RegExp(`^\\d+([.,]\\d+)?\\s*${UNIT_WORDS}?\\b|^\\d+/\\d+\\s|${UNIT_WORDS}\\b`, 'i');
  for (const line of lines) {
    const words = line.split(/\s+/).length;
    if (words > 9) continue;
    if (!ingredientRe.test(line)) continue;
    const clean = line.replace(/\s+/g, ' ').replace(/[.!]+$/, '');
    const key = clean.toLowerCase();
    if (seenIng.has(key)) continue;
    seenIng.add(key);
    ingredients.push(clean);
    if (ingredients.length >= 30) break;
  }

  const steps: string[] = [];
  const stepVerbRe =
    /(hinzu|dazugeben|mischen|rühren|ruehren|kochen|braten|backen|schneiden|waschen|schälen|schaelen|anbraten|dünsten|duensten|garen|servieren|zumischen|hinzugeben|erhitzen|abschmecken|bestreuen|verteilen|gießen|giessen|legen|stellen|füllen|fuellen|kneten|mixen|pürieren|puerieren|würzen|wuerzen|add|mix|stir|cook|fry|bake|chop|heat|simmer|serve|pour|whisk|season|place|combine)/i;
  for (const line of lines) {
    const words = line.split(/\s+/).length;
    if (words < 4) continue;
    if (!stepVerbRe.test(line)) continue;
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean.length < 12) continue;
    if (steps.some((s) => s === clean)) continue;
    steps.push(clean.charAt(0).toUpperCase() + clean.slice(1));
    if (steps.length >= 25) break;
  }

  return { ingredients, steps };
}

/**
 * Rezept aus einem Video-Link ziehen. `null` = kein Rezept gefunden
 * (falscher Link, keine Untertitel oder kein Rezept im Text).
 */
export async function recipeFromVideo(url: string): Promise<VideoRecipe | null> {
  const id = youtubeId(url);
  if (!id) return null;
  try {
    const transcript = await fetchTranscript(id);
    if (!transcript) return null;
    const { ingredients, steps } = parseRecipeFromText(transcript.text);
    if (ingredients.length < 2 || steps.length < 2) return null;
    return {
      title: transcript.title || steps[0].slice(0, 60),
      ingredients,
      steps,
      source: `https://www.youtube.com/watch?v=${id}`,
      language: transcript.language,
    };
  } catch {
    return null;
  }
}
