import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type View } from 'react-native';
import type { Language } from './i18n';

export type TutorialState =
  | 'not_started'
  | 'running'
  | 'paused'
  | 'completed'
  | 'skipped'
  | 'failed_target';

export type TutorialAction = 'tap' | 'input' | 'scroll' | 'observe';

export type TutorialText = { en: string } & Partial<Record<Language, string>>;

export type TutorialStep = {
  id: string;
  
  targetId?: string;
  title?: TutorialText;
  text: TutorialText;
  
  expect: TutorialAction;
  
  before?: () => void;
  
  focus?: () => void;
  
  padding?: number;
  
  wide?: boolean;
  
  allowContinue?: boolean;
  
  critical?: boolean;
  
  newIn?: number;
};

export type TutorialTargetNode = ComponentRef<typeof View>;

export type TutorialProgress = {
  version: number;
  state: TutorialState;
  stepIndex: number;
  stepId: string;
  startedAt?: number;
  updatedAt: number;
  completedAt?: number;
  skippedAt?: number;
  
  completedVersion: number;
};

export type TutorialTargetRect = { x: number; y: number; width: number; height: number };

type TargetHandle = {
  ref: React.RefObject<TutorialTargetNode | null>;
  action?: (id: string) => void;
  focus?: () => void;
};

const STORAGE_KEY = 'spoonful:tutorial';
const STATS_KEY = 'spoonful:tutorial-stats';
const listeners = new Set<() => void>();

let progress: TutorialProgress = {
  version: 0,
  state: 'not_started',
  stepIndex: 0,
  stepId: '',
  updatedAt: 0,
  completedVersion: 0,
};
let loaded = false;
let visible = false;
let currentId = '';
let missingTarget = false;
const targets = new Map<string, TargetHandle>();
const completedSteps = new Set<string>();

export type TutorialSnapshot = {
  progress: TutorialProgress;
  visible: boolean;
  currentId: string;
  missingTarget: boolean;
  completedSteps: string[];
};

let snapshot: TutorialSnapshot = {
  progress,
  visible,
  currentId,
  missingTarget,
  completedSteps: [],
};

function emit() {
  snapshot = {
    progress,
    visible,
    currentId,
    missingTarget,
    completedSteps: Array.from(completedSteps),
  };
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): TutorialSnapshot {
  return snapshot;
}

export function useTutorial(): TutorialSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export type TutorialEvent =
  | 'tutorial_start'
  | 'tutorial_step_view'
  | 'tutorial_step_done'
  | 'tutorial_step_skipped'
  | 'tutorial_skip'
  | 'tutorial_pause'
  | 'tutorial_resume'
  | 'tutorial_complete'
  | 'tutorial_target_missing'
  | 'tutorial_abort'
  | 'tutorial_reset';

export function logTutorialEvent(event: TutorialEvent, data: Record<string, any> = {}) {
  if (__DEV__) console.debug('[tutorial]', event, data);
  AsyncStorage.getItem(STATS_KEY)
    .then((raw) => {
      let stats: Record<string, number> = {};
      try {
        stats = raw ? JSON.parse(raw) : {};
      } catch {
        stats = {};
      }
      const version = data.version ?? progress.version ?? 0;
      for (const key of [
        `${event}`,
        `${event}:v${version}`,
        data.stepId ? `${event}:${data.stepId}` : '',
      ]) {
        if (!key) continue;
        stats[key] = (stats[key] ?? 0) + 1;
      }
      return AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
    })
    .catch(() => {
      
    });
}

export async function readTutorialStats(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let tourVersion = 1;
let steps: TutorialStep[] = [];
let language = 'en';

export function configureTutorial(config: { version: number; steps: TutorialStep[] }) {
  tourVersion = config.version;
  steps = config.steps;
}

export function setTutorialLanguage(lang: string) {
  language = lang;
}

export function tutorialSteps(): TutorialStep[] {
  return steps;
}

export function tutorialCurrentStep(): TutorialStep | undefined {
  return steps[progress.stepIndex];
}

export function resolveTutorialText(text?: TutorialText): string {
  if (!text) return '';
  const exact = text[language as Language];
  if (typeof exact === 'string' && exact) return exact;
  return text.en;
}

async function loadProgress(): Promise<TutorialProgress> {
  if (loaded) return progress;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TutorialProgress>;
      if (parsed && typeof parsed === 'object') progress = { ...progress, ...parsed };
    }
  } catch {}
  loaded = true;
  emit();
  return progress;
}

