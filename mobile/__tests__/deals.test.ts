/**
 * 3.2.1: echte Tests für die Angebots-Logik (MONSTR).
 *
 * Der alte `App.test.tsx` aus dem RN-Template konnte nie laufen
 * (`react-test-renderer` fehlt) und hat damit auch nichts geprüft. Hier werden
 * die reinen Rechen- und Filterfunktionen getestet, die über die Preise
 * entscheiden: Zahl lesen, Literpreis rechnen, Energy-Drink erkennen, Sortieren.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  formatSize,
  formatUnitPrice,
  formatValidity,
  looksLikeEnergyDrink,
  matchesQuery,
  normalizeQuery,
  parseMarktguru,
  sizeFromText,
  sortDeals,
  toNumber,
  unitPriceOf,
  type Deal,
} from '../src/lib/deals';

const deal = (name: string, price: number, unitPrice?: number): Deal => ({
  id: `${name}:${price}`,
  source: 'preisrunter',
  name,
  market: 'MYTIME',
  price,
  unitPrice,
  sale: false,
});

describe('toNumber', () => {
  test('liest deutsche und englische Schreibweise', () => {
    expect(toNumber('1,49 €')).toBeCloseTo(1.49);
    expect(toNumber('1.89')).toBeCloseTo(1.89);
    expect(toNumber(2)).toBe(2);
  });

  test('gibt NaN zurück, wenn nichts zu lesen ist', () => {
    expect(Number.isNaN(toNumber('kein Preis'))).toBe(true);
    expect(Number.isNaN(toNumber(null))).toBe(true);
  });
});

describe('unitPriceOf', () => {
  test('rechnet den Literpreis aus der Füllmenge', () => {
    expect(unitPriceOf(1.89, 0.5, 'l')).toBeCloseTo(3.78);
    expect(unitPriceOf(1.89, 500, 'ml')).toBeCloseTo(3.78);
  });

  test('rechnet den Kilopreis', () => {
    expect(unitPriceOf(2, 250, 'g')).toBeCloseTo(8);
  });

  test('ohne Größe oder Einheit gibt es keinen Grundpreis', () => {
    expect(unitPriceOf(1.89, undefined, 'l')).toBeUndefined();
    expect(unitPriceOf(1.89, 0.5, 'stk')).toBeUndefined();
    expect(unitPriceOf(0, 0.5, 'l')).toBeUndefined();
  });
});

describe('sizeFromText', () => {
  test('findet Größe und Einheit im Produktnamen', () => {
    expect(sizeFromText('Monster Energy (Einweg) 0,5 l')).toEqual({ size: 0.5, unit: 'l' });
    expect(sizeFromText('Energy Drink 500ml')).toEqual({ size: 500, unit: 'ml' });
    expect(sizeFromText('Kaffee 1kg')).toEqual({ size: 1, unit: 'kg' });
  });

  test('ohne Größe -> null', () => {
    expect(sizeFromText('Monster Energy Original')).toBeNull();
  });
});

describe('looksLikeEnergyDrink', () => {
  test('erkennt echte Dosen', () => {
    expect(looksLikeEnergyDrink('Monster Energy (Einweg)')).toBe(true);
    expect(looksLikeEnergyDrink('Monster Energy Ultra White')).toBe(true);
    expect(looksLikeEnergyDrink('Monster Rehab Energy Tea')).toBe(true);
  });

  test('lässt Chips, Duschgel und Backwaren liegen', () => {
    expect(looksLikeEnergyDrink('Monster Munch Original 75g')).toBe(false);
    expect(looksLikeEnergyDrink('Bübchen Shampoo Donutmonster')).toBe(false);
    expect(looksLikeEnergyDrink('Robby Monsterbacke Pudding')).toBe(false);
  });
});

describe('normalizeQuery', () => {
  test('macht aus "monster" eine Dosensuche', () => {
    expect(normalizeQuery('monster')).toBe('monster Energy');
    expect(normalizeQuery('  Monster  ')).toBe('Monster Energy');
  });

  test('lässt vollständige Suchbegriffe unverändert', () => {
    expect(normalizeQuery('Monster Energy')).toBe('Monster Energy');
    expect(normalizeQuery('Cola Zero')).toBe('Cola Zero');
  });

  test('leere Eingabe wird zur Standard-Suche', () => {
    expect(normalizeQuery('   ')).toBe('Monster Energy');
  });
});

describe('matchesQuery', () => {
  test('behält nur Energy-Dosen bei einer Monster-Suche', () => {
    expect(matchesQuery(deal('Monster Energy Original', 1.89), 'Monster Energy')).toBe(true);
    expect(matchesQuery(deal('Monster Munch Original', 1.29), 'Monster Energy')).toBe(false);
  });

  test('bei anderen Marken wird nur der Suchbegriff geprüft', () => {
    expect(matchesQuery(deal('Red Bull Classic', 1.45), 'Red Bull')).toBe(true);
    expect(matchesQuery(deal('Monster Energy', 1.89), 'Red Bull')).toBe(false);
  });
});

describe('parseMarktguru', () => {
  const payload = {
    results: [
      {
        id: 'offer-1',
        brand: { name: 'Monster Energy' },
        product: { name: 'Ultra White 500ml' },
        price: 0.89,
        retailers: [{ name: 'Penny' }],
        validityDates: { start: '2026-09-07T00:00:00Z', end: '2026-09-12T00:00:00Z' },
      },
      {
        id: 'offer-2',
        product: { name: 'Monster Energy Assault 500ml' },
        price: 1.29,
        retailers: [{ name: 'Lidl' }],
        validityDates: [{ start: '2026-09-01', end: '2026-09-06' }],
      },
    ],
  };

  test('liest brand, price, retailer und Gültigkeit', () => {
    const deals = parseMarktguru(payload);
    expect(deals).toHaveLength(2);

    const first = deals[0];
    expect(first.name).toBe('Monster Energy Ultra White 500ml');
    expect(first.price).toBeCloseTo(0.89);
    expect(first.market).toBe('Penny');
    expect(first.source).toBe('marktguru');
    expect(first.validTo).toBe(Date.parse('2026-09-12T00:00:00Z'));
    expect(first.size).toBe(500);
    expect(first.sizeUnit).toBe('ml');
    // 0,89 € für 500 ml = 1,78 €/l
    expect(first.unitPrice).toBeCloseTo(1.78);
  });

  test('nimmt auch eine Liste von Gültigkeiten', () => {
    const second = parseMarktguru(payload)[1];
    expect(second.market).toBe('Lidl');
    expect(second.validTo).toBe(Date.parse('2026-09-06'));
  });

  test('ohne Preis oder Name wird nichts erfunden', () => {
    expect(parseMarktguru({ results: [{ brand: { name: 'X' } }] })).toHaveLength(0);
  });

  test('andere Verpackung wird nicht abgestürzt', () => {
    expect(parseMarktguru(null)).toEqual([]);
  });
});

describe('formatValidity', () => {
  test('kurzes Datum, sonst leer', () => {
    const withDate = deal('Monster Energy', 0.89, 1.78);
    withDate.validTo = Date.parse('2026-09-12T00:00:00Z');
    expect(formatValidity(withDate)).not.toBe('');
    expect(formatValidity(deal('Monster Energy', 0.89))).toBe('');
  });
});

describe('formatUnitPrice / formatSize', () => {
  test('Grundpreis mit Komma und Einheit', () => {
    expect(formatUnitPrice({ ...deal('Monster Energy', 1.89, 3.78), sizeUnit: 'l' })).toBe('3,78 €/l');
    expect(formatUnitPrice(deal('Monster Energy', 1.89))).toBe('');
  });

  test('Füllmenge mit Komma', () => {
    expect(formatSize({ ...deal('Monster Energy', 1.89), size: 0.5, sizeUnit: 'l' })).toBe('0,5 l');
    expect(formatSize(deal('Monster Energy', 1.89))).toBe('');
  });
});

describe('sortDeals', () => {
  test('billigster Literpreis zuerst, dann billigste Dose', () => {
    const sorted = sortDeals([
      deal('teuer', 1.99, 3.98),
      deal('billig', 1.89, 3.78),
      deal('ohne-grundpreis', 1.5),
      deal('gleich-teuer- aber-guenstiger', 1.79, 3.78),
    ]);
    expect(sorted.map((d) => d.name)).toEqual([
      'gleich-teuer- aber-guenstiger',
      'billig',
      'teuer',
      'ohne-grundpreis',
    ]);
  });

  test('verändert die Eingabe nicht', () => {
    const input = [deal('b', 2, 4), deal('a', 1, 2)];
    sortDeals(input);
    expect(input.map((d) => d.name)).toEqual(['b', 'a']);
  });
});
