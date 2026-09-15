/**
 * 3.2.2: Tests für die Stabilitäts-Helfer (Bildgrößen, Zeitlimits, Zahlen,
 * Absturz-Protokoll). Diese vier Dinge hängen an jeder Liste und jeder
 * Netzwerk-Anfrage — sie müssen einfach stimmen.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { imageSource, isThumbUrl, thumbUrl } from '../src/lib/image-url';
import { at, parseNum, withTimeout } from '../src/lib/safe';
import { clearCrashLog, crashCount, getCrashLog, hydrateCrashLog, recordError } from '../src/lib/crash-log';

describe('thumbUrl', () => {
  test('Wikimedia-Thumbnail: Breite wird getauscht (2x für scharfe Displays)', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pizza.jpg/1280px-Pizza.jpg';
    expect(thumbUrl(url, 260)).toContain('/520px-Pizza.jpg');
    expect(isThumbUrl(thumbUrl(url, 260))).toBe(true);
  });

  test('Wikimedia-Original: Thumbnail-Pfad wird eingebaut', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pizza.jpg';
    const small = thumbUrl(url, 240);
    expect(small).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pizza.jpg/480px-Pizza.jpg');
  });

  test('Supabase Storage: Bilddienst mit Breite', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/recipe-images/user/x.jpg';
    const small = thumbUrl(url, 300);
    expect(small).toContain('/storage/v1/render/image/public/');
    expect(small).toContain('width=600');
  });

  test('fremde URLs bleiben unverändert', () => {
    expect(thumbUrl('https://example.com/a.jpg', 200)).toBe('https://example.com/a.jpg');
  });

  test('leere Eingabe -> undefined (kein Absturz)', () => {
    expect(thumbUrl('', 200)).toBeUndefined();
    expect(thumbUrl(null)).toBeUndefined();
  });

  test('imageSource: liefert URL + User-Agent, ohne Thumb das Original', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pizza.jpg';
    const withThumb = imageSource(url, 200);
    expect(withThumb?.uri).toContain('/400px-Pizza.jpg');
    expect(withThumb?.headers['User-Agent']).toContain('Spoonful');
    expect(imageSource(url)?.uri).toBe(url);
    expect(imageSource(url, 200, true)?.uri).toBe(url);
  });
});

describe('withTimeout', () => {
  test('gibt schnelle Ergebnisse weiter', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  test('bricht nach dem Zeitlimit ab', async () => {
    const never = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    await expect(withTimeout(never, 20, 'zu langsam')).rejects.toThrow('zu langsam');
  });

  test('reicht Fehler durch', async () => {
    await expect(withTimeout(Promise.reject(new Error('kaputt')), 1000)).rejects.toThrow('kaputt');
  });
});

describe('parseNum', () => {
  test('deutsche und englische Schreibweise', () => {
    expect(parseNum('1,5')).toBeCloseTo(1.5);
    expect(parseNum('1.5')).toBeCloseTo(1.5);
    expect(parseNum('1.234,5')).toBeCloseTo(1234.5);
    expect(parseNum(70)).toBe(70);
  });

  test('Müll -> Standardwert', () => {
    expect(parseNum('abc', 0)).toBe(0);
    expect(parseNum(undefined, 4)).toBe(4);
    expect(parseNum('', 7)).toBe(7);
  });
});

describe('at', () => {
  test('sicherer Zugriff', () => {
    expect(at(['a', 'b'], 1)).toBe('b');
    expect(at(['a'], 5)).toBeUndefined();
    expect(at(undefined, 0)).toBeUndefined();
    expect(at([], -1)).toBeUndefined();
  });
});

describe('crash-log', () => {
  test('Fehler festhalten, lesen, löschen', async () => {
    await hydrateCrashLog();
    await clearCrashLog();
    expect(crashCount()).toBe(0);

    recordError('global', new Error('Testfehler Nr. 1'));
    expect(crashCount()).toBe(1);
    expect(getCrashLog()[0].message).toBe('Testfehler Nr. 1');
    expect(getCrashLog()[0].scope).toBe('global');

    recordError('screen', 'nur Text');
    expect(crashCount()).toBe(2);

    await clearCrashLog();
    expect(crashCount()).toBe(0);
  });

  test('lange Texte werden gekürzt (Speicher bleibt klein)', () => {
    recordError('global', new Error('x'.repeat(2000)));
    expect(getCrashLog()[0].message.length).toBeLessThanOrEqual(300);
  });
});