async function saveProgress(patch: Partial<TutorialProgress>) {
  progress = { ...progress, ...patch, updatedAt: Date.now() };
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export async function hydrateTutorial(): Promise<TutorialProgress> {
  return loadProgress();
}

export async function readTutorialProgress(): Promise<TutorialProgress> {
  return loadProgress();
}

export async function shouldAutoStart(): Promise<boolean> {
  await loadProgress();
  if (visible || !steps.length) return false;
  if (progress.state === 'skipped') return false;
  if (progress.state === 'completed' && progress.completedVersion >= tourVersion) return false;
  return true;
}

export async function hasNewSteps(): Promise<boolean> {
  await loadProgress();
  return progress.state === 'completed' && progress.completedVersion < tourVersion;
}

function isStepVisible(index: number): boolean {
  const step = steps[index];
  if (!step) return false;
  return (step.newIn ?? 1) > (progress.completedVersion ?? 0);
}

function firstVisibleIndex(from: number): number {
  for (let i = Math.max(0, from); i < steps.length; i += 1) {
    if (isStepVisible(i)) return i;
  }
  return -1;
}

function runStepHooks(index: number) {
  const step = steps[index];
  if (!step) return;
  try {
    step.before?.();
  } catch {}
  const hasTarget = step.targetId ? !!targets.get(step.targetId) : true;
  missingTarget = !!step.targetId && !hasTarget;
  if (missingTarget) {
    logTutorialEvent('tutorial_target_missing', { stepId: step.id, version: tourVersion });
    setTimeout(() => {
      const late = step.targetId ? !!targets.get(step.targetId) : true;
      if (!late) return;
      missingTarget = false;
      emit();
      try {
        step.focus?.();
      } catch {}
    }, 900);
  } else {
    try {
      step.focus?.();
    } catch {}
  }
  emit();
  logTutorialEvent('tutorial_step_view', { stepId: step.id, version: tourVersion, index });
}

function goToStep(index: number) {
  const next = firstVisibleIndex(index);
  if (next < 0) {
    void completeTutorial();
    return;
  }
  const step = steps[next];
  void saveProgress({ stepIndex: next, stepId: step.id, state: 'running' });
  runStepHooks(next);
}

export async function startTutorial() {
  await loadProgress();
  const first = firstVisibleIndex(0);
  completedSteps.clear();
  if (first < 0) {
    await completeTutorial();
    return;
  }
  visible = true;
  await saveProgress({
    version: tourVersion,
    state: 'running',
    stepIndex: first,
    stepId: steps[first].id,
    startedAt: progress.startedAt ?? Date.now(),
  });
  logTutorialEvent('tutorial_start', { version: tourVersion, stepId: steps[first].id });
  runStepHooks(first);
}

export async function resumeTutorial() {
  await loadProgress();
  visible = true;
  const from = progress.state === 'completed' ? 0 : Math.max(0, progress.stepIndex);
  const first = firstVisibleIndex(from);
  if (first < 0) {
    await completeTutorial();
    return;
  }
  await saveProgress({ version: tourVersion, state: 'running', stepIndex: first, stepId: steps[first].id });
  logTutorialEvent('tutorial_resume', { version: tourVersion, stepId: steps[first].id });
  runStepHooks(first);
}

export async function pauseTutorial() {
  visible = false;
  await saveProgress({ state: 'paused' });
  logTutorialEvent('tutorial_pause', { stepId: progress.stepId, version: tourVersion });
}

export async function skipTutorial() {
  visible = false;
  missingTarget = false;
  await saveProgress({ state: 'skipped', skippedAt: Date.now() });
  logTutorialEvent('tutorial_skip', { stepId: progress.stepId, version: tourVersion });
}

export async function completeTutorial() {
  visible = false;
  missingTarget = false;
  await saveProgress({
    state: 'completed',
    completedAt: Date.now(),
    completedVersion: tourVersion,
    stepIndex: 0,
    stepId: '',
  });
  logTutorialEvent('tutorial_complete', { version: tourVersion });
}

export async function resetTutorial(): Promise<void> {
  completedSteps.clear();
  visible = false;
  missingTarget = false;
  currentId = '';
  loaded = true;
  progress = {
    version: 0,
    state: 'not_started',
    stepIndex: 0,
    stepId: '',
    updatedAt: Date.now(),
    completedVersion: 0,
  };
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(STATS_KEY);
  } catch {}
  logTutorialEvent('tutorial_reset', { version: tourVersion });
}

