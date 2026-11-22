import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalShoppingItem = {
  id: string;
  name: string;
  checked: boolean;
  recipeTitle?: string | null;
  at: number;
};

const STORAGE_KEY = 'spoonful:shopping-local:v2';
const LEGACY_KEY = 'spoonful:shopping-local:v1';

let items: LocalShoppingItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeShoppingLocal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getShoppingLocal(): LocalShoppingItem[] {
  return items;
}

function persist() {
  try {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function apply(next: LocalShoppingItem[]) {
  items = next;
  persist();
  emit();
}

function normalize(row: any): LocalShoppingItem | null {
  const name = String(row?.name ?? '').trim();
  if (!name) return null;
  return {
    id: typeof row?.id === 'string' && row.id ? row.id : newId(),
    name,
    checked: !!row?.checked,
    recipeTitle: row?.recipeTitle ? String(row.recipeTitle) : null,
    at: Number(row?.at) || Date.now(),
  };
}

export async function hydrateShoppingLocal(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed.map(normalize).filter(Boolean) as LocalShoppingItem[];
    } else {
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) items = parsed.map(normalize).filter(Boolean) as LocalShoppingItem[];
        await AsyncStorage.removeItem(LEGACY_KEY);
        persist();
      }
    }
    emit();
  } catch {
    emit();
  }
}

export function newId(): string {
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addLocalItem(name: string, recipeTitle?: string | null): LocalShoppingItem | null {
  const value = name.trim();
  if (!value) return null;
  const existing = items.find(
    (i) => i.name.toLowerCase() === value.toLowerCase() && String(i.recipeTitle ?? '') === String(recipeTitle ?? ''),
  );
  if (existing) {
    if (existing.checked) apply(items.map((i) => (i.id === existing.id ? { ...i, checked: false } : i)));
    return existing;
  }
  const item: LocalShoppingItem = {
    id: newId(),
    name: value,
    checked: false,
    recipeTitle: recipeTitle ?? null,
    at: Date.now(),
  };
  apply([...items, item]);
  return item;
}

export function toggleLocalItem(id: string) {
  apply(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
}

export function removeLocalItem(id: string) {
  apply(items.filter((i) => i.id !== id));
}

export function restoreLocalItem(item: LocalShoppingItem) {
  if (items.some((i) => i.id === item.id)) return;
  apply([...items, item].sort((a, b) => a.at - b.at));
}

export function clearLocalChecked() {
  apply(items.filter((i) => !i.checked));
}

export function renameLocalItem(id: string, name: string) {
  const value = name.trim();
  if (!value) return;
  apply(items.map((i) => (i.id === id ? { ...i, name: value } : i)));
}
