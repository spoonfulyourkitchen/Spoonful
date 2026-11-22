import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spoonful:review-progress';
const DONE_KEY = 'spoonful:review-done';

export type ReviewAction = 'ai' | 'cooking' | 'barcode' | 'like';
export const REVIEW_TOTAL = 4;

type Flags = Record<ReviewAction, boolean>;
export type ReviewSnapshot = { ready: boolean; count: number; complete: boolean; dismissed: boolean };

let flags: Flags = { ai: false, cooking: false, barcode: false, like: false };
let ready = false;
let dismissed = false;

let snapshot: ReviewSnapshot = { ready: false, count: 0, complete: false, dismissed: false };
const listeners = new Set<() => void>();

function rebuild() {
  const count = (Object.keys(flags) as ReviewAction[]).filter((key) => flags[key]).length;
  snapshot = { ready, count, complete: count >= REVIEW_TOTAL, dismissed };
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

let hydration: Promise<void> | null = null;

function ensureHydrated(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const [raw, done] = await Promise.all([
        AsyncStorage.getItem(KEY).catch(() => null),
        AsyncStorage.getItem(DONE_KEY).catch(() => null),
      ]);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Flags>;
        flags = {
          ai: parsed?.ai === true,
          cooking: parsed?.cooking === true,
          barcode: parsed?.barcode === true,
          like: parsed?.like === true,
        };
      }
      dismissed = done === '1';
    } catch {}
    ready = true;
    rebuild();
  })();
  return hydration;
}

export function hydrateReview(): Promise<void> {
  return ensureHydrated();
}

export function useReview(): ReviewSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function markReviewAction(action: ReviewAction): void {
  void ensureHydrated().then(() => {
    if (dismissed || flags[action]) return;
    flags = { ...flags, [action]: true };
    void AsyncStorage.setItem(KEY, JSON.stringify(flags)).catch(() => {});
    rebuild();
  });
}

export function completeReview(): void {
  dismissed = true;
  ready = true;
  void AsyncStorage.setItem(DONE_KEY, '1').catch(() => {});
  rebuild();
}
