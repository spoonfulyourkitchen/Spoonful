

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spoonful:tracker-local:v1';

export type WeightEntry = { id: string; kg: number; at: number; synced: boolean };

type Store = {
  
  day: string;
  
  serverMl: number;
  
  pending: number[];
  
  undoPending: number;
  weights: WeightEntry[];
};

const today = () => new Date().toISOString().slice(0, 10);

let store: Store = { day: today(), serverMl: 0, pending: [], undoPending: 0, weights: [] };
let loaded = false;
const listeners = new Set<() => void>();

let waterSnapshot = { totalMl: 0, serverMl: 0, pendingMl: 0, pending: [] as number[], undoPending: 0 };
let weightSnapshot: WeightEntry[] = [];

function recompute() {
  const pendingMl = store.pending.reduce((s, n) => s + n, 0);
  waterSnapshot = {
    totalMl: Math.max(0, store.serverMl + pendingMl),
    serverMl: store.serverMl,
    pendingMl,
    pending: store.pending,
    undoPending: store.undoPending,
  };
  weightSnapshot = [...store.weights].sort((a, b) => b.at - a.at);
}

function emit() {
  listeners.forEach((fn) => fn());
}

function persist() {
  try {
    void AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}

function apply(patch: Partial<Store>) {
  store = { ...store, ...patch };
  recompute();
  persist();
  emit();
}

export function subscribeTrackerLocal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function hydrateTrackerLocal(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        store = {
          day: typeof parsed.day === 'string' ? parsed.day : today(),
          serverMl: Number(parsed.serverMl) || 0,
          pending: Array.isArray(parsed.pending) ? parsed.pending.map(Number).filter((n: number) => n > 0) : [],
          undoPending: Math.max(0, Number(parsed.undoPending) || 0),
          weights: Array.isArray(parsed.weights) ? parsed.weights.filter((w: any) => w && Number.isFinite(Number(w.kg))) : [],
        };
      }
    }
    
    if (store.day !== today()) store = { ...store, day: today(), serverMl: 0, undoPending: 0 };
  } catch {}
  recompute();
  emit();
}

export function getWaterLocal() {
  return waterSnapshot;
}

export function addWaterLocal(ml: number) {
  const value = Math.max(50, Math.min(2000, Math.round(ml)));
  apply({ pending: [...store.pending, value] });
}

export function undoWaterLocal(): 'local' | 'server' | 'none' {
  if (store.pending.length) {
    apply({ pending: store.pending.slice(0, -1) });
    return 'local';
  }
  if (store.serverMl > 0) {
    apply({ serverMl: Math.max(0, store.serverMl - 250), undoPending: store.undoPending + 1 });
    return 'server';
  }
  return 'none';
}

export function waterServerTotal(totalMl: number) {
  const value = Number(totalMl);
  if (!Number.isFinite(value)) return;
  if (store.pending.length || store.undoPending) return; 
  if (value === store.serverMl) return;
  apply({ serverMl: Math.max(0, Math.round(value)) });
}

export function waterPending(): { add: number[]; undo: number } {
  return { add: [...store.pending], undo: store.undoPending };
}

export function waterMarkSynced(sentCount: number, undoneCount: number) {
  const rest = store.pending.slice(sentCount);
  const sentMl = store.pending.slice(0, sentCount).reduce((s, n) => s + n, 0);
  apply({
    pending: rest,
    serverMl: store.serverMl + sentMl,
    undoPending: Math.max(0, store.undoPending - undoneCount),
  });
}

export function getWeightsLocal(): WeightEntry[] {
  return weightSnapshot;
}

export function addWeightLocal(kg: number, at = Date.now()): WeightEntry {
  const entry: WeightEntry = {
    id: `loc-${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kg: Math.round(kg * 10) / 10,
    at,
    synced: false,
  };
  apply({ weights: [entry, ...store.weights].slice(0, 200) });
  return entry;
}

export function weightsServerList(rows: { id?: string; _id?: string; weightKg?: number; loggedAt?: number }[]) {
  const next = [...store.weights];
  for (const row of rows) {
    const id = String(row?.id ?? row?._id ?? '');
    const kg = Number(row?.weightKg);
    const at = Number(row?.loggedAt ?? 0);
    if (!id || !Number.isFinite(kg)) continue;
    const known = next.findIndex((w) => w.id === id);
    if (known !== -1) {
      next[known] = { ...next[known], synced: true, kg, at: at || next[known].at };
      continue;
    }
    next.push({ id, kg, at: at || Date.now(), synced: true });
  }
  const sorted = next.sort((a, b) => b.at - a.at).slice(0, 200);
  if (JSON.stringify(sorted) !== JSON.stringify(store.weights)) apply({ weights: sorted });
}

export function weightPending(): WeightEntry[] {
  return store.weights.filter((w) => !w.synced);
}

export function weightMarkSynced(id: string, serverId?: string) {
  apply({ weights: store.weights.map((w) => (w.id === id ? { ...w, id: serverId || w.id, synced: true } : w)) });
}
