import { useSyncExternalStore } from 'react';

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
