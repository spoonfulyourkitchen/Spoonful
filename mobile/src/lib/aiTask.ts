import { useSyncExternalStore } from 'react';

/**
 * Global AI generation task state. Mirrors the web app's `lib/aiTask.ts`:
 * the header chip shows a spinner while the AI Chef works, then a clickable
 * "recipe ready" chip (recipe title) from any page, or an error chip.
 */

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

/** Subscribe a component to the current AI task state. */
export function useAiTask(): AiTaskState {
  return useSyncExternalStore(subscribe, getAiTask, getAiTask);
}
