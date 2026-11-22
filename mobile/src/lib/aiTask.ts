import { useSyncExternalStore } from 'react';

export type AiTaskState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; recipeTitle: string }
  | { status: 'error' };

let task: AiTaskState = { status: 'idle' };
const listeners = new Set<() => void>();

function emit(next: AiTaskState) {
  task = next;
  listeners.forEach((l) => l());
}

export function setAiTask(next: AiTaskState) {
  emit(next);
}

export function setAiRunning() {
  emit({ status: 'running' });
}

export function setAiDone(recipeTitle: string) {
  emit({ status: 'done', recipeTitle });
}

export function setAiError() {
  emit({ status: 'error' });
}

export function clearAiTask() {
  emit({ status: 'idle' });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAiTask(): AiTaskState {
  return task;
}

export function useAiTask(): AiTaskState {
  return useSyncExternalStore(subscribe, getAiTask, getAiTask);
}
