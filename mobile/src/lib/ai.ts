/**
 * AI calls for the AI Chef and the nutrition estimator.
 *
 * Security: the OpenRouter key is NOT part of the app any more. Every request
 * goes through the Supabase Edge Function `ai` (see supabase/functions/ai),
 * which holds the key as a server secret and only answers signed-in users.
 * Deploying that function once is enough — no app update needed afterwards.
 */
import { supabase } from './supabase';
import { withTimeout } from './safe';

/** 3.2.2: Obergrenze für einen KI-Aufruf. */
const AI_TIMEOUT_MS = 60000;

/* ── 3.2.3: Tageslimit-Anzeige ───────────────────────────────────────────────
 * Alle drei Chef-Funktionen (Zutaten, Beschreiben, Video) teilen sich ein
 * Tageslimit. Der Server zählt in der Datenbank; die App liest den Stand nur
 * zum Anzeigen und aktualisiert ihn nach jedem Aufruf.
 * ------------------------------------------------------------------------- */
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

/** Stand vom Server holen (z. B. beim Start und nach jeder Nutzung). */
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

/** Turns an edge-function failure into a message a human can act on. */
async function functionError(error: any): Promise<string> {
  const status = Number(error?.context?.status ?? error?.status ?? 0);
  let detail = '';
  try {
    const body = await error?.context?.text?.();
    if (body) detail = String(body);
  } catch {
    /* body already consumed */
  }
  if (status === 404) {
    return 'AI is not available yet: deploy the Supabase function "ai" (supabase/functions/ai) and set OPENROUTER_API_KEY as its secret.';
  }
  if (status === 401 || status === 403) return 'AI access was denied. Please sign in again.';
  if (status === 429) {
    /* 3.2.3: 429 heißt jetzt auch „Tageslimit erreicht" — das muss der Nutzer
       anders lesen als „Server ist gerade beschäftigt". */
    if (/daily_limit_reached/i.test(detail)) {
      return 'You have used all 3 AI requests for today. Come back tomorrow.';
    }
    return 'The AI is busy right now. Please try again in a moment.';
  }
  return `AI request failed${status ? ` (${status})` : ''}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
}

async function chatJSON(system: string, user: string, temperature = 0.7): Promise<any> {
  // 3.2.2: Zeitlimit (Punkt 13). Ohne das konnte ein hängender KI-Aufruf die
  // Oberfläche „einfrieren" lassen, weil auf das Versprechen kein Ende kam.
  const { data, error } = await withTimeout(
    supabase.functions.invoke('ai', {
      body: {
        system,
        user,
        temperature: Math.max(0, Math.min(1.2, Number(temperature) || 0.7)),
      },
    }),
    AI_TIMEOUT_MS,
    'Die KI hat zu lange gebraucht.',
  );
  if (error) throw new Error(await functionError(error));
  /* 3.2.3: Der Server schickt den neuen Zählerstand mit — damit ist die
     Anzeige im Kopf sofort aktuell, ohne zusätzliche Anfrage. */
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

/* ── language mirroring (2.1.2) ─────────────────────────────────────────────
 * The AI must answer in the language the USER wrote in - not in the language
 * of the app settings. Example: the app runs in German, the user describes the
 * recipe in Turkish -> the recipe comes back in Turkish.
 *
 * Detection is deliberately local and cheap (script ranges + stopword voting),
 * so it costs no extra request and works offline.
 */

const SCRIPT_LANGUAGES: [RegExp, { code: string; name: string }][] = [
  [/[\u0600-\u06FF\u0750-\u077F]/, { code: 'ar', name: 'Arabic' }],
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
  en: { name: 'English', words: ['and', 'with', 'for', 'the', 'not', 'this', 'that', 'some', 'have', 'from', 'make', 'without', 'more'] },
};

/** Language of a free-text input; `null` when it cannot be told. */
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

/**
 * Instruction for the model: mirror the user's language.
 * `samples` are the free-text inputs of the request (prompt, ingredients, …).
 */
function languageRule(samples: Array<string | undefined>): string {
  const detected = samples.map((s) => detectInputLanguage(s)).find(Boolean);
  const base =
    "IMPORTANT: Answer in the same language the user wrote in - never switch to the app's UI language.";
  return detected
    ? `${base} The user wrote in ${detected.name}, so write EVERY text field (title, description, ingredient names, steps, tips) in ${detected.name}.`
    : `${base} Keep every text field in the language of the user's message.`;
}

