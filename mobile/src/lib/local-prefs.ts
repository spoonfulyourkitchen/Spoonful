import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalPrefs = {
  name?: string;
  goal?: string;
  diet?: string;
  allergies?: string[];
  experience?: string;
  householdSize?: number;
  cookTime?: string;
  cuisines?: string[];
  waterGoalMl?: number;
  startedAt?: number;
};

const KEY = 'spoonful:local-prefs';

let prefs: LocalPrefs = {};
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') prefs = parsed;
    notify();
  })
  .catch(() => {});

export function useLocalPrefs(): LocalPrefs {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}

export async function readLocalPrefs(): Promise<LocalPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalPrefs) : {};
  } catch {
    return {};
  }
}

export async function ensureStartedAt(): Promise<number> {
  const now = Date.now();
  if (prefs.startedAt) return prefs.startedAt;
  const stored = await readLocalPrefs();
  const value = stored.startedAt || now;
  prefs = { ...prefs, startedAt: value };
  notify();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  return value;
}

export async function saveLocalPrefs(patch: Partial<LocalPrefs>): Promise<void> {
  prefs = { ...prefs, ...patch };
  notify();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
}
