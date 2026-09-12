import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { View } from 'react-native';
import type { Language } from './i18n';

/**
 * Spoonful in-app tutorial engine (2.0.0).
 *
 * Design goals
 * - one reusable engine with a plain step configuration (`tutorial-steps.ts`),
 * - the user performs every action themselves (tap, input, scroll) before the
 *   next step unlocks,
 * - robust target finding on every screen size, scroll position and rotation,
 * - resumable: progress, step id and tutorial version are persisted per device,
 * - non-blocking: the overlay only draws around the target, so the target stays
 *   touchable and nothing in the app is locked.
 *
 * State machine: not_started -> running -> (paused | completed | skipped | failed_target)
 */

export type TutorialState =
  | 'not_started'
  | 'running'
  | 'paused'
  | 'completed'
  | 'skipped'
  | 'failed_target';

export type TutorialAction = 'tap' | 'input' | 'scroll' | 'observe';

/**
 * Text of a step in every language we ship tutorial copy for.
 * 2.1.2: all 10 app languages; English is the last fallback instance.
 */
export type TutorialText = { en: string } & Partial<Record<Language, string>>;

export type TutorialStep = {
  id: string;
  /** Registered target id (`useTutorialTarget('library-search')`). */
  targetId?: string;
  title?: TutorialText;
  text: TutorialText;
  /** What the user has to do before the step is done. */
  expect: TutorialAction;
  /** Run before the step is shown (navigation, opening a sheet, …). */
  before?: () => void;
  /** Optional: make the target visible again (scroll to it, expand a box …). */
  focus?: () => void;
  /** Extra padding around the spotlight. */
  padding?: number;
  /** Hide the target frame (target still advanced by action) - for full areas. */
  wide?: boolean;
  /** Show the "Weiter" button even when an action is expected (gesture steps). */
  allowContinue?: boolean;
  /** Never advance automatically; always wait for the user. */
  critical?: boolean;
  /** Step belongs to a newer tour version (see isStepVisible). */
  newIn?: number;
};

/** A mounted UI element that can be measured on screen. */
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
  /** Highest version the user already completed - drives "what is new". */
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

/* ── snapshot + subscription ─────────────────────────────────────────────── */

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

/** Subscribe a component to the tutorial state. */
export function useTutorial(): TutorialSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ── analytics ───────────────────────────────────────────────────────────── */

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

/**
 * Lightweight analytics: every event is logged and counted locally (key
 * "spoonful:tutorial-stats"). Sending them to a server is a one-liner here -
 * the counters are already aggregated per event and version.
 */
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
      /* analytics must never break the tour */
    });
}

/** Read the collected counters (used by the admin/debug view). */
export async function readTutorialStats(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
/* ── configuration (filled by tutorial-steps.ts) ─────────────────────────── */

let tourVersion = 1;
let steps: TutorialStep[] = [];
let language = 'en';

export function configureTutorial(config: { version: number; steps: TutorialStep[] }) {
  tourVersion = config.version;
  steps = config.steps;
}

/** The gate calls this whenever the app language changes. */
export function setTutorialLanguage(lang: string) {
  language = lang;
}

export function tutorialSteps(): TutorialStep[] {
  return steps;
}

export function tutorialCurrentStep(): TutorialStep | undefined {
  return steps[progress.stepIndex];
}

/** Step copy in the active language, English as the last fallback instance. */
export function resolveTutorialText(text?: TutorialText): string {
  if (!text) return '';
  const exact = text[language as Language];
  if (typeof exact === 'string' && exact) return exact;
  return text.en;
}

/* ── persistence ─────────────────────────────────────────────────────────── */

async function loadProgress(): Promise<TutorialProgress> {
  if (loaded) return progress;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TutorialProgress>;
      if (parsed && typeof parsed === 'object') progress = { ...progress, ...parsed };
    }
  } catch {
    /* first start */
  }
  loaded = true;
  emit();
  return progress;
}

