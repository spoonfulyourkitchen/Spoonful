import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spoonful:local-test';
const SESSION_KEY = 'spoonful:session';

export type LocalTestStage = 'onboarding' | 'active' | null;

let stage: LocalTestStage = null;
const subs = new Set<() => void>();

function parse(value: string | null): LocalTestStage {
  if (value === 'active') return 'active';
  if (value === 'onboarding') return 'onboarding';
  return null;
}

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
  .then((value) => {
    stage = parse(value);
    notify();
  })
  .catch(() => {});

export function useLocalTestStage(): LocalTestStage {
  return useSyncExternalStore(subscribe, () => stage, () => stage);
}

export function isLocalTestActive(): boolean {
  return stage !== null;
}

export async function startLocalTest(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {}
  stage = 'onboarding';
  try {
    await AsyncStorage.setItem(KEY, 'onboarding');
  } catch {}
  notify();
  try {
    if (typeof window !== 'undefined') window.location.reload();
  } catch {}
}

export async function completeLocalTest(): Promise<void> {
  stage = 'active';
  try {
    await AsyncStorage.setItem(KEY, 'active');
    await AsyncStorage.setItem(SESSION_KEY, '1');
  } catch {}
  notify();
}

export async function exitLocalTest(): Promise<void> {
  stage = null;
  notify();
  try {
    await AsyncStorage.clear();
  } catch {}
  try {
    if (typeof window !== 'undefined') window.location.reload();
  } catch {}
}
