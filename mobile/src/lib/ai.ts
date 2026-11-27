

import { supabase } from './supabase';
import { getStoredLanguage } from './i18n';
import { analyzeRecipeNutrition, consistent } from './nutrition';
import { withTimeout } from './safe';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_TIMEOUT_MS = 120000;

function newRequestId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type AiUsage = { used: number; limit: number; remaining: number; unlimited: boolean };

let aiUsage: AiUsage | null = null;
const aiUsageListeners = new Set<() => void>();

function publishUsage(next: AiUsage | null) {
  if (!next) return;
  if (
    aiUsage &&
    aiUsage.used === next.used &&
    aiUsage.limit === next.limit &&
    aiUsage.remaining === next.remaining &&
    aiUsage.unlimited === next.unlimited
  ) {
    return;
  }
  aiUsage = next;
  aiUsageListeners.forEach((fn) => fn());
}

export function subscribeAiUsage(listener: () => void): () => void {
  aiUsageListeners.add(listener);
  return () => aiUsageListeners.delete(listener);
}

export function getAiUsage(): AiUsage | null {
  return aiUsage;
}

function usageFrom(raw: any): AiUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const limit = Number(raw.limit ?? 3);
  const used = Number(raw.used ?? 0);
  return {
    used,
    limit,
    remaining: Number(raw.remaining ?? Math.max(0, limit - used)),
    unlimited: !!raw.unlimited,
  };
}

export async function refreshAiUsage(): Promise<AiUsage | null> {
  try {
    const { data } = await supabase.rpc('ai_usage_today', { p_limit: 3 });
    const next = usageFrom(data);
    if (next) publishUsage(next);
    return next;
  } catch {
    return aiUsage;
  }
}

