import React, { useEffect, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { Alert, AppState, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL } from '../config';
import { convexClient } from './convex-auth';
import { api } from './api';
import { uploadPhotoToServer } from './photo';
import { useTranslation } from './i18n';

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

const PROBE_INTERVAL_BACKGROUND_MS = 30000;

let appActive = true;
let appStateWatched = false;

function watchAppState() {
  if (appStateWatched) return;
  appStateWatched = true;
  try {
    appActive = AppState.currentState === 'active';
    AppState.addEventListener('change', (state) => {
      const nowActive = state === 'active';
      const wasActive = appActive;
      appActive = nowActive;
      if (nowActive && !wasActive) void probeNow();
    });
  } catch {}
}

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

export async function retryConnectivity() {
  await probeNow();
  return conn;
}

let monitoringStarted = false;
function startMonitoring() {
  if (monitoringStarted) return;
  monitoringStarted = true;
  watchAppState();
  (async () => {
    await probeNow();
    const loop = async () => {
      if (!appActive) {
        setTimeout(loop, PROBE_INTERVAL_BACKGROUND_MS);
        return;
      }
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

const CACHE_PREFIX = 'spoonful:cache:';
const memCache = new Map<string, unknown>();

export function cacheRead<T>(key: string): T | undefined {
  return memCache.get(key) as T | undefined;
}

export async function cacheWrite<T>(key: string, value: T) {
  memCache.set(key, value);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {  }
}

export type PendingOp = { id: string; kind: string; at: number; payload: any; tries?: number };

const PENDING_KEY = 'spoonful:cache:pending';

const MAX_PENDING_OPS = 500;
let pendingOps: PendingOp[] = [];

export function listPendingOps(): PendingOp[] {
  return [...pendingOps];
}

export function pendingOpsCount(): number {
  return pendingOps.length;
}

const pendingListeners = new Set<() => void>();

export function subscribePendingOps(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

function emitPending() {
  pendingListeners.forEach((listener) => listener());
}

async function persistPendingOps() {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pendingOps));
  } catch {  }
}

export async function addPendingOp(kind: string, payload: any) {
  const p: any = payload ?? {};

  if (kind === 'shopping.toggle' && typeof p.id === 'string') {
    const already = pendingOps.some((op) => op.kind === 'shopping.toggle' && op.payload?.id === p.id);
    if (already) return;
  }
  

  const identical = pendingOps.some((op) => {
    if (op.kind !== kind) return false;
    try {
      return JSON.stringify(op.payload ?? {}) === JSON.stringify(p);
    } catch {
      return false;
    }
  });
  if (identical) return;
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

  if (pendingOps.length > MAX_PENDING_OPS) {
    pendingOps = pendingOps.slice(pendingOps.length - MAX_PENDING_OPS);
  }

  emitPending();
  await persistPendingOps();
}

export async function removePendingOps(ids: string[]) {
  const remove = new Set(ids);
  pendingOps = pendingOps.filter((op) => !remove.has(op.id));
  emitPending();
  await persistPendingOps();
}

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
      if (typeof p.id === 'string' && p.id.startsWith('tmp-')) return;
      await convexClient.mutation(api.calorieEntries.remove as any, { id: p.id });
      return;
    

    case 'tracker.water.add':
      await convexClient.mutation(api.tracker.addWater as any, { ml: p.ml ?? 250 });
      return;
    case 'tracker.water.undo':
      await convexClient.mutation(api.tracker.removeWater as any, {});
      return;
    case 'tracker.weight.add':
      await convexClient.mutation(api.tracker.addWeight as any, { weightKg: p.kg, at: p.at });
      return;
    case 'profile.save':
      await convexClient.mutation(api.users.saveProfile as any, {
        goal: p.goal,
        diet: p.diet,
        allergies: p.allergies,
        cookingExperience: p.cookingExperience,
        onboardedAt: p.onboardedAt,
        waterGoalMl: p.waterGoalMl,
      });
      return;
    case 'recipe.remove':
      await convexClient.mutation(api.recipes.remove as any, { id: p.id });
      return;
    case 'saved.save':
      await convexClient.mutation(api.savedRecipes.save as any, p);
      return;
    case 'saved.remove':
      await convexClient.mutation(api.savedRecipes.remove as any, { id: p.id });
      return;
    case 'saved.update':
      await convexClient.mutation(api.savedRecipes.update as any, {
        id: p.id,
        favorite: p.favorite,
        notes: p.notes ?? '',
        collectionIds: p.collectionIds ?? [],
      });
      return;
    case 'community.like':
      await convexClient.mutation(api.sharing.like as any, { shareId: p.shareId });
      return;
    case 'community.unlike':
      await convexClient.mutation(api.sharing.unlike as any, { shareId: p.shareId });
      return;
    case 'community.comment':
      await convexClient.mutation(api.sharing.addComment as any, {
        sharedRecipeId: p.sharedRecipeId,
        text: p.text,
        userName: p.userName ?? null,
      });
      return;
    case 'community.comment.remove':
      await convexClient.mutation(api.sharing.deleteComment as any, { id: p.id });
      return;
    case 'shopping.add':
      await convexClient.mutation(api.shoppingList.add as any, { name: p.name });
      return;
    case 'shopping.toggle':
      await convexClient.mutation(api.shoppingList.toggle as any, { id: p.id });
      return;
    case 'shopping.remove':
      if (typeof p.id === 'string' && p.id.startsWith('tmp-')) return;
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
    case 'photo.upload': {
      
      const url = await uploadPhotoToServer(p.base64, p.mime);
      if (!url) throw new Error('photo upload failed');
      if (typeof p.recipeId === 'string' && p.recipeId) {
        await convexClient.mutation(api.recipes.update as any, { id: p.recipeId, imageUrl: url });
      }
      return;
    }
    default:
      return;
  }
}

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
        const tries = (op.tries ?? 0) + 1;
        if (tries >= 5) {
          await removePendingOps([op.id]);
          continue;
        }
        const stored = pendingOps.find((o) => o.id === op.id);
        if (stored) stored.tries = tries;
        await persistPendingOps();
        break;
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
      } catch {  }
    }),
  );
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pendingOps = parsed.filter((o) => o && typeof o.id === 'string');
    }
  } catch {  }
}

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

startMonitoring();

export function OfflineBadge({ style }: { style?: object }) {
  const conn = useConnectivity();
  const { t } = useTranslation();
  if (conn !== 'offline') return null;
  return (
    <Text style={[{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3, color: '#b45309', backgroundColor: 'rgba(180,83,9,0.14)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', alignSelf: 'flex-start', marginBottom: 6 }, style]}>
      {t('s.offlineLabel')}
    </Text>
  );
}
