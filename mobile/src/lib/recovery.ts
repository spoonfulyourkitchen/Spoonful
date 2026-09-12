import { useSyncExternalStore } from 'react';

/**
 * Global flag: the user followed a password-reset link (spoonful://reset) and
 * now has a recovery session, so the app shows the "set new password" screen.
 */
let pending = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function setRecoveryPending(value: boolean) {
  if (pending === value) return;
  pending = value;
  emit();
}

export function getRecoveryPending(): boolean {
  return pending;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useRecoveryPending(): boolean {
  return useSyncExternalStore(subscribe, getRecoveryPending, getRecoveryPending);
}
