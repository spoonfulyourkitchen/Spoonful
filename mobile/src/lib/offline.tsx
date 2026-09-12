import React, { useEffect, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { Alert, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL } from '../config';
import { convexClient } from './convex-auth';
import { api } from './api';

/**
 * Spoonful offline support.
 *
 * Architecture:
 *  - The app keeps a tiny mirror of the *user's own* data in AsyncStorage:
 *      my recipes, saved recipes, tracker entries and the shopping list.
 *  - While online, every successful query result is written into that cache.
 *  - While offline, screens read from the cache, so everything you saved or
 *    logged before stays fully usable (opening recipes, cooking mode, etc.).
 *  - Library (server catalog), Community and the AI Chef need the internet and
 *    show an offline screen instead.
 */

export type ConnState = 'unknown' | 'online' | 'offline';

let conn: ConnState = 'unknown';
let probing = false;
const listeners = new Set<() => void>();

function emitConn() {
  listeners.forEach((l) => l());
}
function setConn(next: ConnState) {
  if (conn === next) return;
  conn = next;
  emitConn();
}
export function getConn(): ConnState {
  return conn;
}

const PROBE_TIMEOUT_MS = 4500;
const PROBE_INTERVAL_ONLINE_MS = 20000;
const PROBE_INTERVAL_OFFLINE_MS = 6000;

async function probeNow(): Promise<boolean> {
  if (probing) return conn === 'online';
  probing = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(SUPABASE_URL, { method: 'GET', signal: controller.signal });
    const wasOffline = conn !== 'online';
    setConn('online');
    if (wasOffline) setTimeout(() => { void flushPendingOps(); }, 500);
    return true;
  } catch {
    setConn('offline');
    return false;
  } finally {
    clearTimeout(timer);
    probing = false;
  }
}

/** Force an immediate reachability check (used by "Retry" buttons). */
export async function retryConnectivity() {
  await probeNow();
  return conn;
}

let monitoringStarted = false;
function startMonitoring() {
  if (monitoringStarted) return;
  monitoringStarted = true;
  (async () => {
    await probeNow();
    const loop = async () => {
      const wasOnline = conn === 'online';
      await probeNow();
      const nextDelay = wasOnline ? PROBE_INTERVAL_ONLINE_MS : PROBE_INTERVAL_OFFLINE_MS;
      setTimeout(loop, nextDelay);
    };
    setTimeout(loop, conn === 'online' ? PROBE_INTERVAL_ONLINE_MS : PROBE_INTERVAL_OFFLINE_MS);
  })();
}

export function useConnectivity(): ConnState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getConn,
    getConn,
  );
}

/* ── Offline query cache ─────────────────────────────────────────────── */

const CACHE_PREFIX = 'spoonful:cache:';
const memCache = new Map<string, unknown>();

export function cacheRead<T>(key: string): T | undefined {
  return memCache.get(key) as T | undefined;
}

export async function cacheWrite<T>(key: string, value: T) {
  memCache.set(key, value);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch { /* cache is best-effort */ }
}

/* ── Offline action queue (changes made offline sync later) ──────────── */

export type PendingOp = { id: string; kind: string; at: number; payload: any; tries?: number };

const PENDING_KEY = 'spoonful:cache:pending';
/** Hard cap so a long offline session can never grow storage without end. */
const MAX_PENDING_OPS = 500;
let pendingOps: PendingOp[] = [];

export function listPendingOps(): PendingOp[] {
  return [...pendingOps];
}

async function persistPendingOps() {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pendingOps));
  } catch { /* best-effort */ }
}

/** Record an action that should be replayed on the server once online. */
export async function addPendingOp(kind: string, payload: any) {
  const p: any = payload ?? {};

  // Collapse repeated toggles/removals of the same row: replaying both would
  // flip the item twice on the server ("done" would end up wrong).
  if (kind === 'shopping.toggle' && typeof p.id === 'string') {
    const already = pendingOps.some((op) => op.kind === 'shopping.toggle' && op.payload?.id === p.id);
    if (already) return;
  }
  if (kind === 'shopping.remove' && typeof p.id === 'string' && !String(p.id).startsWith('tmp-')) {
    pendingOps = pendingOps.filter((op) => !(op.kind === 'shopping.toggle' && op.payload?.id === p.id));
  }

  pendingOps.push({
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    at: Date.now(),
    payload,
    tries: 0,
  });

  // drop the oldest entries when the queue gets unreasonably long
  if (pendingOps.length > MAX_PENDING_OPS) {
    pendingOps = pendingOps.slice(pendingOps.length - MAX_PENDING_OPS);
  }

  await persistPendingOps();
}

export async function removePendingOps(ids: string[]) {
  const remove = new Set(ids);
  pendingOps = pendingOps.filter((op) => !remove.has(op.id));
  await persistPendingOps();
}

/* ── Global sync: replay queued actions as soon as we are back online ── */

let flushingGlobal = false;

