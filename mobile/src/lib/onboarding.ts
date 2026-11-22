import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spoonful:onboarded-local';

let value = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export async function hydrateLocalOnboarded(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    value = (await AsyncStorage.getItem(KEY)) === '1';
  } catch {}
  emit();
}

export function markLocalOnboarded(): void {
  value = true;
  hydrated = true;
  void AsyncStorage.setItem(KEY, '1').catch(() => {});
  emit();
}

export function clearLocalOnboarded(): void {
  value = false;
  void AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return value;
}

export function useLocalOnboarded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
