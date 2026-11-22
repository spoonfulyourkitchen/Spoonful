jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/ai', () => ({ aiRecipeFromText: jest.fn(async () => null) }));

import {
  normalizeQuantities,
  parseRecipeFromText,
  readVideoCache,
  recipeFromText,
  videoCacheKey,
} from '../src/lib/video-recipe';

describe('normalizeQuantities', () => {
  test('gemischte Brüche werden zu Zahlen', () => {
    expect(normalizeQuantities('½ TL Salz')).toBe('0.5 TL Salz');
    expect(normalizeQuantities('1 ½ Tassen Mehl')).toBe('1.5 Tassen Mehl');
    expect(normalizeQuantities('2 1/2 EL Öl')).toBe('2.5 EL Öl');
  });

  test('normale Mengen bleiben stehen', () => {
    expect(normalizeQuantities('500 g Mehl')).toBe('500 g Mehl');
    expect(normalizeQuantities('2-3 Zehen Knoblauch')).toBe('2-3 Zehen Knoblauch');
  });
});

describe('parseRecipeFromText - Brüche, Bereiche und Abschnitte', () => {
  const text = [
    'Zutaten:',
    '500 g Mehl',
    '½ TL Salz',
    '2-3 Zehen Knoblauch',
    'Für die Sauce:',
    '200 ml Sahne',
    '1 EL Butter',
    '',
    'Zubereitung:',
    '1. Mehl sieben.',
    '2. Sahne mit Butter erhitzen.',
    '3. Alles zusammen mischen.',
  ].join('\n');

  test('ein gemischter Bruch wird als Zutat erkannt', () => {
    const { ingredients } = parseRecipeFromText(text);
    expect(ingredients.join(' | ')).toMatch(/0\.5 TL Salz/);
  });

  test('ein Mengenbereich wird als Zutat erkannt', () => {
    const { ingredients } = parseRecipeFromText(text);
    expect(ingredients.join(' | ')).toMatch(/2-3 Zehen Knoblauch/);
  });

  test('Zutaten aus einem Unterabschnitt bleiben dabei, die Überschrift nicht', () => {
    const { ingredients } = parseRecipeFromText(text);
    expect(ingredients.join(' | ')).toMatch(/200 ml Sahne/);
    expect(ingredients.join(' | ')).not.toMatch(/Für die Sauce/);
  });

  test('drei Schritte bleiben drei Schritte', () => {
    const { steps } = parseRecipeFromText(text);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });
});

describe('recipeFromText - eingefügter Text', () => {
  const pasted = [
    'Zutaten:',
    '250 g Nudeln',
    '2 Eier',
    '100 ml Sahne',
    '',
    'Zubereitung:',
    '1. Nudeln kochen.',
    '2. Eier mit Sahne verrühren.',
    '3. Alles in die Pfanne geben.',
  ].join('\n');

  test('baut ein Rezept aus eingefügtem Text', async () => {
    const recipe = await recipeFromText({ text: pasted });
    expect(recipe).not.toBeNull();
    expect(recipe?.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(recipe?.steps.length).toBeGreaterThanOrEqual(3);
    expect(recipe?.source).toBe('pasted-text');
  });

  test('zu kurzer Text ergibt nichts', async () => {
    expect(await recipeFromText({ text: 'kurz' })).toBeNull();
  });
});

describe('Zwischenspeicher pro Link', () => {
  test('dasselbe Video hat denselben Schlüssel', () => {
    expect(videoCacheKey('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe(
      videoCacheKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'),
    );
  });

  test('ohne Eintrag kommt nichts zurück', async () => {
    expect(await readVideoCache('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});