async function runPendingOp(op: PendingOp) {
  const p: any = op.payload ?? {};
  switch (op.kind) {
    case 'tracker.log':
      await convexClient.mutation(api.calorieEntries.logManual as any, {
        title: p.title, calories: p.calories ?? undefined, protein: p.protein ?? undefined,
      });
      return;
    case 'tracker.remove':
      if (typeof p.id === 'string' && p.id.startsWith('tmp-')) return; // never existed on the server
      await convexClient.mutation(api.calorieEntries.remove as any, { id: p.id });
      return;
    case 'shopping.add':
      await convexClient.mutation(api.shoppingList.add as any, { name: p.name });
      return;
    case 'shopping.toggle':
      await convexClient.mutation(api.shoppingList.toggle as any, { id: p.id });
      return;
    case 'shopping.remove':
      if (typeof p.id === 'string' && p.id.startsWith('tmp-')) return; // never existed on the server
      await convexClient.mutation(api.shoppingList.remove as any, { id: p.id });
      return;
    case 'shopping.clearChecked':
      await convexClient.mutation(api.shoppingList.clearChecked as any, {});
      return;
    case 'shopping.clearAll':
      await convexClient.mutation(api.shoppingList.clearAll as any, {});
      return;
    case 'shopping.update':
      if (typeof p.id === 'string' && p.id.startsWith('tmp-')) return;
      await convexClient.mutation(api.shoppingList.update as any, {
        id: p.id,
        price: p.price,
        have: p.have,
        checked: p.checked,
        category: p.category,
        course: p.course,
      });
      return;
    case 'shopping.setCheckedMany': {
      const ids = (Array.isArray(p.ids) ? p.ids : []).filter((id: string) => typeof id === 'string' && !id.startsWith('tmp-'));
      if (!ids.length) return;
      await convexClient.mutation(api.shoppingList.setCheckedMany as any, { ids, checked: !!p.checked });
      return;
    }
    default:
      return;
  }
}

/** Replays every queued offline action in order against the server. */
export async function flushPendingOps() {
  if (flushingGlobal) return;
  flushingGlobal = true;
  try {
    const ops = listPendingOps().sort((a, b) => a.at - b.at);
    for (const op of ops) {
      try {
        await runPendingOp(op);
        await removePendingOps([op.id]);
      } catch {
        // One broken action must never block the whole queue: count the
        // attempts and drop it after a few rounds instead of retrying forever.
        const tries = (op.tries ?? 0) + 1;
        if (tries >= 5) {
          await removePendingOps([op.id]);
          continue;
        }
        const stored = pendingOps.find((o) => o.id === op.id);
        if (stored) stored.tries = tries;
        await persistPendingOps();
        break; // still offline or an auth hiccup — retry on the next reconnect
      }
    }
  } finally {
    flushingGlobal = false;
  }
}

export function getConnNow(): ConnState {
  return conn;
}

export async function hydrateOfflineCaches(keys: string[]) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
        if (raw) memCache.set(key, JSON.parse(raw));
      } catch { /* ignore corrupted entry */ }
    }),
  );
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pendingOps = parsed.filter((o) => o && typeof o.id === 'string');
    }
  } catch { /* ignore */ }
}

/**
 * Drop-in list hook: keeps a list query usable offline.
 *
 *   const live = useQuery(api.recipes.list);
 *   const { data: mine, offline } = useCachedList('mine', live);
 *
 * While online the live result is used (and mirrored to storage). While
 * offline the last mirror is shown instead of an endless spinner.
 */
export function useCachedList<T>(key: string, live: T[] | undefined) {
  const conn = useConnectivity();
  const [cached, setCached] = useState<T[] | undefined>(cacheRead<T[]>(key));

  useEffect(() => {
    if (conn !== 'offline' && Array.isArray(live)) {
      setCached(live);
      void cacheWrite(key, live);
    }
  }, [key, live, conn]);

  const apply = (updater: (prev: T[]) => T[]) => {
    setCached((prev) => {
      const next = updater(prev ?? ([] as unknown as T[]));
      void cacheWrite(key, next);
      return next;
    });
  };

  return { data: conn === 'offline' ? cached : live ?? cached, offline: conn === 'offline', apply };
}

/** Small guard used by screens that allow editing while offline is allowed for reading only. */
export function useOfflineGuard() {
  const conn = useConnectivity();
  return {
    offline: conn === 'offline',
    requireOnline: (title = 'You are offline'): boolean => {
      if (conn !== 'offline') return true;
      Alert.alert(title, 'Changes need an internet connection. Your saved data is still available offline.');
      return false;
    },
  };
}

/* Connectivity probe starts automatically once the module is imported. */
startMonitoring();

/* Export a tiny offline badge for screens that stay usable while offline. */
export function OfflineBadge({ style }: { style?: object }) {
  const conn = useConnectivity();
  if (conn !== 'offline') return null;
  return (
    <Text style={[{ fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: '#b45309', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', alignSelf: 'flex-start', marginBottom: 6 }, style]}>
      Offline
    </Text>
  );
}
