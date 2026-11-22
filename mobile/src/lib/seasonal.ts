

const MONTHS: string[][] = [
  ['kale', 'leek', 'carrot', 'beetroot', 'cabbage', 'orange', 'apple', 'Grünkohl', 'Lauch', 'Karotte', 'Rote Bete', 'Kohl', 'Orange', 'Apfel'],
  ['kale', 'leek', 'carrot', 'beetroot', 'celery', 'orange', 'pear', 'Grünkohl', 'Lauch', 'Karotte', 'Sellerie', 'Orange', 'Birne'],
  ['spinach', 'radish', 'leek', 'lettuce', 'asparagus', 'Spinach', 'Spinat', 'Radieschen', 'Lauch', 'Salat', 'Spargel'],
  ['asparagus', 'radish', 'spinach', 'lettuce', 'peas', 'strawberry', 'Spargel', 'Radieschen', 'Spinat', 'Salat', 'Erbsen', 'Erdbeere'],
  ['asparagus', 'peas', 'lettuce', 'cucumber', 'strawberry', 'rhubarb', 'Spargel', 'Erbsen', 'Salat', 'Gurke', 'Erdbeere', 'Rhabarber'],
  ['courgette', 'zucchini', 'cucumber', 'tomato', 'cherry', 'strawberry', 'blueberry', 'Zucchini', 'Gurke', 'Tomate', 'Kirsche', 'Erdbeere', 'Heidelbeere'],
  ['tomato', 'courgette', 'bell pepper', 'cucumber', 'aubergine', 'eggplant', 'peach', 'Tomate', 'Zucchini', 'Paprika', 'Gurke', 'Aubergine', 'Pfirsich'],
  ['tomato', 'aubergine', 'bell pepper', 'courgette', 'sweet corn', 'plum', 'Tomate', 'Aubergine', 'Paprika', 'Zucchini', 'Mais', 'Pflaume'],
  ['pumpkin', 'mushroom', 'apple', 'pear', 'plum', 'grapes', 'Kürbis', 'Pilz', 'Apfel', 'Birne', 'Pflaume', 'Trauben'],
  ['pumpkin', 'mushroom', 'apple', 'pear', 'chestnut', 'cabbage', 'Kürbis', 'Pilz', 'Apfel', 'Birne', 'Kastanie', 'Kohl'],
  ['pumpkin', 'kale', 'leek', 'beetroot', 'chestnut', 'Kürbis', 'Grünkohl', 'Lauch', 'Rote Bete', 'Kastanie'],
  ['kale', 'leek', 'cabbage', 'chestnut', 'orange', 'tangerine', 'Grünkohl', 'Lauch', 'Kohl', 'Kastanie', 'Orange', 'Mandarine'],
];

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

export function pantryTerms(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 1)
    .slice(0, 12);
}