export async function restartTutorial(): Promise<void> {
  await resetTutorial();
  await startTutorial();
  if (!visible) {
    await saveProgress({ state: 'not_started', stepIndex: 0, stepId: '' });
  }
}

export function nextStep() {
  const step = steps[progress.stepIndex];
  if (step) {
    completedSteps.add(step.id);
    logTutorialEvent('tutorial_step_done', { stepId: step.id, version: tourVersion });
  }
  goToStep(progress.stepIndex + 1);
}

export function skipStep() {
  const step = steps[progress.stepIndex];
  if (step) {
    logTutorialEvent('tutorial_step_skipped', { stepId: step.id, version: tourVersion });
  }
  goToStep(progress.stepIndex + 1);
}

export function tutorialProgressLabel(): { index: number; total: number } {
  const visibleIndexes: number[] = [];
  for (let i = 0; i < steps.length; i += 1) {
    if (isStepVisible(i)) visibleIndexes.push(i);
  }
  const at = visibleIndexes.indexOf(progress.stepIndex);
  return { index: at < 0 ? 1 : at + 1, total: Math.max(1, visibleIndexes.length) };
}

export function prevStep() {
  for (let i = progress.stepIndex - 1; i >= 0; i -= 1) {
    if (isStepVisible(i)) {
      goToStep(i);
      return;
    }
  }
  goToStep(0);
}

export async function markTargetFailed() {
  await saveProgress({ state: 'failed_target' });
}

export function tutorialAction(id: string) {
  if (!visible) return;
  const step = steps[progress.stepIndex];
  if (!step || step.targetId !== id) return;
  if (step.expect === 'observe') return;
  completedSteps.add(step.id);
  logTutorialEvent('tutorial_step_done', { stepId: step.id, version: tourVersion, action: step.expect });
  goToStep(progress.stepIndex + 1);
}

export function registerTutorialTarget(id: string, handle: TargetHandle): () => void {
  targets.set(id, handle);
  return () => {
    if (targets.get(id) === handle) targets.delete(id);
  };
}

export function hasTutorialTarget(id: string): boolean {
  return !!targets.get(id)?.ref.current;
}

export function measureTutorialTarget(id: string): Promise<TutorialTargetRect | null> {
  const node = targets.get(id)?.ref.current;
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) resolve({ x, y, width, height });
        else resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function focusTutorialTarget(id: string) {
  try {
    targets.get(id)?.focus?.();
  } catch {}
}

export function useTutorialTargetActive(id: string): boolean {
  const { visible, currentId } = useTutorial();
  return visible && currentId === id;
}

export function useTutorialTarget(
  id: string,
  opts: { onPress?: (...args: any[]) => void; focus?: () => void } = {},
) {
  const ref = useRef<TutorialTargetNode | null>(null);
  const onPressRef = useRef(opts.onPress);
  onPressRef.current = opts.onPress;
  const focusRef = useRef(opts.focus);
  focusRef.current = opts.focus;

  useEffect(
    () =>
      registerTutorialTarget(id, {
        ref,
        focus: () => focusRef.current?.(),
      }),
    [id],
  );

  const onPress = useCallback(
    (...args: any[]) => {
      tutorialAction(id);
      onPressRef.current?.(...args);
    },
    [id],
  );

  return { ref, onPress, active: useTutorialTargetActive(id) };
}

export function useTutorialTargetRect(id?: string): TutorialTargetRect | null {
  const [rect, setRect] = useState<TutorialTargetRect | null>(null);
  useEffect(() => {
    if (!id) {
      setRect(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      if (AppState.currentState !== 'active') return;
      const next = await measureTutorialTarget(id);
      if (!alive) return;
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 350);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  return rect;
}

function sameRect(a: TutorialTargetRect | null, b: TutorialTargetRect | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

