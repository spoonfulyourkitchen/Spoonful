

import { PASSWORD_MIN_LEVEL, passwordStrengthLevel } from '../src/lib/password-strength';

describe('passwordStrengthLevel', () => {
  test('leer -> 0', () => {
    expect(passwordStrengthLevel('')).toBe(0);
  });

  test('zu kurz bleibt unter grün', () => {
    expect(passwordStrengthLevel('abc')).toBeLessThan(PASSWORD_MIN_LEVEL);
    expect(passwordStrengthLevel('abc123')).toBeLessThan(PASSWORD_MIN_LEVEL);
  });

  test('nur Kleinbuchstaben (8 Zeichen) ist nicht genug', () => {
    expect(passwordStrengthLevel('abcdefgh')).toBeLessThan(PASSWORD_MIN_LEVEL);
  });

  test('8 Zeichen mit allen Gruppen erreicht grün', () => {
    expect(passwordStrengthLevel('Abcdefg1!')).toBeGreaterThanOrEqual(PASSWORD_MIN_LEVEL);
  });

  test('langes Passwort mit vier Gruppen ist am stärksten', () => {
    expect(passwordStrengthLevel('Abcdefgh123!')).toBe(5);
  });

  test('typische Muster werden abgewertet', () => {
    expect(passwordStrengthLevel('password123')).toBeLessThan(PASSWORD_MIN_LEVEL);
    expect(passwordStrengthLevel('qwerty123')).toBeLessThan(PASSWORD_MIN_LEVEL);
  });

  test('nur ein wiederholtes Zeichen bleibt schwach', () => {
    expect(passwordStrengthLevel('aaaaaaaa')).toBeLessThan(PASSWORD_MIN_LEVEL);
  });

  test('Ergebnis ist immer zwischen 0 und 5', () => {
    for (const pw of ['', 'a', 'aaaa', 'Aa1!', 'Aa1!Aa1!Aa1!Aa1!', 'passwort1']) {
      const level = passwordStrengthLevel(pw);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(5);
    }
  });
});
