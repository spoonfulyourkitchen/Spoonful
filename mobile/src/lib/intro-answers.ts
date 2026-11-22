import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, Sex } from './nutrition-profile';

export const INTRO_ANSWERS_KEY = 'spoonful:intro-answers';

export type IntroAnswers = {
  name: string;
  goal: string;
  diet: string;
  allergies: string[];
  experience: string;
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  activity: Activity;
  householdSize: number;
  cookTime: string;
  cuisines: string[];
  notifications: boolean;
  completedAt: number;
};

export const DEFAULT_INTRO_ANSWERS: IntroAnswers = {
  name: '',
  goal: 'keep',
  diet: '',
  allergies: [],
  experience: '',
  sex: 'male',
  age: 30,
  height: 175,
  weight: 75,
  targetWeight: 0,
  activity: 3,
  householdSize: 2,
  cookTime: '',
  cuisines: [],
  notifications: true,
  completedAt: 0,
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeIntroAnswers(raw: unknown): IntroAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as any;
  const activity = Number(parsed.activity);
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  return {
    name: typeof parsed.name === 'string' ? parsed.name.slice(0, 60) : '',
    goal: typeof parsed.goal === 'string' ? parsed.goal : DEFAULT_INTRO_ANSWERS.goal,
    diet: typeof parsed.diet === 'string' ? parsed.diet : '',
    allergies: strings(parsed.allergies),
    experience: typeof parsed.experience === 'string' ? parsed.experience : '',
    sex: parsed.sex === 'female' ? 'female' : 'male',
    age: Math.round(num(parsed.age, 30, 12, 100)),
    height: Math.round(num(parsed.height, 175, 120, 230)),
    weight: Math.round(num(parsed.weight, 75, 30, 300) * 10) / 10,
    targetWeight: Math.round(num(parsed.targetWeight, 0, 0, 300) * 10) / 10,
    activity: (activity === 1 || activity === 2 || activity === 3 || activity === 4 ? activity : 3) as Activity,
    householdSize: Math.round(num(parsed.householdSize, 2, 1, 12)),
    cookTime: typeof parsed.cookTime === 'string' ? parsed.cookTime : '',
    cuisines: strings(parsed.cuisines),
    notifications: parsed.notifications !== false,
    completedAt: Math.round(num(parsed.completedAt, 0, 0, Number.MAX_SAFE_INTEGER)),
  };
}

export async function saveIntroAnswers(answers: Partial<IntroAnswers>): Promise<void> {
  const merged = normalizeIntroAnswers({ ...DEFAULT_INTRO_ANSWERS, ...answers }) ?? DEFAULT_INTRO_ANSWERS;
  await AsyncStorage.setItem(INTRO_ANSWERS_KEY, JSON.stringify(merged));
}

export async function readIntroAnswers(): Promise<IntroAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(INTRO_ANSWERS_KEY);
    if (!raw) return null;
    return normalizeIntroAnswers(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearIntroAnswers(): Promise<void> {
  await AsyncStorage.removeItem(INTRO_ANSWERS_KEY);
}
