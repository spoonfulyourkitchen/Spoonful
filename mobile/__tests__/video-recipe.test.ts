/**
 * 3.2.1: Tests für „Video-Link -> Rezept".
 *
 * Diese Tests halten die zwei Fehler fest, die die Funktion vorher unmöglich
 * gemacht haben:
 *  1. Untertitel-Adressen sind RELATIV (müssen ergänzt werden).
 *  2. Video-Text ist oft ein einziger Block - er muss in Sätze/Abschnitte
 *     zerlegt werden, sonst findet die Erkennung nichts.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/ai', () => ({ aiRecipeFromText: jest.fn(async () => null) }));

import {
  absoluteCaptionUrl,
  parseRecipeFromText,
  platformOf,
  textFromHtml,
  textFromJson3,
  textFromTimedText,
  toSegments,
  youtubeId,
} from '../src/lib/video-recipe';

describe('absoluteCaptionUrl', () => {
  test('ergänzt die relative Untertitel-Adresse (das war der Fehler)', () => {
    const url = absoluteCaptionUrl('/api/timedtext?v=abc&lang=de&signature=x');
    expect(url.startsWith('https://www.youtube.com/api/timedtext')).toBe(true);
  });

  test('löst JSON-Escapes auf (\\u0026 = &)', () => {
    const url = absoluteCaptionUrl('https://www.youtube.com/api/timedtext?v=abc\\u0026fmt=json3');
    expect(url).toContain('&fmt=json3');
    expect(url).not.toContain('\\u0026');
  });

  test('lässt absolute Adressen stehen', () => {
    expect(absoluteCaptionUrl('https://example.com/a.xml')).toBe('https://example.com/a.xml');
  });

  test('leere Eingabe -> leer', () => {
    expect(absoluteCaptionUrl('')).toBe('');
  });
});

describe('textFromJson3', () => {
  test('liest die Untertitel-Ereignisse', () => {
    const body = JSON.stringify({
      events: [
        { segs: [{ utf8: 'Zuerst 500 g Mehl' }, { utf8: ' in eine Schüssel' }] },
        { segs: [{ utf8: 'dann 250 ml Wasser dazu' }] },
      ],
    });
    expect(textFromJson3(body)).toBe('Zuerst 500 g Mehl in eine Schüssel dann 250 ml Wasser dazu');
  });

  test('kaputtes JSON -> leer statt Absturz', () => {
    expect(textFromJson3('<html>nope</html>')).toBe('');
  });
});

describe('textFromTimedText', () => {
  test('XML-Untertitel werden zu Text', () => {
    const xml = '<transcript><text start="0">500 g Mehl</text><text start="1">2 Eier &amp; Milch</text></transcript>';
    expect(textFromTimedText(xml)).toBe('500 g Mehl\n2 Eier & Milch');
  });
});

describe('youtubeId / platformOf', () => {
  test('alle Linkformen', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('nonsense')).toBeNull();
  });

  test('Plattform erkennen', () => {
    expect(platformOf('https://www.tiktok.com/@koch/video/123')).toBe('tiktok');
    expect(platformOf('https://www.instagram.com/reel/abc/')).toBe('instagram');
    expect(platformOf('https://www.youtube.com/watch?v=x')).toBe('youtube');
  });
});

describe('toSegments', () => {
  test('trennt Sätze, Zeilen und Übergangswörter', () => {
    const segments = toSegments('Zutaten:\n500 g Mehl\nDas Mehl sieben. dann Wasser dazu geben.');
    expect(segments).toContain('500 g Mehl');
    expect(segments).toContain('Das Mehl sieben.');
    expect(segments).toContain('Wasser dazu geben.');
  });
});

describe('parseRecipeFromText - YouTube-Beschreibung', () => {
  const description = [
    'Zutaten für 4 Portionen:',
    '500 g Mehl',
    '1 Päckchen Trockenhefe',
    '250 ml lauwarmes Wasser',
    '1 TL Salz',
    '2 EL Olivenöl',
    '',
    'Zubereitung:',
    '1. Mehl und Hefe in einer Schüssel mischen.',
    '2. Wasser, Salz und Öl dazugeben und alles zu einem Teig kneten.',
    '3. Den Teig 60 Minuten gehen lassen.',
    '4. Bei 220 Grad circa 20 Minuten backen.',
  ].join('\n');

  test('findet Zutaten mit Mengen', () => {
    const { ingredients } = parseRecipeFromText(description);
    expect(ingredients).toContain('500 g Mehl');
    expect(ingredients).toContain('250 ml lauwarmes Wasser');
    expect(ingredients.length).toBeGreaterThanOrEqual(5);
  });

  test('findet die Zubereitungsschritte', () => {
    const { steps } = parseRecipeFromText(description);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0]).toMatch(/Mehl und Hefe/);
  });

  test('Überschriften landen nicht in den Listen', () => {
    const { ingredients, steps } = parseRecipeFromText(description);
    expect(ingredients.join(' ')).not.toMatch(/Zutaten für 4/);
    expect(steps.join(' ')).not.toMatch(/Zubereitung/);
  });
});

describe('parseRecipeFromText - automatische Untertitel (ein Block)', () => {
  const transcript =
    'heute machen wir pizza zuerst 500 g mehl in eine schüssel geben dann 250 ml wasser ' +
    'dazugeben und alles gut kneten danach den teig eine stunde gehen lassen am ende ' +
    'bei 250 grad etwa 15 minuten backen';

  test('holt Zutaten aus einer langen Zeile', () => {
    const { ingredients } = parseRecipeFromText(transcript);
    expect(ingredients.join(' | ')).toMatch(/500 g mehl/i);
    expect(ingredients.join(' | ')).toMatch(/250 ml wasser/i);
  });

  test('erkennt Arbeitsschritte trotz fehlender Satzzeichen', () => {
    const { steps } = parseRecipeFromText(transcript);
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('parseRecipeFromText - englische Beschreibung', () => {
  test('funktioniert auch auf Englisch', () => {
    const text = [
      'Ingredients:',
      '250 g flour',
      '2 eggs',
      '',
      'Method:',
      '1. Mix the flour with the eggs.',
      '2. Bake for 20 minutes.',
    ].join('\n');
    const { ingredients, steps } = parseRecipeFromText(text);
    expect(ingredients).toContain('250 g flour');
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('textFromHtml', () => {
  test('liest og:description und Titel', () => {
    const html =
      '<html><head><meta property="og:title" content="Pasta Rezept" />' +
      '<meta property="og:description" content="Zutaten: 500 g Nudeln&#39; und mehr" /></head></html>';
    const { text, title } = textFromHtml(html);
    expect(title).toBe('Pasta Rezept');
    expect(text).toContain("500 g Nudeln' und mehr");
  });

  test('ohne Meta-Tags leer', () => {
    expect(textFromHtml('<html></html>').text).toBe('');
  });
});