async function saveProgress(patch: Partial<TutorialProgress>) {
  progress = { ...progress, ...patch, updatedAt: Date.now() };
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export async function hydrateTutorial(): Promise<TutorialProgress> {
  return loadProgress();
}

export async function readTutorialProgress(): Promise<TutorialProgress> {
  return loadProgress();
}

/**
 * Trigger logic (see also TutorialGate):
 * - never started / interrupted / paused -> open once,
 * - skipped -> only offered again through the resume pill or the settings,
 * - completed -> only when a newer tour version adds new steps.
 */
export async function shouldAutoStart(): Promise<boolean> {
  await loadProgress();
  if (visible || !steps.length) return false;
  if (progress.state === 'skipped') return false;
  if (progress.state === 'completed' && progress.completedVersion >= tourVersion) return false;
  return true;
}

/** The user finished an older version and new steps exist -> offer them again. */
export async function hasNewSteps(): Promise<boolean> {
  await loadProgress();
  return progress.state === 'completed' && progress.completedVersion < tourVersion;
}

/* ── state machine ───────────────────────────────────────────────────────── */

/** Steps of an older version the user already finished are skipped. */
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
  } catch {
    /* navigation problems must not kill the tour */
  }
  const hasTarget = step.targetId ? !!targets.get(step.targetId) : true;
  missingTarget = !!step.targetId && !hasTarget;
  if (missingTarget) {
    logTutorialEvent('tutorial_target_missing', { stepId: step.id, version: tourVersion });
    // The target may live on a screen that is still animating in: retry shortly.
    setTimeout(() => {
      const late = step.targetId ? !!targets.get(step.targetId) : true;
      if (!late) return;
      missingTarget = false;
      emit();
      try {
        step.focus?.();
      } catch {
        /* ignore */
      }
    }, 900);
  } else {
    try {
      step.focus?.();
    } catch {
      /* ignore */
    }
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

/**
 * 2.1.2: full reset — clears the persisted progress, the analytics counters and
 * the in-memory state, so the tour really starts from step 1 again.
 * (The old implementation only wrote `not_started` while keeping the step index
 * and the "completed" version, which is why the reset button looked broken.)
 */
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
  } catch {
    /* ignore */
  }
  logTutorialEvent('tutorial_reset', { version: tourVersion });
}

/** Reset + start in one go (the Settings button uses this). */
export async function restartTutorial(): Promise<void> {
  await resetTutorial();
  await startTutorial();
  if (!visible) {
    // Nothing to show (all steps hidden): make sure the tour is at least armed.
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

/** 2.1.2: skip only the current step (the tour continues with the next one). */
export function skipStep() {
  const step = steps[progress.stepIndex];
  if (step) {
    logTutorialEvent('tutorial_step_skipped', { stepId: step.id, version: tourVersion });
  }
  goToStep(progress.stepIndex + 1);
}

/** 2.1.2: "Schritt 3 von 7" — counts only the steps this user actually sees. */
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

/** The user cannot trigger the target (hidden, permission, tiny screen). */
export async function markTargetFailed() {
  await saveProgress({ state: 'failed_target' });
}

/**
 * Called by screens when the user performs the expected action: tapping the
 * highlighted element, typing into the highlighted field or scrolling the
 * highlighted list. Only the current step can be completed this way.
 */
export function tutorialAction(id: string) {
  if (!visible) return;
  const step = steps[progress.stepIndex];
  if (!step || step.targetId !== id) return;
  if (step.expect === 'observe') return;
  completedSteps.add(step.id);
  logTutorialEvent('tutorial_step_done', { stepId: step.id, version: tourVersion, action: step.expect });
  goToStep(progress.stepIndex + 1);
}

/* ── target registry ─────────────────────────────────────────────────────── */

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
  } catch {
    /* ignore */
  }
}

/* ── React bindings ──────────────────────────────────────────────────────── */

/** True while the given id is the target of the running step. */
export function useTutorialTargetActive(id: string): boolean {
  const { visible, currentId } = useTutorial();
  return visible && currentId === id;
}

/**
 * Registers a UI element as tutorial target and returns the props to attach.
 *
 * ```tsx
 * const tSearch = useTutorialTarget('library-search', { onPress: openSearch });
 * <Pressable ref={tSearch.ref} onPress={tSearch.onPress} />
 * ```
 * Attaching `onPress` makes the tap complete the step, and `focus` (optional)
 * lets the engine bring the element into view.
 */
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

/** Measured position of a target, refreshed while a step is running. */
export function useTutorialTargetRect(id?: string): TutorialTargetRect | null {
  const [rect, setRect] = useState<TutorialTargetRect | null>(null);
  useEffect(() => {
    if (!id) {
      setRect(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const next = await measureTutorialTarget(id);
      if (alive) setRect(next);
    };
    void tick();
    // Polling keeps the spotlight glued to the element while the user scrolls,
    // rotates the device or the list virtualises tiles in and out.
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

