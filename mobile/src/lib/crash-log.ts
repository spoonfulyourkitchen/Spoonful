

import AsyncStorage from '@react-native-async-storage/async-storage';

export type CrashEntry = {
  
  at: number;
  
  scope: string;
  
  message: string;
};

const KEY = 'spoonful:crash-log';
const MAX = 25;

let entries: CrashEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function push(entry: CrashEntry) {
  entries = [entry, ...entries].slice(0, MAX);
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {
    
  });
}

export async function hydrateCrashLog(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      entries = parsed.filter((e) => e && typeof e.message === 'string').slice(0, MAX) as CrashEntry[];
    }
  } catch {
    entries = [];
  }
  emit();
}

export function recordError(scope: string, error: unknown): CrashEntry {
  const message =
    error instanceof Error
      ? `${error.message}`.slice(0, 300)
      : typeof error === 'string'
        ? error.slice(0, 300)
        : 'Unbekannter Fehler';
  const entry: CrashEntry = { at: Date.now(), scope, message };
  try {
    push(entry);
  } catch {}
  return entry;
}

export function subscribeCrashLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCrashLog(): CrashEntry[] {
  return entries;
}

export async function clearCrashLog(): Promise<void> {
  entries = [];
  emit();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

export function crashCount(): number {
  return entries.length;
}

export function installGlobalErrorHandler(): void {
  try {
    const utils: any = (globalThis as any).ErrorUtils;
    if (!utils?.getGlobalHandler || utils.__spoonfulPatched) return;
    const previous = utils.getGlobalHandler();
    utils.__spoonfulPatched = true;
    utils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      recordError(isFatal ? 'global-fatal' : 'global', error);
      try {
        previous?.(error, isFatal);
      } catch {}
    });
  } catch {}
}
