

export type RecipeContent = {
  title?: string;
  description?: string;
  ingredients: string[];
  steps: string[];
};

export type TranslatedRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
};

type Dict = Record<string, string>;

import { maps } from './recipe-translate-dict';

let extrasMerged = false;

function ensureExtras(): void {
  if (extrasMerged) return;
  extrasMerged = true;
  
  const { EXTRA_TERMS } = require('./recipe-translate-extra') as typeof import('./recipe-translate-extra');
  for (const [term, byLang] of Object.entries(EXTRA_TERMS)) {
    for (const [lang, translation] of Object.entries(byLang)) {
      const dict = maps[lang];
      if (!dict || !translation) continue;
      if (dict[term] === undefined) dict[term] = translation;
    }
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const GLOSSARY: Record<string, Record<string, string>> = {
  fold: { de: 'unterheben', fr: 'incorporer', es: 'incorporar', it: 'incorporare', tr: 'katlayarak karistir', pt: 'envolver', nl: 'spatel erdoor', ru: 'аккуратно перемешать' },
  'fold in': { de: 'unterheben', fr: 'incorporer', es: 'incorporar', it: 'incorporare', tr: 'hafifçe karıştır', pt: 'envolver', nl: 'erdoor spatelen', ru: 'аккуратно вмешать' , ar: 'اطوِ بلطف في الخليط' },
  whisk: { de: 'verquirlen', fr: 'fouetter', es: 'batir', it: 'sbattere', tr: 'çırpmak', pt: 'bater', nl: 'kloppen', ru: 'взбить венчиком' },
  simmer: { de: 'sanft köcheln lassen', fr: 'laisser mijoter', es: 'cocer a fuego lento', it: 'sobbollire', tr: 'kısık ateşte pişirmek', pt: 'cozinhar em lume brando', nl: 'zachtjes laten sudderen', ru: 'тушить на медленном огне' },
  sear: { de: 'scharf anbraten', fr: 'saisir', es: 'sellar', it: 'scottare', tr: 'mühürlemek', pt: 'selar', nl: 'dichtschroeien', ru: 'обжарить до корочки' },
  deglaze: { de: 'mit Flüssigkeit ablöschen', fr: 'déglacer', es: 'desglasar', it: 'sfumare', tr: 'suyu çözmek', pt: 'desglaciar', nl: 'blussen', ru: 'снять жаркое с жаровни жидкостью' },
  julienne: { de: 'in feine Streifen schneiden', fr: 'tailler en julienne', es: 'cortar en juliana', it: 'tagliare a julienne', tr: 'ince uzun doğramak', pt: 'cortar em juliana', nl: 'in fijne reepjes snijden', ru: 'нарезать соломкой' },
  knead: { de: 'kneten', fr: 'pétrir', es: 'amasar', it: 'impastare', tr: 'yoğurmak', pt: 'amassar', nl: 'kneden', ru: 'вымесить' },
  marinate: { de: 'marinieren', fr: 'faire mariner', es: 'marinar', it: 'marinare', tr: 'marine etmek', pt: 'marinar', nl: 'marineren', ru: 'мариновать' },
  'bring to a boil': { de: 'zum Kochen bringen', fr: 'porter à ébullition', es: 'llevar a ebullición', it: 'portare a ebollizione', tr: 'kaynatmak', pt: 'levar a ferver', nl: 'aan de kook brengen', ru: 'довести до кипения' , ar: 'اتركه حتى يغلي' },
  'reduce the heat': { de: 'die Hitze reduzieren', fr: 'baisser le feu', es: 'bajar el fuego', it: 'ridurre il fuoco', tr: 'ateşi kısmak', pt: 'reduzir o lume', nl: 'het vuur lager zetten', ru: 'уменьшить огонь' , ar: 'قلّل النار' },
  'preheat the oven': { de: 'den Ofen vorheizen', fr: 'préchauffer le four', es: 'precalentar el horno', it: 'preriscaldare il forno', tr: 'fırını ısıtmak', pt: 'pré-aquecer o forno', nl: 'de oven voorverwarmen', ru: 'разогреть духовку' , ar: 'سخّن الفرن مسبقًا' },
  'season to taste': { de: 'mit Salz und Pfeffer abschmecken', fr: 'assaisonner selon le goût', es: 'sazonar al gusto', it: 'condire a piacere', tr: 'damak zevkine göre baharatlamak', pt: 'temperar a gosto', nl: 'op smaak brengen', ru: 'приправить по вкусу' , ar: 'تبّل حسب الرغبة' },
  drain: { de: 'abgießen', fr: 'égoutter', es: 'escurrir', it: 'scolare', tr: 'süzmek', pt: 'escorrer', nl: 'afgieten', ru: 'сцедить' },
  'set aside': { de: 'beiseitestellen', fr: 'réserver', es: 'reservar', it: 'mettere da parte', tr: 'kenara almak', pt: 'reservar', nl: 'apart zetten', ru: 'отложить в сторону' , ar: 'اتركه جانبًا' },
};

const GLOSSARY_EXTRA: Record<string, Record<string, string>> = {
  fold: { uk: 'підгорнути', zh: '翻拌', ja: '折り込む', ko: '접어 넣다', hi: 'मोड़कर मिलाएं', pl: 'delikatnie wmieszać' },
  'fold in': { uk: 'акуратно вмішати', zh: '翻拌均匀', ja: 'さっくり混ぜる', ko: '가볍게 섞다', hi: 'हल्के से मिलाएं', pl: 'delikatnie wymieszać' },
  whisk: { uk: 'збити віничком', zh: '搅打', ja: '泡立てる', ko: '거품기로 젓다', hi: 'फेंटें', pl: 'ubic trzepaczką' },
  simmer: { uk: 'варити на малому вогні', zh: '小火慢煮', ja: '弱火で煮る', ko: '약불에서 끓이다', hi: 'धीमी आंच पर पकाएं', pl: 'gotować na wolnym ogniu' },
  sear: { uk: 'обсмажити до скоринки', zh: '煎至焦香', ja: '表面を焼き付ける', ko: '겉면을 지글지글 굽다', hi: 'तेज़ आंच पर सेंकें', pl: 'smażyć na ostrym ogniu' },
  deglaze: { uk: 'зняти скоринку рідиною', zh: '用液体脱釉', ja: '液体でデグレーズする', ko: '액체로 디글레이즈하다', hi: 'तरल से डिग्लेज़ करें', pl: 'deglasować' },
  julienne: { uk: 'нарізати соломкою', zh: '切成细丝', ja: '細切りにする', ko: '채 썰다', hi: 'पतली पट्टियों में काटें', pl: 'pociąć w słupki' },
  knead: { uk: 'замісити', zh: '揉面', ja: 'こねる', ko: '반죽하다', hi: 'गूंधें', pl: 'zagniatać' },
  marinate: { uk: 'маринувати', zh: '腌制', ja: '漬け込む', ko: '재우다', hi: 'मैरिनेट करें', pl: 'marynować' },
  'bring to a boil': { uk: 'довести до кипіння', zh: '煮沸', ja: '沸騰させる', ko: '끓어오르게 하다', hi: 'उबाल लाएं', pl: 'doprowadzić do wrzenia' },
  'reduce the heat': { uk: 'зменшити вогонь', zh: '调小火', ja: '火を弱める', ko: '불을 줄이다', hi: 'आंच कम करें', pl: 'zmniejszyć ogień' },
  'preheat the oven': { uk: 'розігріти духовку', zh: '预热烤箱', ja: 'オーブンを予熱する', ko: '오븐을 예열하다', hi: 'ओवन पहले से गरम करें', pl: 'rozgrzać piekarnik' },
  'season to taste': { uk: 'приправити до смаку', zh: '按口味调味', ja: '好みで味を調える', ko: '기호에 맞게 간하다', hi: 'स्वादानुसार मसाला डालें', pl: 'przyprawić do smaku' },
  drain: { uk: 'зцідити', zh: '沥干', ja: '水気を切る', ko: '물기를 빼다', hi: 'छान लें', pl: 'odsączyć' },
  'set aside': { uk: 'відкласти', zh: '放在一旁', ja: '取り置く', ko: '따로 두다', hi: 'अलग रखें', pl: 'odstawić na bok' },
};

function applyGlossary(text: string, language: string): string {
  let out = text;
  const terms = [...new Set([...Object.keys(GLOSSARY), ...Object.keys(GLOSSARY_EXTRA)])].sort((a, b) => b.length - a.length);
  for (const term of terms) {
    const rep = GLOSSARY[term]?.[language] ?? GLOSSARY_EXTRA[term]?.[language];
    if (!rep) continue;
    const re = new RegExp('(^|[^a-zA-Z])(' + escapeRe(term) + ')($|[^a-zA-Z])', 'gi');
    out = out.replace(re, (_m, pre: string, _w: string, post: string) => pre + rep + post);
  }
  return out;
}

function applyPhrases(text: string, dict: Dict): string {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  let out = text;
  for (const term of keys) {
    const rep = dict[term];
    if (rep === '') continue;
    const re = new RegExp('(^|[^a-zA-Z])(' + escapeRe(term) + ')($|[^a-zA-Z])', 'gi');
    out = out.replace(re, (_m, pre: string, _w: string, post: string) => pre + rep + post);
  }
  return out;
}

function tidy(s: string): string {
  const cleaned = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

export function isTranslatableLanguage(language: string): boolean {
  return !!language && language !== 'en' && !!maps[language];
}

const ONLINE_LANGS: Record<string, string> = {
  de: 'de',
  ar: 'ar',
  fr: 'fr',
  es: 'es',
  it: 'it',
  tr: 'tr',
  pt: 'pt',
  nl: 'nl',
  ru: 'ru',
  
  uk: 'uk',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  hi: 'hi',
  pl: 'pl',
};

const MM_PAIRS: Record<string, string> = {
  de: 'de-DE',
  ar: 'ar-SA',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  tr: 'tr-TR',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  
  uk: 'uk-UA',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  pl: 'pl-PL',
};

async function withTimeout<T>(fn: (signal?: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  let timer: any = null;
  let controller: any = null;
  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), ms);
    }
    return await fn(controller ? controller.signal : undefined);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const lineCache = new Map<string, string>();

function cacheGet(lang: string, text: string): string | undefined {
  return lineCache.get(`${lang}|${text}`);
}

function cacheSet(lang: string, text: string, value: string): void {
  if (lineCache.size > 4000) lineCache.clear();
  lineCache.set(`${lang}|${text}`, value);
}

async function translateWithGoogle(lines: string[], lang: string, sourceLang = 'auto'): Promise<string[] | null> {
  const text = lines.map((l) => l.trim()).join('\n');
  if (!text) return lines.map(() => '');
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
    encodeURIComponent(sourceLang) +
    '&tl=' +
    lang +
    '&dt=t&q=' +
    encodeURIComponent(text);
  const data: any = await withTimeout(async (signal) => {
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res || !res.ok) throw new Error('http ' + (res ? res.status : 'no response'));
    return res.json();
  }, 12000);
  if (!data || !Array.isArray(data[0])) return null;
  const joined = (data[0] as any[])
    .map((part) => (Array.isArray(part) ? String(part[0] ?? '') : ''))
    .join('');
  const out = joined.split('\n').map((s) => s.trim());
  if (out.length !== lines.length) return null;
  return out;
}

function polish(s: string): string {
  let out = (s ?? '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  if (!out) return out;
  if (out.length > 3 && out === out.toUpperCase() && /[A-ZÄÖÜ]{3}/.test(out)) {
    out = out.charAt(0).toUpperCase() + out.slice(1).toLowerCase();
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

async function fetchTranslation(text: string, language: string, timeoutMs = 7000): Promise<string | null> {
  const pair = MM_PAIRS[language];
  const value = (text ?? '').trim();
  if (!pair || !value || value.length > 480) return null;
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(value) +
    '&langpair=en|' +
    pair;
  let timer: any = null;
  let controller: any = null;
  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res || !res.ok) return null;
    const data: any = await res.json();
    const out = data?.responseData?.translatedText;
    if (typeof out !== 'string') return null;
    const cleaned = out.trim();
    if (!cleaned) return null;
    if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID |PLEASE SELECT)/i.test(cleaned)) return null;
    if (cleaned.toLowerCase() === value.toLowerCase()) return null;
    if (cleaned.length > 3 && cleaned === cleaned.toUpperCase() && /[A-ZÄÖÜ]{3}/.test(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }
    return cleaned;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function translateRecipeContentOnline(
  recipe: RecipeContent,
  language: string,
): Promise<TranslatedRecipe> {
  const base = translateRecipeContent(recipe, language);
  const lang = ONLINE_LANGS[language];
  if (!lang) return base;

  const ingredientsRaw = recipe.ingredients ?? [];
  const stepsRaw = recipe.steps ?? [];
  const hasDescription = !!recipe.description;

  const segments: string[] = [recipe.title ?? ''];
  if (hasDescription) segments.push(recipe.description as string);
  segments.push(...ingredientsRaw, ...stepsRaw);

  const fallback: string[] = [base.title];
  if (hasDescription) fallback.push(base.description ?? '');
  fallback.push(...base.ingredients, ...base.steps);
  while (fallback.length < segments.length) fallback.push(segments[fallback.length]);

  const results = [...segments];

  const indexChunks: number[][] = [];
  let chunk: number[] = [];
  let length = 0;
  segments.forEach((text, i) => {
    const value = (text ?? '').trim();
    if (!value) return;
    if (chunk.length && length + value.length + 1 > 1200) {
      indexChunks.push(chunk);
      chunk = [];
      length = 0;
    }
    chunk.push(i);
    length += value.length + 1;
  });
  if (chunk.length) indexChunks.push(chunk);

  let primaryAlive = true;
  for (const indexes of indexChunks) {
    const lines = indexes.map((i) => segments[i]);
    
    const pending: number[] = [];
    indexes.forEach((index, pos) => {
      const hit = cacheGet(lang, (segments[index] ?? '').trim());
      if (hit && hit.trim()) results[index] = hit;
      else pending.push(pos);
    });
    if (!pending.length) continue;

    const pendingLines = pending.map((pos) => lines[pos]);
    const translated = primaryAlive ? await translateWithGoogle(pendingLines, lang) : null;
    if (!translated) {
      primaryAlive = false;
      continue;
    }
    pending.forEach((pos, i) => {
      const value = polish(translated[i] ?? '');
      if (value && value.toLowerCase() !== (segments[indexes[pos]] ?? '').trim().toLowerCase()) {
        results[indexes[pos]] = value;
        cacheSet(lang, (segments[indexes[pos]] ?? '').trim(), value);
      }
    });
  }

  let secondaryAlive = true;
  let misses = 0;
  for (let i = 0; i < segments.length && secondaryAlive; i += 1) {
    const original = (segments[i] ?? '').trim();
    if (!original) continue;
    if ((results[i] ?? '').trim().toLowerCase() !== original.toLowerCase()) continue;
    const res = await fetchTranslation(original, language);
    if (res === null) {
      misses += 1;
      if (misses >= 3) secondaryAlive = false;
      continue;
    }
    misses = 0;
    results[i] = polish(res);
  }

  for (let i = 0; i < segments.length; i += 1) {
    const original = (segments[i] ?? '').trim();
    if (!original) continue;
    if ((results[i] ?? '').trim().toLowerCase() === original.toLowerCase()) {
      results[i] = fallback[i] ?? segments[i];
    }
  }

  let cursor = 0;
  const title = results[cursor++] || base.title;
  const description = hasDescription ? results[cursor++] || base.description : base.description;
  const ingredients: string[] = ingredientsRaw.map(() => results[cursor++] ?? '');
  const steps: string[] = stepsRaw.map(() => {
    const done = (results[cursor++] ?? '').trim();
    return done && !/[.!?]$/.test(done) ? `${done}.` : done;
  });

  return { title, description, ingredients, steps };
}

export async function translateLines(lines: string[], language: string): Promise<string[]> {
  const source = (lines ?? []).map((l) => String(l ?? ''));
  const lang = ONLINE_LANGS[language];
  if (language === 'en') return source;

  const offline = (text: string) => {
    
    ensureExtras();
    const full = maps[language];
    return full ? tidy(applyPhrases(applyGlossary(text, language), full)) : text;
  };

  const out = source.map((text) => (lang ? cacheGet(lang, text.trim()) ?? text : text));
  if (!lang) return out.map((text, i) => (text === source[i] ? offline(source[i]) : text));

  const pending: number[] = [];
  source.forEach((text, i) => {
    if (!text.trim()) return;
    if (out[i] !== text) return; 
    pending.push(i);
  });

  if (pending.length) {
    const translated = await translateWithGoogle(pending.map((i) => source[i]), lang);
    if (translated) {
      pending.forEach((index, pos) => {
        const value = polish(translated[pos] ?? '');
        if (value && value.trim()) {
          out[index] = value;
          cacheSet(lang, source[index].trim(), value);
        }
      });
    }
  }

  
  return out.map((text, i) => (text === source[i] && source[i].trim() ? offline(source[i]) : text));
}

export function translateRecipeContent(recipe: RecipeContent, language: string): TranslatedRecipe {
  ensureExtras();
  const map = maps[language];
  const keep: TranslatedRecipe = {
    title: recipe.title ?? '',
    description: recipe.description,
    ingredients: [...(recipe.ingredients ?? [])],
    steps: [...(recipe.steps ?? [])],
  };
  if (!map || language === 'en') return keep;

  const t = (s: string) => tidy(applyPhrases(applyGlossary(s, language), map));
  const steps = (recipe.steps ?? []).map((s) => {
    const done = t(s);
    return /[.!?]$/.test(done) ? done : `${done}.`;
  });

  return {
    title: t(recipe.title ?? ''),
    description: recipe.description ? t(recipe.description) : undefined,
    ingredients: (recipe.ingredients ?? []).map(t),
    steps,
  };
}

