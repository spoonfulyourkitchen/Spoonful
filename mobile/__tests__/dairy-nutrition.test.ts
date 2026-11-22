jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

import { dairyAssumptions, estimateNutritionLocally } from '../src/lib/ai';

describe('dairy nutrition assumptions', () => {
  test('uses explicit milk fat percentage in local macro estimates', () => {
    const skimmed = estimateNutritionLocally(['100 g milk 1.5% fat', '100 g flour'], 1);
    const whole = estimateNutritionLocally(['100 g milk 3.5% fat', '100 g flour'], 1);

    expect(skimmed?.calories).toBe(400);
    expect(skimmed?.fat).toBe(2.5);
    expect(whole?.calories).toBe(410);
    expect(whole?.fat).toBe(4.5);
  });

  test('uses explicit Greek yogurt fat percentage', () => {
    const lowFat = estimateNutritionLocally(['100 g Greek yogurt 2% fat', '100 g flour'], 1);
    const fullFat = estimateNutritionLocally(['100 g Greek yogurt 10% fat', '100 g flour'], 1);

    expect(lowFat?.fat).toBe(3);
    expect(fullFat?.fat).toBe(11);
    expect(fullFat?.calories).toBeGreaterThan(lowFat?.calories ?? 0);
  });

  test('returns assumptions only for dairy without an explicit fat percentage', () => {
    expect(dairyAssumptions(['200 ml milk', '150 g Greek yogurt', '100 g cream 20% fat'])).toEqual([
      { kind: 'milk', ingredient: '200 ml milk' },
      { kind: 'greekYogurt', ingredient: '150 g Greek yogurt' },
    ]);
  });

  test('recognizes Ukrainian dairy terms', () => {
    expect(dairyAssumptions(['200 мл молока', '100 г грецького йогурту'])).toEqual([
      { kind: 'milk', ingredient: '200 мл молока' },
      { kind: 'greekYogurt', ingredient: '100 г грецького йогурту' },
    ]);
  });
});
