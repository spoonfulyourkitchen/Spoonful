/**
 * Seasonal produce for the "in season now" shelf (2.0.0).
 *
 * The recipe catalog mixes English and German titles/ingredients, so every
 * month returns both spellings - then a single search hits the whole catalog.
 * No network, no cost, works offline.
 */
const MONTHS: string[][] = [
  // Jan
  ['kale', 'leek', 'carrot', 'beetroot', 'cabbage', 'orange', 'apple', 'Grünkohl', 'Lauch', 'Karotte', 'Rote Bete', 'Kohl', 'Orange', 'Apfel'],
  // Feb
  ['kale', 'leek', 'carrot', 'beetroot', 'celery', 'orange', 'pear', 'Grünkohl', 'Lauch', 'Karotte', 'Sellerie', 'Orange', 'Birne'],
  // Mar
  ['spinach', 'radish', 'leek', 'lettuce', 'asparagus', 'Spinach', 'Spinat', 'Radieschen', 'Lauch', 'Salat', 'Spargel'],
  // Apr
  ['asparagus', 'radish', 'spinach', 'lettuce', 'peas', 'strawberry', 'Spargel', 'Radieschen', 'Spinat', 'Salat', 'Erbsen', 'Erdbeere'],
  // May
  ['asparagus', 'peas', 'lettuce', 'cucumber', 'strawberry', 'rhubarb', 'Spargel', 'Erbsen', 'Salat', 'Gurke', 'Erdbeere', 'Rhabarber'],
  // Jun
  ['courgette', 'zucchini', 'cucumber', 'tomato', 'cherry', 'strawberry', 'blueberry', 'Zucchini', 'Gurke', 'Tomate', 'Kirsche', 'Erdbeere', 'Heidelbeere'],
  // Jul
  ['tomato', 'courgette', 'bell pepper', 'cucumber', 'aubergine', 'eggplant', 'peach', 'Tomate', 'Zucchini', 'Paprika', 'Gurke', 'Aubergine', 'Pfirsich'],
  // Aug
  ['tomato', 'aubergine', 'bell pepper', 'courgette', 'sweet corn', 'plum', 'Tomate', 'Aubergine', 'Paprika', 'Zucchini', 'Mais', 'Pflaume'],
  // Sep
  ['pumpkin', 'mushroom', 'apple', 'pear', 'plum', 'grapes', 'Kürbis', 'Pilz', 'Apfel', 'Birne', 'Pflaume', 'Trauben'],
  // Oct
  ['pumpkin', 'mushroom', 'apple', 'pear', 'chestnut', 'cabbage', 'Kürbis', 'Pilz', 'Apfel', 'Birne', 'Kastanie', 'Kohl'],
  // Nov
  ['pumpkin', 'kale', 'leek', 'beetroot', 'chestnut', 'Kürbis', 'Grünkohl', 'Lauch', 'Rote Bete', 'Kastanie'],
  // Dec
  ['kale', 'leek', 'cabbage', 'chestnut', 'orange', 'tangerine', 'Grünkohl', 'Lauch', 'Kohl', 'Kastanie', 'Orange', 'Mandarine'],
];

/** Terms for the current month (or a given month index 0-11). */
export function seasonalTerms(month = new Date().getMonth()): string[] {
  const list = MONTHS[Math.max(0, Math.min(11, month))] ?? [];
  const seen = new Set<string>();
  return list.filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Splits a free text pantry input into single ingredient terms. */
export function pantryTerms(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 1)
    .slice(0, 12);
}