/** AI Chef — builds a full recipe from ingredients OR a free-text description. */
export type AiRecipeArgs = {
  availableIngredients?: string;
  dietaryPreferences?: string;
  prompt?: string;
  /** Cooking experience - controls how detailed the steps are written. */
  experience?: string;
  /** lose | keep | gain - balances the recipe towards the goal. */
  goal?: string;
  /** vegetarian | vegan | halal | ... */
  diet?: string;
  /** hard exclusions from the onboarding (nuts, milk, gluten, ...) */
  allergies?: string[];
  /** 1) how many servings the recipe should be written for */
  servings?: number;
  /** 2) preferred cuisine (italian, thai, ...) */
  cuisine?: string;
  /** 3) hard time budget in minutes (prep + cook) */
  maxMinutes?: number;
  /** 4) difficulty cap: easy | medium | hard */
  difficulty?: string;
  /** 5) spice level: mild | medium | hot */
  spice?: string;
  /** 6) make it lighter (fewer calories, less fat) */
  lighter?: boolean;
  /** 7) kid friendly (no alcohol, no chili, less salt) */
  kidFriendly?: boolean;
  /** 8) only these tools are available */
  equipment?: string;
  /** 9) titles to avoid so a reroll gives something new */
  avoidTitles?: string[];
  /** 10) let the model explain in one sentence why the recipe fits */
  explain?: boolean;
  /** variation knob for rerolls */
  temperature?: number;
};

export async function aiGenerateRecipe(args: AiRecipeArgs): Promise<any> {
  const experience = String(args.experience ?? '').toLowerCase();
  const detailRule =
    experience === 'beginner' || experience === '1-2 years'
      ? 'Write for a beginner: explain every technique in short, simple sentences and mention what "done" looks like.'
      : experience === 'professional' || experience === '5+ years'
        ? 'Write for an experienced cook: keep steps tight, use precise culinary terms and temperatures.'
        : 'Write for an average home cook: clear steps without over-explaining.';
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
    ? `Only these tools may be used: ${args.equipment}. Never assume anything else is available.`
    : 'Use only basic kitchen tools (knife, pan, pot, oven or stove).';
  const avoidRule =
    (args.avoidTitles ?? []).length > 0
      ? `Do not repeat any of these already cooked dishes: ${(args.avoidTitles ?? []).slice(0, 8).join(' | ')}. Pick a clearly different dish.`
      : '';
  const noteRule = args.explain
    ? 'Also add a field "note": one short sentence (max 20 words) explaining why this recipe fits the constraints.'
    : '';

  const system =
    'You are the Spoonful AI Chef, a calm, precise professional recipe developer. ' +
    'Always answer with valid JSON only (no markdown, no commentary). Fields exactly: ' +
    'title, description (2-3 sentences), cuisine, mealType, ingredients (array of strings WITH amounts, e.g. "200 g pasta"), ' +
    'steps (array of clear imperative strings, each 1-2 sentences, ordered), prepTime (minutes, number), ' +
    'cookTime (minutes, number), difficulty ("easy"|"medium"|"hard"), dietaryRestrictions (array of lowercase tags), ' +
    'calories, protein, carbs, fat (numbers, per serving), tips (array of up to 3 short strings)' +
    (args.explain ? ', note' : '') +
    '. ' +
    'Rules: realistic amounts, correct cooking technique, no invented exotic equipment, no brand names, ' +
    /* 3.3.0: Rezepte müssen ausführlich sein — mindestens 8 Schritte, auch bei
       einfachen Gerichten (Vorbereitung, Zwischenschritte, Finish). */
    'max 12 ingredients, AT LEAST 8 steps (never fewer than 8), metric units. ' +
    'Write every step so it can be followed without thinking: one action per step, ' +
    'with amounts and times inside the step. ' +
    detailRule +
    ' ' +
    goalRule +
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
    /* 2.1.2: mirror the language of the user's request */
    ' ' +
    languageRule([args.prompt, args.availableIngredients, args.dietaryPreferences]);
  const user = [
    args.prompt
      ? `Create ONE recipe that matches this request: "${args.prompt.trim()}".`
      : `Create ONE recipe using mainly these ingredients: ${args.availableIngredients || 'anything available'}.`,
    args.dietaryPreferences ? `Dietary requirements: ${args.dietaryPreferences}.` : '',
    args.diet ? `The cook eats: ${args.diet}.` : '',
    allergyTags.length ? `Allergies (must be excluded): ${allergyTags.join(', ')}.` : '',
    args.cuisine ? `Cuisine: ${args.cuisine}.` : '',
    `Write it for exactly ${servings} servings and make the nutrition values realistic for that portion.`,
    'Keep the description appetising but factual.',
  ]
    .filter(Boolean)
    .join('\n');
  // 20) robust answer handling: one retry, warm-up temperature for rerolls,
  // plus tips and the short "why it fits" note from the model.
  let raw: any = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
    try {
      raw = await chatJSON(system, user, args.temperature);
    } catch (e) {
      lastError = e;
    }
  }
  if (!raw) throw (lastError instanceof Error ? lastError : new Error('The AI could not answer. Please try again.'));
  if (!Array.isArray(raw.ingredients) || !raw.ingredients.length) {
    throw new Error('The AI answer was incomplete. Please try again.');
  }
  return {
    title: str(raw.title, 'AI recipe'),
    description: str(raw.description),
    cuisine: str(raw.cuisine, 'Other'),
    ingredients: strList(raw.ingredients),
    steps: strList(raw.steps),
    prepTime: intOr(raw.prepTime, 10),
    cookTime: intOr(raw.cookTime, 20),
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium',
    dietaryRestrictions: strList(raw.dietaryRestrictions),
    mealType: raw.mealType ? String(raw.mealType) : undefined,
    calories: numberOr(raw.calories),
    protein: numberOr(raw.protein),
    carbs: numberOr(raw.carbs),
    fat: numberOr(raw.fat),
    servings: servings,
    tips: strList(raw.tips).slice(0, 3),
    note: raw.note ? String(raw.note).slice(0, 200) : undefined,
    imageUrl: undefined,
  };
}

