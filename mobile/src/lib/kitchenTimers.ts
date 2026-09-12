import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

/**
 * Kitchen timers (2.0.0).
 *
 * Several timers run at the same time (pasta + sauce + oven). Every timer is
 * mirrored in AsyncStorage, so closing the app does not lose it, and each one
 * schedules a Notifee trigger notification - that is what rings with sound and
 * shows up on the lock screen while the app is in the background.
 */
export type KitchenTimer = {
  id: string;
  label: string;
  /** Timestamp (ms) when it would finish (frozen while paused). */
  endsAt: number;
  /** Milliseconds left while paused (null while running). */
  remainingMs: number | null;
  running: boolean;
  totalMs: number;
};

const KEY = 'spoonful:kitchen-timers';
const CHANNEL_ID = 'spoonful-timers';

let timers: KitchenTimer[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(timers));
  } catch {
    /* best effort */
  }
}

async function ensureChannel() {
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Kitchen timers',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
  } catch {
    /* notifications are optional */
  }
}

/** Schedules (or cancels) the ringing notification for a single timer. */
async function scheduleNotification(timer: KitchenTimer) {
  try {
    await ensureChannel();
    await notifee.cancelNotification(`timer-${timer.id}`);
    const delay = timer.endsAt - Date.now();
    if (!timer.running || delay <= 0) return;
    await notifee.createTriggerNotification(
      {
        id: `timer-${timer.id}`,
        title: timer.label || 'Kitchen timer',
        body: 'Time is up - check your pot!',
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
          sound: 'default',
          vibrationPattern: [300, 500, 300, 500],
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: Date.now() + delay },
    );
  } catch {
    /* notifications are optional */
  }
}

async function cancelNotification(id: string) {
  try {
    await notifee.cancelNotification(`timer-${id}`);
  } catch {
    /* ignore */
  }
}


/** Keeps a 1 s ticker alive only while at least one timer is running. */
function ensureTicker() {
  const shouldRun = timers.some((t) => t.running && t.remainingMs === null);
  if (shouldRun && !ticker) {
    ticker = setInterval(() => {
      const now = Date.now();
      const finished: KitchenTimer[] = [];
      timers = timers.map((t) => {
        if (!t.running || t.remainingMs !== null) return t;
        if (t.endsAt - now <= 0) {
          finished.push(t);
          return { ...t, running: false, remainingMs: 0, endsAt: now };
        }
        return t;
      });
      if (finished.length) {
        finished.forEach((f) => void cancelNotification(f.id));
        void persist();
      }
      emit();
    }, 1000);
  } else if (!shouldRun && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const now = Date.now();
      timers = list
        .filter((t: any) => t && typeof t.id === 'string' && typeof t.endsAt === 'number')
        .map((t: KitchenTimer) => {
          // A timer that ran out while the app was closed stays at zero.
          if (t.running && t.remainingMs === null && t.endsAt <= now) {
            return { ...t, running: false, remainingMs: 0 };
          }
          return t;
        });
      timers.forEach((t) => {
        if (t.running && t.remainingMs === null) void scheduleNotification(t);
      });
    }
  } catch {
    /* ignore corrupted cache */
  }
  ensureTicker();
  emit();
}

export function subscribeTimers(cb: () => void) {
  listeners.add(cb);
  void hydrate();
  return () => {
    listeners.delete(cb);
  };
}

export function getTimers(): KitchenTimer[] {
  void hydrate();
  return timers;
}

/** Live list of timers (re-renders once per second while one is running). */
export function useKitchenTimers(): KitchenTimer[] {
  return useSyncExternalStore(subscribeTimers, getTimers, getTimers);
}

/** Milliseconds left for display purposes. */
export function timerRemaining(t: KitchenTimer, now = Date.now()): number {
  if (!t.running) return t.remainingMs ?? 0;
  return Math.max(0, t.endsAt - now);
}

export async function addTimer(minutes: number, label = 'Timer'): Promise<KitchenTimer> {
  await hydrate();
  const ms = Math.max(1, Math.round(minutes * 60)) * 1000;
  const timer: KitchenTimer = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    endsAt: Date.now() + ms,
    remainingMs: null,
    running: true,
    totalMs: ms,
  };
  timers = [...timers, timer];
  ensureTicker();
  await persist();
  await scheduleNotification(timer);
  emit();
  return timer;
}

export async function pauseTimer(id: string) {
  await hydrate();
  timers = timers.map((t) =>
    t.id === id && t.running ? { ...t, running: false, remainingMs: Math.max(0, t.endsAt - Date.now()) } : t,
  );
  ensureTicker();
  await persist();
  await cancelNotification(id);
  emit();
}

export async function resumeTimer(id: string) {
  await hydrate();
  let updated: KitchenTimer | null = null;
  timers = timers.map((t) => {
    if (t.id !== id || t.running) return t;
    const remaining = t.remainingMs && t.remainingMs > 0 ? t.remainingMs : t.totalMs;
    updated = { ...t, running: true, remainingMs: null, endsAt: Date.now() + remaining };
    return updated;
  });
  ensureTicker();
  await persist();
  if (updated) await scheduleNotification(updated);
  emit();
}

export async function extendTimer(id: string, minutes: number) {
  await hydrate();
  let updated: KitchenTimer | null = null;
  timers = timers.map((t) => {
    if (t.id !== id) return t;
    const extra = minutes * 60 * 1000;
    updated = t.running
      ? { ...t, endsAt: t.endsAt + extra, totalMs: t.totalMs + extra }
      : { ...t, remainingMs: (t.remainingMs ?? 0) + extra, totalMs: t.totalMs + extra };
    return updated;
  });
  ensureTicker();
  await persist();
  if (updated) await scheduleNotification(updated);
  emit();
}

export async function removeTimer(id: string) {
  await hydrate();
  timers = timers.filter((t) => t.id !== id);
  ensureTicker();
  await persist();
  await cancelNotification(id);
  emit();
}

export async function clearTimers() {
  await hydrate();
  const ids = timers.map((t) => t.id);
  timers = [];
  ensureTicker();
  await persist();
  for (const id of ids) await cancelNotification(id);
  emit();
}
