

import { detectPhase, type CoachPhase } from './coach-tips';

export type StepAction =
  | 'preheat' | 'prep' | 'mix' | 'cook' | 'fry' | 'bake' | 'boil' | 'season' | 'rest' | 'serve' | 'cool' | 'decorate';

export type StepDifficulty = 'easy' | 'medium' | 'hard';
export type StepGroup = 'prep' | 'cook' | 'finish';

const ACTION_RULES: [StepAction, RegExp][] = [
  ['preheat', /(preheat|heat the oven|warm the)/i],
  ['prep', /(wash|rinse|peel|chop|dice|slice|mince|grate|trim|cut into|measure|weigh|soak|drain)/i],
  ['mix', /(mix|stir|combine|whisk|fold|blend|knead|pour|add the|toss)/i],
  ['bake', /(bake|roast|broil|oven|air ?fry)/i],
  ['boil', /(boil|simmer|reduce|steam|poach)/i],
  ['fry', /(fry|saut|sear|grill|pan.?fry|caramel)/i],
  ['season', /(season|salt|pepper|spice|taste)/i],
  ['rest', /(rest|let it sit|stand for|chill|refrigerate|marinate|cool down)/i],
  ['cool', /(cool|refrigerate|freeze)/i],
  ['serve', /(serve|plate|garnish|top with|drizzle|sprinkle)/i],
  ['decorate', /(garnish|decorate|dust|sprinkle)/i],
  ['cook', /(cook|simmer|stew|braise|stir.?fry)/i],
];

export function stepAction(step: string): StepAction {
  const text = String(step || '');
  for (const [action, re] of ACTION_RULES) if (re.test(text)) return action;
  return 'cook';
}

export function stepShortText(step: string, words = 6): string {
  const clean = String(step || '').replace(/^\s*\d+[.)]\s*/, '').trim();
  const parts = clean.split(/\s+/).slice(0, words).join(' ');
  return parts.length < clean.length ? `${parts}…` : parts;
}

export function stepDifficulty(step: string): StepDifficulty {
  const text = String(step || '').toLowerCase();
  if (/(deep.?fry|friture|caramel|temper|flamb|dough|knead|ferment|proof|laminate|fillet|debone)/.test(text)) return 'hard';
  if (/(sear|fry|grill|roast|bake|simmer|reduc|emulsif|whisk|knead|fold|shape|fill|stuff)/.test(text)) return 'medium';
  return 'easy';
}

export function estimateStepMinutes(step: string, index: number, total: number): number {
  const text = String(step || '');
  const explicit = /(\d+)\s*(?:-|to|–)?\s*(\d+)?\s*(?:minutes?|min)\b/i.exec(text);
  if (explicit) {
    const a = Number(explicit[1]);
    const b = explicit[2] ? Number(explicit[2]) : a;
    const mid = Math.round((a + b) / 2);
    if (mid > 0 && mid <= 240) return mid;
  }
  const hours = /(\d+(?:[.,]\d+)?)\s*(?:hours?|h)\b/i.exec(text);
  if (hours) {
    const h = Math.round(Number(String(hours[1]).replace(',', '.')) * 60);
    if (h > 0 && h <= 600) return h;
  }
  const seconds = /(\d+)\s*(?:seconds?|sec)\b/i.exec(text);
  if (seconds) return 1;
  const action = stepAction(text);
  const base: Record<StepAction, number> = {
    preheat: 10, prep: 5, mix: 3, cook: 10, fry: 8, bake: 25, boil: 12, season: 2, rest: 15, serve: 3, cool: 20, decorate: 2,
  };
  const lastBonus = index === total - 1 ? 3 : 0;
  return Math.max(1, base[action] + lastBonus);
}

export function splitSubSteps(step: string): string[] {
  const clean = String(step || '').trim();
  const parts = clean
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length <= 1) {
    const alt = clean.split(/,\s+(?=(?:then|and then|after that|danach|dann)\s)/i).map((s) => s.trim()).filter(Boolean);
    return alt.length > 1 ? alt : [clean];
  }
  return parts;
}

export function stepDependency(step: string): 'meanwhile' | 'until' | 'rest' | null {
  const text = String(step || '').toLowerCase();
  if (/(meanwhile|in the meantime|while|währenddessen)/.test(text)) return 'meanwhile';
  if (/(until|bis (?:der|die|das)|till)/.test(text)) return 'until';
  if (/(let (?:it|the .*?) rest|rest for|stand for|ruhen)/.test(text)) return 'rest';
  return null;
}

export function stepGroup(step: string, index: number, total: number): StepGroup {
  const phase: CoachPhase = detectPhase(step, index, total);
  if (phase === 'finish') return 'finish';
  if (phase === 'cook') return 'cook';
  return 'prep';
}
