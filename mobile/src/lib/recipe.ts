import { translate } from './i18n';

export type LibraryRecipe = {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  prepTime: number;
  cookTime: number;
  cuisine: string;
  dietaryRestrictions: string[];
  mealType?: string;
  imageUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  guides?: any[];
  tips?: string[];
  note?: string;
};

export function formatCuisine(code: string): string {
  if (!code) return 'Other';
  return code
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const DIET_KEYS: Record<string, string> = {
  vegetarian: 'onb.vegetarian',
  vegan: 'onb.vegan',
  pescatarian: 'onb.pescatarian',
  halal: 'onb.halal',
  kosher: 'onb.kosher',
  'gluten-free': 'onb.glutenFree',
  'dairy-free': 'onb.lactoseFree',
};

export function formatDiet(tag: string): string {
  const key = tag.replace(/_/g, '-').toLowerCase();
  const mapped = DIET_KEYS[key];
  return mapped ? translate(mapped) : key;
}

export function totalMinutes(recipe: Pick<LibraryRecipe, 'prepTime' | 'cookTime'>): number {
  return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

export function difficultyLabel(level: string): string {
  if (level === 'easy') return translate('recipe.easy');
  if (level === 'hard') return translate('recipe.hard');
  return translate('recipe.medium');
}

export function nutritionParts(recipe: LibraryRecipe): string[] {
  const parts: string[] = [];
  if (recipe.calories != null) parts.push(`${recipe.calories} kcal`);
  if (recipe.protein != null) parts.push(`${recipe.protein}g protein`);
  if (recipe.carbs != null) parts.push(`${recipe.carbs}g carbs`);
  if (recipe.fat != null) parts.push(`${recipe.fat}g fat`);
  return parts;
}

export function recipeLine(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(recipeLine).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const o = value as any;
    for (const key of ['text', 'line', 'step', 'instruction', 'description', 'name', 'title', 'item', 'ingredient', 'value']) {
      if (typeof o[key] === 'string' && o[key].trim()) return o[key].trim();
    }
    const amount = o.amount ?? o.quantity ?? o.qty;
    const unit = o.unit ?? o.measure;
    const name = o.name ?? o.item ?? o.ingredient ?? o.title;
    if (amount != null || unit != null) {
      const parts = [amount, unit, name].filter((p) => p != null && String(p).trim() !== '').map((p) => String(p).trim());
      if (parts.length) return parts.join(' ');
    }
    try {
      const json = JSON.stringify(value);
      return json === '{}' || json === '[]' ? '' : json;
    } catch {
      return '';
    }
  }
  return String(value);
}

export function recipeLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(recipeLine).filter((s) => s.length > 0);
  if (typeof value === 'string') return value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export function asRecipeFromDoc(doc: any, id?: string): LibraryRecipe {
  return {
    id: id ?? doc.recipeKey ?? doc._id,
    title: recipeLine(doc.title) || 'Untitled recipe',
    description: recipeLine(doc.description),
    ingredients: recipeLines(doc.ingredients),
    steps: recipeLines(doc.steps),
    prepTime: Number(doc.prepTime ?? doc.prepMinutes ?? 0) || 0,
    cookTime: Number(doc.cookTime ?? doc.cookMinutes ?? 0) || 0,
    cuisine: recipeLine(doc.cuisine) || 'Other',
    dietaryRestrictions: recipeLines(doc.dietaryRestrictions),
    imageUrl: doc.imageUrl,
    difficulty: doc.difficulty ?? 'medium',
    calories: doc.calories,
    protein: doc.protein,
    carbs: doc.carbs,
    fat: doc.fat,
    guides: Array.isArray(doc.guides) ? doc.guides : [],
    tips: recipeLines(doc.tips),
    note: recipeLine(doc.note ?? doc.aiNote),
  };
}

const SEARCH_SYNONYMS: Record<string, string> = {
  aubergine: 'eggplant', melanzane: 'eggplant', باذنجان: 'eggplant',
  kichererbse: 'chickpea', kichererbsen: 'chickpeas', حمص: 'chickpea',
  huhn: 'chicken', hähnchen: 'chicken', poulet: 'chicken', pollo: 'chicken', دجاج: 'chicken',
  rindfleisch: 'beef', bœuf: 'beef', carne: 'beef', لحم: 'beef',
  lamm: 'lamb', agneau: 'lamb', خروف: 'lamb',
  schweinefleisch: 'pork', porc: 'pork', cerdo: 'pork',
  fisch: 'fish', poisson: 'fish', pesce: 'fish', سمك: 'fish',
  garnele: 'shrimp', garnelen: 'shrimp', crevettes: 'shrimp', روبيان: 'shrimp',
  kartoffel: 'potato', kartoffeln: 'potato', pommes: 'potato', patata: 'potato', batata: 'potato', بطاطس: 'potato',
  tomate: 'tomato', tomaten: 'tomato', طماطم: 'tomato',
  zwiebel: 'onion', zwiebeln: 'onion', oignon: 'onion', cebolla: 'onion', بصل: 'onion',
  knoblauch: 'garlic', ail: 'garlic', ajo: 'garlic', ثوم: 'garlic',
  ingwer: 'ginger', gingembre: 'ginger', زنجبيل: 'ginger',
  reis: 'rice', riz: 'rice', arroz: 'rice',
  nudeln: 'noodles', pâtes: 'pasta', pasta: 'pasta',
  brot: 'bread', pain: 'bread', pan: 'bread',
  käse: 'cheese', fromage: 'cheese', queso: 'cheese',
  milch: 'milk', lait: 'milk', leche: 'milk',
  ei: 'egg', eier: 'eggs', œufs: 'eggs', huevos: 'eggs',
  mehl: 'flour', farine: 'flour', harina: 'flour',
  zucker: 'sugar', sucre: 'sugar', azúcar: 'sugar',
  salz: 'salt', sel: 'salt', sal: 'salt',
  pfeffer: 'pepper', poivre: 'pepper', pimienta: 'pepper',
  öl: 'oil', huile: 'oil', aceite: 'oil',
  butter: 'butter', beurre: 'butter', mantequilla: 'butter',
  joghurt: 'yogurt', yaourt: 'yogurt', yogur: 'yogurt',
  sahne: 'cream', crème: 'cream', nata: 'cream',
  spinat: 'spinach', épinards: 'spinach', espinaca: 'spinach',
  pilz: 'mushroom', champignon: 'mushroom', champiñón: 'mushroom',
  gurke: 'cucumber', concombre: 'cucumber', pepino: 'cucumber',
  karotte: 'carrot', karotten: 'carrots', carotte: 'carrot', zanahoria: 'carrot',
  zucchini: 'zucchini', courgette: 'zucchini', calabacín: 'zucchini',
  paprika: 'pepper', poivron: 'pepper', pimiento: 'pepper',
  linsen: 'lentils', lentilles: 'lentils', lentejas: 'lentils',
  bohnen: 'beans', haricots: 'beans', frijoles: 'beans',
  banane: 'banana', plátano: 'banana',
  apfel: 'apple', pomme: 'apple', manzana: 'apple',
  zitrone: 'lemon', citron: 'lemon', limón: 'lemon',
  minze: 'mint', menthe: 'mint', menta: 'mint',
  petersilie: 'parsley', persil: 'parsley', perejil: 'parsley',
  koriander: 'coriander', coriandre: 'coriander', cilantro: 'coriander',
  kreuzkümmel: 'cumin', cumin: 'cumin', comino: 'cumin',
  zimt: 'cinnamon', cannelle: 'cinnamon', canela: 'cinnamon',
  honig: 'honey', miel: 'honey',
  schokolade: 'chocolate', chocolat: 'chocolate', chocolate: 'chocolate',
  kokosmilch: 'coconut milk', 'lait de coco': 'coconut milk',
  tomatensauce: 'tomato sauce', 'sauce tomate': 'tomato sauce',
  brühe: 'broth', bouillon: 'broth', caldo: 'broth',
  nudelsuppe: 'noodle soup', suppe: 'soup', soupe: 'soup', sopa: 'soup',
  salat: 'salad', salade: 'salad', ensalada: 'salad',
  auflauf: 'casserole', curry: 'curry',
};

export function translateSearchTerm(term: string): string {
  const q = term.trim().toLowerCase();
  if (!q) return term.trim();
  if (SEARCH_SYNONYMS[q]) return SEARCH_SYNONYMS[q];
  const [head, ...rest] = q.split(/\s+/);
  if (SEARCH_SYNONYMS[head]) return [SEARCH_SYNONYMS[head], ...rest].join(' ');
  return term.trim();
}

export function mealTypeLabel(mealType?: string): string {
  if (!mealType || mealType === 'all') return 'Main';
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}
