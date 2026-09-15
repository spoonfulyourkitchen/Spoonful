/**
 * 3.2.2: Absturz-Protokoll.
 *
 * Warum: „die App stürzt dauernd ab" ist ohne Spur nicht zu reparieren. Hier
 * landen die letzten Fehler (Bildschirm-Fehler, globale JS-Fehler, gescheiterte
 * Hintergrund-Aufgaben) mit Zeitpunkt und Ort. In den Einstellungen gibt es
 * dafür „Letzte Fehler" — und man kann sie dort löschen.
 *
 * Es wird nur Text gespeichert (max. 25 Einträge), nichts wird gesendet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CrashEntry = {
  /** Zeitpunkt (ms). */
  at: number;
  /** Ort: 'screen' | 'global' | 'promise' | 'task' … */
  scope: string;
  /** Kurztext des Fehlers. */
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
    /* Protokoll ist Komfort - Fehler dürfen nichts kaputt machen */
  });
}

/** Beim App-Start einmal aufrufen. */
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

/** Einen Fehler festhalten (niemals werfen!). */
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
  } catch {
    /* ignore */
  }
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
  } catch {
    /* ignore */
  }
}

/** Anzahl gespeicherter Fehler (für Hinweise/Badges). */
export function crashCount(): number {
  return entries.length;
}

/**
 * Globale JS-Fehler mitprotokollieren, ohne das normale Verhalten zu ändern
 * (im Entwicklungsmodus bleibt der rote Fehler-Kasten also erhalten).
 */
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
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* auf manchen Plattformen gibt es ErrorUtils nicht */
  }
}