/** 11) Rewrites an existing recipe with a goal (lighter, cheaper, faster, vegan…). */
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
    'prepTime, cookTime, difficulty, dietaryRestrictions, calories, protein, carbs, fat, tips (max 3) and ' +
    '"changes" (array of max 4 short strings describing what you changed). ' +
    'Keep the character of the dish, keep it realistic and metric. ' +
    (allergyTags.length ? `Never use: ${allergyTags.join(', ')}. ` : '') +
    (args.experience ? `Write the steps for a ${args.experience} cook. ` : '') +
    languageRule([args.title, args.ingredients.join(' ')]);
  const user = [
    `Recipe: ${args.title}`,
    `Ingredients: ${args.ingredients.join('; ')}`,
    `Steps: ${args.steps.join(' ')}`,
    `Improvement goal: ${args.goal}`,
  ].join('\n');
  const raw = await chatJSON(system, user);
  return {
    title: str(raw.title, args.title),
    description: str(raw.description),
    cuisine: str(raw.cuisine, 'Other'),
    ingredients: strList(raw.ingredients),
    steps: strList(raw.steps),
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

/** 12) Suggests replacements for one ingredient that is missing or unwanted. */
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
    languageRule([args.ingredient, args.dish]);
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

/**
 * 3.2.1: Ordnet einen Video-Text (Beschreibung/Untertitel) zu einem Rezept.
 *
 * Wird nur als **Notfall** benutzt, wenn die lokale Erkennung nichts findet.
 * Läuft über die Supabase-Funktion `ai`, die Gratis-Modelle benutzt - es wird
 * also kein Guthaben verbraucht. Bei Fehlern kommt `null` zurück.
 */
export async function aiRecipeFromText(args: {
  title?: string;
  text: string;
}): Promise<{ title: string; ingredients: string[]; steps: string[] } | null> {
  const raw = String(args.text ?? '').trim();
  if (raw.length < 60) return null;
  const system =
    'You turn the description or the subtitles of a cooking video into a clean, complete recipe. ' +
    'Answer with valid JSON only: {"title": string, "ingredients": string[], "steps": string[]}. ' +
    /* 3.3.0: Videos enthalten viel Müll (Abo-Aufrufe, Links, Hashtags, Werbung,
       „bewertet das Video") — der gehört nicht in ein Rezept. Fehlende Schritte
       ergänzt die KI aus dem, was im Video steht. */
    'REMOVE everything that is not part of the recipe: subscribe/follow/like/share requests, ' +
    'channel or social media names, links and URLs, hashtags, emojis, giveaways, sponsor mentions, ' +
    '"watch the full video", timestamps and any sentence that is only talking to the audience. ' +
    'Split longer narration into individual short imperative steps, in the correct cooking order. ' +
    'If the video gives fewer than 8 steps but enough information, ADD the missing obvious steps ' +
    '(preparation, heating, resting, seasoning, plating) so the recipe has AT LEAST 8 steps — ' +
    'but never invent ingredients or amounts that are not in the text. ' +
    'Keep the original language of the text and keep every amount (e.g. "500 g Mehl"). ' +
    'If the text contains no recipe at all, answer {"title":"","ingredients":[],"steps":[]}.';
  const user = [args.title ? `Video title: ${args.title}` : '', 'Text:', raw.slice(0, 6000)]
    .filter(Boolean)
    .join('\n');
  const parsed = await chatJSON(system, user, 0.2);
  const ingredients = strList(parsed?.ingredients)
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, 30);
  const steps = strList(parsed?.steps)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 25);
  if (!ingredients.length || !steps.length) return null;
  return { title: str(parsed?.title, args.title ?? ''), ingredients, steps };
}

/** Nutrition estimator used on the recipe form. */
export async function aiEstimateNutrition(args: {
  title?: string;
  ingredients?: string[];
  steps?: string[];
}): Promise<{ calories?: number; protein?: number; carbs?: number; fat?: number }> {
  const system =
    'You are a nutritionist. Estimate nutrition for the described recipe. ' +
    'Answer with valid JSON only: {"calories": number, "protein": number, "carbs": number, "fat": number}.';
  const user =
    `Recipe: ${args.title || 'Untitled'}\n\nIngredients:\n${(args.ingredients ?? []).join('\n')}\n\n` +
    `Steps:\n${(args.steps ?? []).join('\n')}\n\nEstimate per serving (assume 4 servings).`;
  const raw = await chatJSON(system, user);
  return {
    calories: intOr(raw.calories),
    protein: numberOr(raw.protein),
    carbs: numberOr(raw.carbs),
    fat: numberOr(raw.fat),
  };
}