function jsonFromText(text: string): any {
  const cleaned = text
    .replace(/```json|```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The AI returned an unexpected answer.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function functionError(error: any): Promise<string> {
  const status = Number(error?.context?.status ?? error?.status ?? 0);
  let detail = '';
  try {
    const body = await error?.context?.text?.();
    if (body) detail = String(body);
  } catch {}
  if (status === 404) {
    return 'AI is not available yet: deploy the Supabase function "ai" (supabase/functions/ai) and set OPENROUTER_API_KEY as its secret.';
  }
  if (status === 401 || status === 403) return 'AI access was denied. Please sign in again.';
  if (status === 429) {
    

    if (/daily_limit_reached/i.test(detail)) {
      return 'You have used all 3 AI requests for today. Come back tomorrow.';
    }
    return 'The AI is busy right now. Please try again in a moment.';
  }
  return `AI request failed${status ? ` (${status})` : ''}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
}

async function chatJSON(system: string, user: string, temperature = 0.7, requestId = newRequestId()): Promise<any> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('ai', {
      body: {
        system,
        user,
        temperature: Math.max(0, Math.min(1.2, Number(temperature) || 0.7)),
        requestId,
      },
    }),
    AI_TIMEOUT_MS,
    'Die KI hat zu lange gebraucht.',
  );
  if (error) throw new Error(await functionError(error));
  

  publishUsage(usageFrom((data as any)?.usage));
  const content = (data as any)?.content;
  if (!content) throw new Error('AI returned no content.');
  return jsonFromText(String(content));
}

const numberOr = (v: any, d?: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : d);
const intOr = (v: any, d?: number) => {
  const n = numberOr(v, d);
  return n === undefined ? undefined : Math.max(0, Math.round(n));
};
const strList = (v: any): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const str = (v: any, d = ''): string => (v == null ? d : String(v));

/**
 * The model sometimes pads recipes with rule-like "steps" or cuts a step at
 * "...". These helpers keep only real actions, in order, and align the guides
 * with the steps that survived.
 */
const META_STEP =
  /^(?:die|der|das)\s+(?:richtige|richtigen)\b|^(?:die|der|das)\s+[^.]{0,60}\b(?:kann je nach|variiert je nach|beträgt \d|erkennt man an|ist eine cremige|sollte eine|sollten eine)\b|^the\s+(?:right|correct)\s+(?:temperature|amount|time|consistency|texture)\b|^the\s+[^.]{0,60}\b(?:can vary|depends on|is a creamy|should be a)/i;

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'without', 'until', 'then', 'than', 'this', 'that', 'these', 'those',
  'each', 'over', 'into', 'from', 'your', 'yours', 'them', 'they', 'when', 'while', 'about',
  'after', 'before', 'should', 'would', 'could', 'make', 'made', 'just', 'very', 'more', 'less',
  'only', 'also', 'have', 'will', 'care', 'take', 'well', 'good', 'best', 'want', 'need',
  'dann', 'dass', 'wenn', 'oder', 'aber', 'nicht', 'noch', 'schon', 'etwas', 'einer', 'einen',
  'einem', 'eines', 'sowie', 'dabei', 'damit', 'diese', 'dieser', 'dieses', 'sollte', 'sollten',
  'kann', 'können', 'wird', 'werden', 'sind', 'haben', 'beim', 'zum', 'zur', 'aus', 'mit', 'von',
  'für', 'auf', 'über', 'unter', 'nach', 'bei', 'ihr', 'ihre', 'ihren', 'man', 'nur', 'auch',
  'sehr', 'gut', 'gute', 'guten', 'oder', 'dabei', 'immer', 'wieder', 'leicht', 'regelmäßig',
]);

function tokensOf(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function cleanStep(raw: string): string {
  let text = String(raw ?? '')
    .replace(/^\s*(?:step|schritt)\s*\d+\s*[).:-]?\s*/i, '')
    .replace(/^\s*\d+\s*[).:-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/(?:\.{2,}|…)+\s*$/g, '').trim();
  // "mit dem 1 TL Öl" / "der 1 Prise Salz" is wrong German; drop the article.
  text = text.replace(
    /\b(der|die|das|dem|den|des)\s+(1|einer|einem)\s+(TL|EL|Prise|Prise\s|Bund|Zehe|Zehen|Stange|Stück|Dose|Packung|Scheibe|Scheiben|Handvoll|Tasse|ml|g|kg)\b/gi,
    '$2 $3',
  );
  text = text.replace(/\s+/g, ' ').trim();
  if (text && !/[.!?]$/.test(text)) text += '.';
  return text;
}

function sameStep(a: string, b: string): boolean {
  const left = new Set(tokensOf(a));
  const right = new Set(tokensOf(b));
  if (!left.size || !right.size) return a.toLowerCase() === b.toLowerCase();
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / Math.min(left.size, right.size) >= 0.85;
}

export function finalizeStepsAndGuides(
  rawSteps: string[],
  rawGuides: any[],
  ingredients: string[],
  options: { maxSteps?: number; trimAfterServe?: 'always' | 'smart' | 'never' } = {},
) {
  const maxSteps = options.maxSteps ?? 14;
  const trimMode = options.trimAfterServe ?? 'always';
  const pairs: { step: string; guide: any }[] = [];
  rawSteps.forEach((raw, i) => {
    const step = cleanStep(String(raw ?? ''));
    if (!step || META_STEP.test(step)) return;
    if (pairs.some((entry) => sameStep(entry.step, step))) return;
    pairs.push({ step, guide: Array.isArray(rawGuides) ? rawGuides[i] ?? null : null });
  });
  const serveAt = pairs.findIndex((entry) => /\b(serviere|servier|anrichten|garnish and serve|serve (it|the|hot|immediately))\b/i.test(entry.step));
  let kept = pairs;
  if (serveAt >= 3) {
    const after = pairs.slice(serveAt + 1);
    const clearJunk = after.length > 0 && after.every((entry) =>
      META_STEP.test(entry.step) ||
      /(nicht zu lange|variieren|überprüfe|prüfe|achte darauf|genieße|serviere|servier)/i.test(entry.step),
    );
    if (trimMode === 'always' || (trimMode === 'smart' && clearJunk)) {
      kept = pairs.slice(0, serveAt + 1);
    }
  }
  const usable = kept.slice(0, maxSteps);
  const ingredientTokens = new Set(tokensOf(ingredients.join(' ')));
  const seen = new Set<string>();

  const guides = usable.map(({ step, guide }, index) => {
    const accept = (value: any): string | null => {
      const text = value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
      if (!text) return null;
      const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (seen.has(key)) return null;
      const stepTokens = tokensOf(step);
      const namedIngredients = tokensOf(text).filter((word) => ingredientTokens.has(word));
      if (namedIngredients.length && !namedIngredients.some((word) => stepTokens.includes(word))) return null;
      seen.add(key);
      return text.slice(0, 200);
    };
    return {
      index,
      coach: accept(guide?.coach),
      look: accept(guide?.look),
    };
  });

  return { steps: usable.map((entry) => entry.step), guides };
}

const SCRIPT_LANGUAGES: [RegExp, { code: string; name: string }][] = [
  [/[\u0600-\u06FF\u0750-\u077F]/, { code: 'ar', name: 'Arabic' }],
  [/[іїєґІЇЄҐ]/, { code: 'uk', name: 'Ukrainian' }],
  [/[\u0400-\u04FF]/, { code: 'ru', name: 'Russian' }],
  [/[\u0590-\u05FF]/, { code: 'he', name: 'Hebrew' }],
  [/[\u0370-\u03FF]/, { code: 'el', name: 'Greek' }],
  [/[\u0900-\u097F]/, { code: 'hi', name: 'Hindi' }],
  [/[\u0E00-\u0E7F]/, { code: 'th', name: 'Thai' }],
  [/[\u3040-\u30FF]/, { code: 'ja', name: 'Japanese' }],
  [/[\uAC00-\uD7AF]/, { code: 'ko', name: 'Korean' }],
  [/[\u4E00-\u9FFF]/, { code: 'zh', name: 'Chinese' }],
];

const LATIN_STOPWORDS: Record<string, { name: string; words: string[]; chars?: string }> = {
  de: { name: 'German', words: ['und', 'mit', 'für', 'fur', 'ein', 'eine', 'nicht', 'ich', 'das', 'der', 'die', 'von', 'auf', 'ist', 'auch', 'aber', 'noch'] },
  fr: { name: 'French', words: ['et', 'avec', 'pour', 'une', 'des', 'je', 'les', 'pas', 'dans', 'sur', 'est', 'aux', 'du', 'que', 'plus'] },
  es: { name: 'Spanish', words: ['y', 'con', 'para', 'una', 'los', 'el', 'sin', 'muy', 'que', 'del', 'como', 'pero', 'más', 'mas'] },
  it: { name: 'Italian', words: ['e', 'con', 'per', 'una', 'gli', 'il', 'non', 'della', 'sono', 'come', 'anche', 'senza', 'più', 'piu'] },
  pt: { name: 'Portuguese', words: ['e', 'com', 'para', 'uma', 'os', 'não', 'nao', 'do', 'da', 'como', 'mais', 'muito', 'sem'] },
  nl: { name: 'Dutch', words: ['en', 'met', 'voor', 'een', 'het', 'niet', 'van', 'op', 'is', 'ook', 'maar', 'zonder', 'meer'] },
  tr: { name: 'Turkish', words: ['ve', 'ile', 'için', 'icin', 'bir', 'çok', 'cok', 'değil', 'degil', 'olarak', 'bu', 'şu', 'su'], chars: 'ığşçöüİĞŞÇÖÜ' },
  uk: { name: 'Ukrainian', words: ['і', 'та', 'для', 'що', 'це', 'як', 'без', 'молоко', 'йогурт', 'сир'], chars: 'іїєґІЇЄҐ' },
  

  pl: { name: 'Polish', words: ['i', 'z', 'do', 'na', 'nie', 'to', 'jak', 'oraz', 'dla', 'czy', 'jest', 'się', 'sie', 'bez', 'mleko', 'jogurt', 'ser'], chars: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ' },
  en: { name: 'English', words: ['and', 'with', 'for', 'the', 'not', 'this', 'that', 'some', 'have', 'from', 'make', 'without', 'more'] },
};

export function detectInputLanguage(text?: string): { code: string; name: string } | null {
  const raw = String(text ?? '').trim();
  if (raw.length < 2) return null;

  for (const [re, lang] of SCRIPT_LANGUAGES) {
    if (re.test(raw)) return lang;
  }

  const lower = ` ${raw.toLowerCase()} `;
  const words = lower.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  if (!words.length) return null;

  let best: { code: string; name: string; score: number } | null = null;
  for (const [code, def] of Object.entries(LATIN_STOPWORDS)) {
    let score = 0;
    for (const w of words) if (def.words.includes(w)) score += 1;
    if (def.chars && [...def.chars].some((c) => raw.includes(c))) score += 0.75;
    if (!best || score > best.score) best = { code, name: def.name, score };
  }
  return best && best.score > 0 ? { code: best.code, name: best.name } : null;
}

/** Every app language, so the model writes recipes the cook can read. */
const APP_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', de: 'German', ar: 'Arabic', fr: 'French', es: 'Spanish', it: 'Italian',
  tr: 'Turkish', pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', uk: 'Ukrainian',
  zh: 'Simplified Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi', pl: 'Polish',
};

/**
 * The chosen app language decides the language of the whole recipe: someone
 * with the app in German wants a German recipe even with English ingredients.
 */
function appLanguageRule(): string {
  const code = getStoredLanguage();
  const name = APP_LANGUAGE_NAMES[code] ?? 'English';
  return (
    `IMPORTANT: Write EVERY text field (title, description, ingredient names, steps, tips) in ${name}, ` +
    `because ${name} is the language the cook chose in this app. Translate everything else into ${name}; ` +
    'keep numbers, units and amounts exactly as written and never answer in another language.'
  );
}

function languageRule(samples: Array<string | undefined>): string {
  const detected = samples.map((s) => detectInputLanguage(s)).find(Boolean);
  const base =
    "IMPORTANT: Answer in the same language the user wrote in - never switch to the app's UI language.";
  return detected
    ? `${base} The user wrote in ${detected.name}, so write EVERY text field (title, description, ingredient names, steps, tips) in ${detected.name}.`
    : `${base} Keep every text field in the language of the user's message.`;
}

export type AiRecipeArgs = {
  availableIngredients?: string;
  dietaryPreferences?: string;
  prompt?: string;
  
  experience?: string;
  
  goal?: string;
  
  diet?: string;
  
  allergies?: string[];
  
  servings?: number;

  targets?: { calories: number; protein: number; carbs: number; fat: number };

  weight?: number;

  targetWeight?: number;

  favoriteCuisines?: string[];
  
  cuisine?: string;
  
  maxMinutes?: number;
  
  difficulty?: string;
  
  spice?: string;
  
  lighter?: boolean;
  
  kidFriendly?: boolean;
  
  equipment?: string;
  
  avoidTitles?: string[];

  avoidRecipes?: { title: string; ingredients?: string[]; cuisine?: string }[];
  
  explain?: boolean;
  
  temperature?: number;
};

export async function aiGenerateRecipe(args: AiRecipeArgs): Promise<any> {
  const experience = String(args.experience ?? '').toLowerCase();
  const beginner = experience === 'beginner' || experience === '1-2 years';
  const advanced = experience === 'professional' || experience === '5+ years';
  const detailRule = beginner
    ? 'Write for a beginner: explain every technique in short, simple sentences and say what "done" looks like.'
    : advanced
      ? 'Write for an experienced cook: keep steps tight, use precise culinary terms and temperatures.'
      : 'Write for an average home cook: clear steps without over-explaining.';
  const guideRule = beginner
    ? 'Coaching tips are for a beginner or someone with 1-2 years of practice. Only steps that are genuinely difficult or easy to get wrong get a tip: browning, frying, reducing a sauce, baking, cooking meat through, tempering, resting, or anything where timing matters. Simple steps (boiling water, adding pasta, washing vegetables, plating) MUST have coach: null and look: null. For a difficult step write a coach tip of two short, concrete sentences that says what to do, why, and the mistake beginners usually make. The look hint is one sensory check (colour, texture, sound, smell) that tells them it is right. Every word must refer to THIS step and THIS recipe, never generic advice. A tip may only name an ingredient that is already mentioned in its own step, never one from another step.'
    : advanced
      ? 'Only the two or three truly tricky steps get a guide, each one concise sentence with a precise sensory check. Every other step MUST have coach: null and look: null. Never add generic advice. A tip may only name ingredients and actions from its own step.'
      : 'Only steps that are genuinely difficult or easy to get wrong get a guide, at most one or two sentences. Simple steps MUST have coach: null and look: null. Every tip must name what to watch in THIS step, never generic advice. A tip may only name ingredients and actions from its own step.';
  const guideOrderRule =
    'Never attach a tip about a sauce, garnish or side to a step that does not prepare it. ' +
    'Never repeat the same coach tip or look hint on two different steps: if the same advice would apply twice, keep it on the step where it matters most and use null on the other. ' +
    'Never reuse a sentence from the description, tips or another step as a guide. ' +
    'A coach tip must add something the step does not already say: why it matters, the mistake to avoid, or how to recognise the right moment. Never repeat or paraphrase the instruction itself.';
  const goalRule =
    args.goal === 'lose'
      ? 'Keep calories moderate and favour vegetables, lean protein and fibre.'
      : args.goal === 'gain'
        ? 'Make it calorie dense and protein rich enough to support muscle building.'
        : 'Keep it balanced across protein, carbohydrates and fat.';
  const allergyTags = (args.allergies ?? []).filter(Boolean);
  const allergyRule = allergyTags.length
    ? `NEVER use these allergens or any derivative of them: ${allergyTags.join(', ')}. If the request needs them, replace them with a safe alternative and say so in the description.`
    : '';
  const servings = Math.max(1, Math.min(12, Number(args.servings ?? 4))) || 4;
  const goalTargets = args.targets;
  const meal = (value: number) => Math.max(0, Math.round(Number(value) / 3));
  const targetRule = goalTargets
    ? `The cook's targets are DAILY totals: about ${Math.round(goalTargets.calories)} kcal, ` +
      `${Math.round(goalTargets.protein)} g protein, ${Math.round(goalTargets.carbs)} g carbs, ` +
      `${Math.round(goalTargets.fat)} g fat per day. This dish is one main meal, so ONE SERVING should cover ` +
      `roughly a third of them: about ${meal(goalTargets.calories)} kcal, ${meal(goalTargets.protein)} g protein, ` +
      `${meal(goalTargets.carbs)} g carbs and ${meal(goalTargets.fat)} g fat (within 15 percent). ` +
      `Size the ingredient amounts for that single meal and never aim one serving at the full daily amount.`
    : '';
  const targetWeightRule =
    Number(args.targetWeight) > 0
      ? `The cook weighs ${Math.round(Number(args.weight) || 0)} kg and wants to reach ${Math.round(Number(args.targetWeight))} kg. Keep that direction in mind for portion size and calorie density.`
      : '';
  const favoriteCuisines = (args.favoriteCuisines ?? []).filter(Boolean).slice(0, 4);
  const favoriteRule = favoriteCuisines.length
    ? `The cook usually makes ${favoriteCuisines.join(', ')}. Prefer one of those unless the request says otherwise.`
    : '';
  const timeRule = args.maxMinutes
    ? `The whole recipe must fit in ${Number(args.maxMinutes)} minutes (prepTime + cookTime <= ${Number(args.maxMinutes)}).`
    : '';
  const difficultyRule = args.difficulty ? `Target difficulty: ${args.difficulty}.` : '';
  const spiceRule =
    args.spice === 'mild'
      ? 'Keep it mild: no chili heat at all.'
      : args.spice === 'hot'
        ? 'Make it properly spicy, using fresh or dried chilies.'
        : args.spice === 'medium'
          ? 'Use a gentle warmth - noticeable but not hot.'
          : '';
  const lighterRule = args.lighter
    ? 'Make it lighter: reduce oil and butter, prefer steaming/baking over frying, keep the fat low without losing flavour.'
    : '';
  const kidRule = args.kidFriendly
    ? 'It must be kid friendly: no alcohol, no chili, low salt, no whole nuts, no bones.'
    : '';
  const equipmentRule = args.equipment
    ? `The cook owns exactly this equipment: ${args.equipment}. Every step must work with it alone. ` +
      `Do not grill, bake, air-fry, pressure-cook or microwave anything unless that appliance is named in that list, ` +
      `and never suggest buying or borrowing another tool.`
    : 'Use only basic kitchen tools (knife, pan, pot, oven or stove).';
  const recent = (args.avoidRecipes ?? [])
    .filter((item) => item && String(item.title ?? '').trim())
    .slice(0, 12);
  const avoidRule = recent.length
    ? 'The cook already has these dishes, do not generate anything close to them:\n' +
      recent
        .map((item) => {
          const ingredients = (item.ingredients ?? []).filter(Boolean).slice(0, 5).join(', ');
          return `- ${String(item.title).trim()}${item.cuisine ? ` (${item.cuisine})` : ''}${ingredients ? `: ${ingredients}` : ''}`;
        })
        .join('\n') +
      '\nIf the cook explicitly asks for one of these dishes by name, follow that request. Otherwise the new dish must differ clearly from every listed dish: change the main protein or vegetable AND the cooking technique or flavour profile. A new title, a renamed version or one swapped side is not different enough.'
    : (args.avoidTitles ?? []).length > 0
      ? `Do not repeat any of these already cooked dishes: ${(args.avoidTitles ?? []).slice(0, 8).join(' | ')}. Pick a clearly different dish.`
      : '';
  const noteRule = args.explain
    ? 'Also add a field "note": one short sentence (max 20 words) explaining why this recipe fits the constraints.'
    : '';

  const titleRule =
    'TITLE: 2 to 6 words, specific and appetising, naming the main ingredient plus the technique, texture ' +
    'or the one detail that makes this version different (for example "Cremige Kartoffelsuppe mit geröstetem ' +
    'Speck" or "Zitronen-Hähnchen vom Blech"). Sentence case, no emojis, no hashtags, no quotes, no ALL CAPS, ' +
    'no clickbait and no empty superlatives like "best", "ultimate" or "perfect". It must describe exactly ' +
    'what the recipe delivers, never a different dish. ';
  const system =
    'You are the Spoonful AI Chef, a calm, precise professional recipe developer. ' +
    'Always answer with valid JSON only (no markdown, no commentary). Fields exactly: ' +
    'title, description (2-3 sentences), cuisine, mealType, ingredients (array of strings WITH amounts, e.g. "200 g pasta"), ' +
    'steps (array of complete imperative strings, ordered, each one real cooking action, as many as the dish really needs), ' +
    'guides (array with exactly one object per step, same order and same length, each {"coach": string or null, "look": string or null}; null for steps that are not difficult), prepTime (minutes, number), ' +
    'cookTime (minutes, number), difficulty ("easy"|"medium"|"hard"), dietaryRestrictions (array of lowercase tags), ' +
    'calories, protein, carbs, fat (numbers, per serving), tips (array of up to 3 short strings)' +
    (args.explain ? ', note' : '') +
    '. ' +
    titleRule +
    'Rules: realistic amounts, correct cooking technique, no invented exotic equipment, no brand names, ' +
    

    'max 12 ingredients, as many steps as the dish needs (usually 3 to 7, never padded), metric units. ' +
    'For dairy ingredients, specify the exact type and fat percentage in the ingredient name. ' +
    'Use lactose-free dairy when requested. Do not replace a user-specified type or fat content. ' +
    'Every step must be a real physical action the cook performs, written as one or two complete sentences ' +
    'with amounts and times inside the step. When an ingredient is used for the first time, repeat its exact ' +
    'amount from the ingredient list in that step (for example "die 200 g Spaghetti"). ' +
    'Keep that amount natural in German: write "die 2 Zitronen", "die Zitrone", "die 200 g Sahne" or ' +
    '"die Knoblauchzehe", never "die 1 Zitrone", "der 1 Knoblauchzehe" or "die 2 Stück Zitronen". ' +
    'Never write an action that cannot be performed as written: grating the peel and pressing the juice are two actions. ' +
    'Follow the real cooking order: reserve pasta or rice water BEFORE draining, melt or warm dairy before ' +
    'combining it with hot liquid, and never add an ingredient before it has been prepared. ' +
    'Never cut a step short, never end a step with "..." or "…", ' +
    'and never split one single action across several steps. ' +
    'Never write a step that explains a rule, a temperature range, a consistency, a timing range, ' +
    'a serving suggestion or a summary instead of telling the cook what to do next. ' +
    'Do not repeat the same instruction twice and do not pad the list to reach a step count. ' +
    'A quick dish may need only 3 steps, a long preparation more: follow the cooking, never a target count. ' +
    guideRule +
    ' ' + guideOrderRule +
    ' A coach tip names only ingredients that appear in THIS recipe and never mentions another dish. ' +
    'The look hint is a sensory check, max 16 words: colour, texture, sound or smell. ' +
    'A guide must match its own step, not the recipe as a whole. ' +
    'Write every instruction in the imperative. In German always use the informal du-form (Rühre, Füge, Brate), never Sie. Never mix address forms inside one recipe. ' +
    'Start each German step with the action itself (Schäle, Schneide, Erhitze, Gib, Rühre, Würze) and never with filler such as "Finde", "Nimm dir", "Als Nächstes" or "Jetzt geht es darum". ' +
    'Never use em dashes or en dashes in any field. ' +
    detailRule +
    ' ' +
    goalRule +
    (targetRule ? ' ' + targetRule : '') +
    (favoriteRule ? ' ' + favoriteRule : '') +
    (targetWeightRule ? ' ' + targetWeightRule : '') +
    (allergyRule ? ' ' + allergyRule : '') +
    (timeRule ? ' ' + timeRule : '') +
    (difficultyRule ? ' ' + difficultyRule : '') +
    (spiceRule ? ' ' + spiceRule : '') +
    (lighterRule ? ' ' + lighterRule : '') +
    (kidRule ? ' ' + kidRule : '') +
    ' ' +
    equipmentRule +
    (avoidRule ? ' ' + avoidRule : '') +
    (noteRule ? ' ' + noteRule : '') +
    
    ' ' +
    appLanguageRule();
  const user = [
    args.prompt
      ? `Create ONE recipe that matches this request: "${args.prompt.trim()}".`
      : `Create ONE recipe using mainly these ingredients: ${args.availableIngredients || 'anything available'}.`,
    args.dietaryPreferences ? `Dietary requirements: ${args.dietaryPreferences}.` : '',
    args.diet ? `The cook eats: ${args.diet}.` : '',
    allergyTags.length ? `Allergies (must be excluded): ${allergyTags.join(', ')}.` : '',
    args.cuisine ? `Cuisine: ${args.cuisine}.` : '',
    `Write it for exactly ${servings} servings and make the nutrition values realistic for that portion.`,
    args.equipment ? `Equipment the cook owns: ${args.equipment}. Every step must be doable with that alone.` : '',
    args.maxMinutes ? `The whole dish must be ready in ${Number(args.maxMinutes)} minutes.` : '',
    goalTargets
      ? `Daily targets of the cook: ${goalTargets.calories} kcal, ${goalTargets.protein} g protein, ${goalTargets.carbs} g carbs, ${goalTargets.fat} g fat. One serving should cover about a third of that.`
      : '',
    'Keep the description appetising but factual.',
  ]
    .filter(Boolean)
    .join('\n');
  let raw: any = null;
  let lastError: unknown = null;
  const requestId = newRequestId();
  for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
    try {
      raw = await chatJSON(system, user, args.temperature, requestId);
    } catch (e) {
      lastError = e;
    }
  }
  if (!raw) throw (lastError instanceof Error ? lastError : new Error('The AI could not answer. Please try again.'));
  if (!Array.isArray(raw.ingredients) || !raw.ingredients.length) {
    throw new Error('The AI answer was incomplete. Please try again.');
  }
  const ingredients = strList(raw.ingredients);
  const rawGuides: any[] = Array.isArray(raw.guides) ? raw.guides : [];
  const { steps, guides } = finalizeStepsAndGuides(strList(raw.steps), rawGuides, ingredients);
  const grounded = groundedMacros(ingredients, servings);
  return {
    title: str(raw.title, 'AI recipe'),
    description: str(raw.description),
    cuisine: str(raw.cuisine, 'Other'),
    ingredients,
    steps,
    guides,
    prepTime: intOr(raw.prepTime, 10),
    cookTime: intOr(raw.cookTime, 20),
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium',
    dietaryRestrictions: strList(raw.dietaryRestrictions),
    mealType: raw.mealType ? String(raw.mealType) : undefined,
    calories: grounded?.calories ?? numberOr(raw.calories),
    protein: grounded?.protein ?? numberOr(raw.protein),
    carbs: grounded?.carbs ?? numberOr(raw.carbs),
    fat: grounded?.fat ?? numberOr(raw.fat),
    servings: servings,
    tips: strList(raw.tips).slice(0, 3),
    note: raw.note ? String(raw.note).slice(0, 200) : undefined,
    imageUrl: undefined,
  };
}

export async function aiImproveRecipe(args: {
  title: string;
  ingredients: string[];
  steps: string[];
  goal: string;
  experience?: string;
  allergies?: string[];
}): Promise<any> {
  const allergyTags = (args.allergies ?? []).filter(Boolean);
  const system =
    'You are the Spoonful AI Chef. Improve an existing recipe and answer with valid JSON only. ' +
    'Same fields as a recipe: title, description, cuisine, mealType, ingredients (WITH amounts), steps, ' +
    'guides (one object per step, same order and same length, each {"coach": string or null, "look": string or null}; only difficult steps get a tip), ' +
    'prepTime, cookTime, difficulty, dietaryRestrictions, calories, protein, carbs, fat, tips (max 3) and ' +
    '"changes" (array of max 4 short strings describing what you changed). ' +
    'Keep every step the recipe really needs (usually 3 to 7), each a complete real action ending properly, never padded and never cut with "...". ' +
    'Every guide must match its own step and only name ingredients from that step; simple steps stay null. ' +
    'Never repeat the same tip on two steps. ' +
    'Keep the character of the dish, keep it realistic and metric. ' +
    'If the title is bland, make it specific and appetising without promising anything the recipe does not do. ' +
    (allergyTags.length ? `Never use: ${allergyTags.join(', ')}. ` : '') +
    (args.experience ? `Write the steps for a ${args.experience} cook. ` : '') +
    appLanguageRule();
  const user = [
    `Recipe: ${args.title}`,
    `Ingredients: ${args.ingredients.join('; ')}`,
    `Steps: ${args.steps.join(' ')}`,
    `Improvement goal: ${args.goal}`,
  ].join('\n');
  const raw = await chatJSON(system, user);
  const ingredients = strList(raw.ingredients);
  const { steps, guides } = finalizeStepsAndGuides(
    strList(raw.steps),
    Array.isArray(raw.guides) ? raw.guides : [],
    ingredients,
  );
  return {
    title: str(raw.title, args.title),
    description: str(raw.description),
    cuisine: str(raw.cuisine, 'Other'),
    ingredients,
    steps,
    guides,
    prepTime: intOr(raw.prepTime, 10),
    cookTime: intOr(raw.cookTime, 20),
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium',
    dietaryRestrictions: strList(raw.dietaryRestrictions),
    calories: numberOr(raw.calories),
    protein: numberOr(raw.protein),
    carbs: numberOr(raw.carbs),
    fat: numberOr(raw.fat),
    tips: strList(raw.tips).slice(0, 3),
    changes: strList(raw.changes).slice(0, 4),
    imageUrl: undefined,
  };
}

export async function aiSubstituteIngredient(args: {
  ingredient: string;
  dish?: string;
  diet?: string;
  allergies?: string[];
}): Promise<{ options: { name: string; amount: string; why: string }[] }> {
  const system =
    'You are a precise culinary assistant. Answer with valid JSON only: ' +
    '{"options":[{"name":string,"amount":string,"why":string}]} with exactly 3 options, ' +
    'each "why" max 12 words, practical supermarket alternatives, metric amounts. ' +
    appLanguageRule();
  const user = [
    `Replace "${args.ingredient}"${args.dish ? ` in a dish: ${args.dish}` : ''}.`,
    args.diet ? `The cook eats: ${args.diet}.` : '',
    (args.allergies ?? []).length ? `Avoid: ${(args.allergies ?? []).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const raw = await chatJSON(system, user);
  const options = Array.isArray(raw?.options) ? raw.options : [];
  return {
    options: options
      .map((o: any) => ({ name: str(o?.name), amount: str(o?.amount), why: str(o?.why) }))
      .filter((o: any) => o.name)
      .slice(0, 3),
  };
}

export async function aiRecipeFromText(args: {
  title?: string;
  text: string;
}): Promise<{ title: string; ingredients: string[]; steps: string[] } | null> {
  const raw = String(args.text ?? '').trim();
  if (raw.length < 60) return null;
  const system =
    'You adapt the description of a cooking video into the recipe format of the Spoonful app. ' +
    'The user text below is the description copied 1:1, word for word. Read all of it and treat it as ' +
    'the only source of truth: it is often one flowing paragraph without a list, and it may mix ' +
    'ingredients, amounts and narration in the same sentence. ' +
    'Answer with valid JSON only: {"title": string, "ingredients": string[], "steps": string[]}. ' +
    

    'TITLE: build it from the dish the description really makes, keep that dish recognisable and add the ' +
    'one detail that makes this version special (technique, texture or a defining ingredient the description ' +
    'actually uses), 2 to 6 words, sentence case, no emojis, no hashtags, no channel or creator name, no ' +
    '"recipe", no ALL CAPS, no clickbait. Only when the description names no dish at all, clean up the video ' +
    'title instead. ' +
    

    'PULL OUT every ingredient the description mentions, with the exact amount written there ' +
    '(e.g. "500 g Mehl", "2 EL Olivenöl", "1 Prise Salz"). Keep the wording of the amounts as written. ' +
    'NEVER add an ingredient the description does not name, never drop one it does name, never rename or ' +
    'substitute an ingredient, never change an amount, and keep the order the description uses. ' +
    'REMOVE everything that is not part of the recipe: subscribe/follow/like/share requests, ' +
    'channel or social media names, links and URLs, hashtags, emojis, giveaways, sponsor mentions, ' +
    '"watch the full video", timestamps and any sentence that is only talking to the audience. ' +
    'Split the description into individual short imperative steps and keep the order the description uses, ' +
    'and write them the way the cook performs them (informal du-form in German). ' +
    'Write as many complete steps as the description needs (usually 3 to 7), each one real action, and never pad the list to reach a count. ' +
    'Name the amount of each ingredient inside the step where it is used (e.g. "200 g Spaghetti"). ' +
    'Never add a step that only explains a rule, a temperature, a consistency or a timing range, ' +
    'never cut a step with "...", and only add a step when the description clearly says that action. ' +
    'Never invent ingredients, amounts or actions that are not in the description. ' +
    'Keep every amount exactly as written and translate the recipe into the app language. ' +
    'If the description contains no recipe at all, answer {"title":"","ingredients":[],"steps":[]}. ' +
    appLanguageRule();
  const user = [
    args.title ? `Video title (only a hint, the title must come from the description): ${args.title}` : '',
    'Description (1:1, verbatim):',
    raw.slice(0, 9000),
  ]
    .filter(Boolean)
    .join('\n');
  const parsed = await chatJSON(system, user, 0.2);
  const ingredients = strList(parsed?.ingredients)
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, 30);
  const steps = finalizeStepsAndGuides(strList(parsed?.steps), [], ingredients).steps;
  if (!ingredients.length || !steps.length) return null;
  return { title: str(parsed?.title, args.title ?? ''), ingredients, steps };
}

const NUTRITION_CACHE_KEY = 'spoonful:nutrition-cache:v3';

export function estimateNutritionLocally(
  ingredients: string[] | undefined,
  servings = 4,
): { calories: number; protein: number; carbs: number; fat: number } | null {
  const analyzed = analyzeRecipeNutrition(ingredients, servings);
  return analyzed ? analyzed.perServing : null;
}

/**
 * Per-serving macros computed from the ingredient amounts the recipe actually
 * lists. Used to keep AI-written recipes honest: when most of the weight is
 * recognised, the calculated values replace the model's guess.
 */
export function groundedMacros(
  ingredients: string[] | undefined,
  servings = 4,
  minCoverage = 0.6,
): { calories: number; protein: number; carbs: number; fat: number } | null {
  const analyzed = analyzeRecipeNutrition(ingredients, servings);
  if (!analyzed || analyzed.coverage < minCoverage) return null;
  return analyzed.perServing;
}

function nutritionKey(args: { title?: string; ingredients?: string[]; steps?: string[] }): string {
  const raw = `${args.title ?? ''}|${(args.ingredients ?? []).join(';')}|${(args.steps ?? []).length}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i += 1) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return `${NUTRITION_CACHE_KEY}:${(h >>> 0).toString(36)}`;
}

async function readNutritionCache(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeNutritionCache(key: string, value: object) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export type DairyAssumption = { kind: 'greekYogurt' | 'yogurt' | 'milk' | 'cream' | 'cheese'; ingredient: string };

const DAIRY_WORDS = {
  greek: 'greek|griech|grec|griego|greca|greco|yunan|грецьк|грец|يوناني',
  yogurt: 'yogurt|yoghurt|joghurt|йогурт|زبادي',
  milk: 'milk|milch|lait|leche|latte|süt|leite|melk|молок|молочк|حليب',
  cream: 'cream|sahne|crème|crema|panna|kaymak|сливк|вершк|قشطة|كريمة|natas',
  cheese: 'cheese|käse|fromage|queso|formaggio|peynir|queijo|kaas|сыр|сир|جبن',
};

function hasExplicitDairyFat(text: string): boolean {
  return /(\d+(?:[.,]\d+)?)\s*(?:%|percent(?:age)?|prozent|pour cent|por ciento|per cento|procent|процент(?:ів|а|ов)?|відсот(?:ка|ків)?)/i.test(text);
}

export function dairyAssumptions(ingredients: string[] | undefined): DairyAssumption[] {
  return (ingredients ?? []).flatMap((raw) => {
    const ingredient = String(raw ?? '').trim();
    if (!ingredient || hasExplicitDairyFat(ingredient)) return [];
    const text = ingredient.toLowerCase();
    const greek = new RegExp(`(${DAIRY_WORDS.greek}).*(${DAIRY_WORDS.yogurt})|(${DAIRY_WORDS.yogurt}).*(${DAIRY_WORDS.greek})`, 'i').test(text);
    const kind: DairyAssumption['kind'] | null = greek ? 'greekYogurt'
      : new RegExp(DAIRY_WORDS.yogurt, 'i').test(text) ? 'yogurt'
        : new RegExp(DAIRY_WORDS.milk, 'i').test(text) ? 'milk'
          : new RegExp(DAIRY_WORDS.cream, 'i').test(text) ? 'cream'
            : new RegExp(DAIRY_WORDS.cheese, 'i').test(text) ? 'cheese' : null;
    return kind ? [{ kind, ingredient }] : [];
  });
}

export async function aiEstimateNutrition(args: {
  title?: string;
  ingredients?: string[];
  steps?: string[];
  
  servings?: number;
}): Promise<{ calories?: number; protein?: number; carbs?: number; fat?: number }> {
  const servings = Math.max(1, Number(args.servings ?? 4) || 4);
  const key = nutritionKey(args);
  
  const cached = await readNutritionCache(key);
  if (cached && typeof cached.calories === 'number') return cached;

  const analyzed = analyzeRecipeNutrition(args.ingredients, servings);
  const local = analyzed?.perServing ?? null;
  const coverage = analyzed?.coverage ?? 0;

  // Fully recognised recipe: the calculation from USDA amounts is exact and
  // deterministic, so no AI call (and no quota) is spent on guessing it.
  if (local && coverage >= 0.9) {
    await writeNutritionCache(key, local);
    return local;
  }

  const system =
    'You are a nutritionist with a food-composition database. Estimate the nutrition PER SERVING from the ' +
    'exact amounts in the ingredient list. Answer with valid JSON only: ' +
    '{"calories": number, "protein": number, "carbs": number, "fat": number}. ' +
    'Rules: convert every amount to grams first (1 cup flour is 120 g, 1 cup sugar 200 g, 1 tbsp oil 14 g), ' +
    'use the raw or dry weight the recipe states, count oil, butter, sugar and nuts fully, and keep ' +
    'calories equal to 4x protein + 4x carbs + 9x fat. Never invent ingredients. ' +
    'When dairy fat percentages are missing, assume regular yogurt and milk at 3.5%, Greek yogurt at 10%, cream at 30%, and semi-hard cheese at about 27 g fat per 100 g. ' +
    'Use an explicit fat percentage when present. The app will disclose any standard assumptions to the user.';
  const user =
    `Recipe: ${args.title || 'Untitled'}\n\nIngredients:\n${(args.ingredients ?? []).join('\n')}\n\n` +
    `Steps:\n${(args.steps ?? []).join('\n')}\n\n` +
    `Give the values for exactly ${servings} servings.` +
    (local
      ? `\nCalculated from the amounts above: about ${local.calories} kcal, ${local.protein} g protein, ` +
        `${local.carbs} g carbs, ${local.fat} g fat per serving (${Math.round(coverage * 100)}% of the weight recognised).`
      : '') +
    ((analyzed?.unknown.length ?? 0)
      ? `\nThese ingredients are not in the database, judge them carefully: ${analyzed!.unknown.join(', ')}.`
      : '');

  let ai: { calories?: number; protein?: number; carbs?: number; fat?: number } | null = null;
  try {
    
    const raw = await chatJSON(system, user, 0);
    ai = {
      calories: intOr(raw.calories),
      protein: numberOr(raw.protein),
      carbs: numberOr(raw.carbs),
      fat: numberOr(raw.fat),
    };
  } catch {
    ai = null;
  }

  const round1 = (v?: number) => (v == null ? undefined : Math.round(v * 10) / 10);
  let result: { calories?: number; protein?: number; carbs?: number; fat?: number } | null = null;

  const aiMacros = ai?.calories
    ? consistent({ calories: ai.calories, protein: ai.protein ?? 0, carbs: ai.carbs ?? 0, fat: ai.fat ?? 0 })
    : null;

  if (local && aiMacros) {
    // The database result is trusted for the weight it covers; the model only
    // fills the part it could not recognise. No blind averaging.
    const aiWeight = Math.min(0.6, Math.max(0.15, 1 - coverage));
    result = consistent({
      calories: local.calories * (1 - aiWeight) + aiMacros.calories * aiWeight,
      protein: local.protein * (1 - aiWeight) + aiMacros.protein * aiWeight,
      carbs: local.carbs * (1 - aiWeight) + aiMacros.carbs * aiWeight,
      fat: local.fat * (1 - aiWeight) + aiMacros.fat * aiWeight,
    });
  } else if (aiMacros) {
    result = { ...aiMacros, protein: round1(aiMacros.protein), carbs: round1(aiMacros.carbs), fat: round1(aiMacros.fat) };
  } else if (local) {
    result = local;
  }

  if (!result?.calories) throw new Error('The AI could not estimate this recipe. Please try again.');
  await writeNutritionCache(key, result);
  return result;
}
