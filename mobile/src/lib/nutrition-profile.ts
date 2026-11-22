import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Sex = 'male' | 'female';
export type Activity = 1 | 2 | 3 | 4;
export type GoalTag = 'cut' | 'maintain' | 'bulk';

export type NutritionProfile = {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  activity: Activity;
  goal: GoalTag;
  targetWeight?: number;
};

export const NUTRITION_PROFILE_KEY = 'spoonful:nutrition-profile';

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  sex: 'male',
  age: 30,
  height: 175,
  weight: 75,
  activity: 3,
  goal: 'maintain',
};

export const ACTIVITY_FACTORS: Record<Activity, number> = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725 };

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function computeTargets(p: NutritionProfile) {
  const weight = clampNumber(p.weight, 30, 300, DEFAULT_NUTRITION_PROFILE.weight);
  const height = clampNumber(p.height, 120, 230, DEFAULT_NUTRITION_PROFILE.height);
  const age = clampNumber(p.age, 12, 100, DEFAULT_NUTRITION_PROFILE.age);
  const factor = ACTIVITY_FACTORS[p.activity] ?? ACTIVITY_FACTORS[3];
  const base = 10 * weight + 6.25 * height - 5 * age;
  const bmr = p.sex === 'male' ? base + 5 : base - 161;
  const tdee = Math.round(bmr * factor);
  let budget = tdee;
  if (p.goal === 'cut') budget = tdee - 500;
  if (p.goal === 'bulk') budget = tdee + 350;
  budget = Math.max(1400, Math.min(6000, Math.round(budget / 50) * 50));
  const protein = Math.round(weight * (p.goal === 'maintain' ? 1.6 : 2));
  const fat = Math.max(45, Math.round((budget * 0.25) / 9));
  const carbs = Math.max(60, Math.round((budget - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee, budget, protein, fat, carbs };
}

export function goalTagFromOnboarding(goal: string): GoalTag {
  if (goal === 'lose') return 'cut';
  if (goal === 'gain') return 'bulk';
  return 'maintain';
}

export function waterGoalFor(profile: NutritionProfile): number {
  const kg = clampNumber(profile.weight, 30, 300, DEFAULT_NUTRITION_PROFILE.weight);
  return Math.round((kg * 35) / 50) * 50;
}

function normalize(raw: any): NutritionProfile {
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const activity = Number(parsed.activity);
  return {
    sex: parsed.sex === 'female' ? 'female' : 'male',
    age: Math.round(clampNumber(parsed.age, 12, 100, DEFAULT_NUTRITION_PROFILE.age)),
    height: Math.round(clampNumber(parsed.height, 120, 230, DEFAULT_NUTRITION_PROFILE.height)),
    weight: Math.round(clampNumber(parsed.weight, 30, 300, DEFAULT_NUTRITION_PROFILE.weight) * 10) / 10,
    activity: (activity === 1 || activity === 2 || activity === 3 || activity === 4 ? activity : 3) as Activity,
    goal: parsed.goal === 'cut' || parsed.goal === 'bulk' ? parsed.goal : 'maintain',
    targetWeight: Number(parsed.targetWeight) > 0 ? Math.round(Number(parsed.targetWeight) * 10) / 10 : undefined,
  };
}

let current: NutritionProfile = DEFAULT_NUTRITION_PROFILE;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeNutritionProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNutritionProfile(): NutritionProfile {
  return current;
}

export function useNutritionProfile(): NutritionProfile {
  return useSyncExternalStore(subscribeNutritionProfile, getNutritionProfile, getNutritionProfile);
}

export async function hasStoredNutritionProfile(): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(NUTRITION_PROFILE_KEY));
  } catch {
    return false;
  }
}

export async function hydrateNutritionProfile(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(NUTRITION_PROFILE_KEY);
    if (raw) current = normalize(JSON.parse(raw));
  } catch {}
  emit();
}

export function setNutritionProfile(patch: Partial<NutritionProfile>): NutritionProfile {
  current = normalize({ ...current, ...patch });
  void AsyncStorage.setItem(NUTRITION_PROFILE_KEY, JSON.stringify(current)).catch(() => {});
  emit();
  return current;
}
