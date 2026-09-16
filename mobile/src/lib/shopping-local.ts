/**
 * 3.2.3: Lokale Einkaufsliste.
 *
 * Warum: Die Liste lief vorher bei *jeder* Aktion (ticken, abhaken, löschen)
 * über den Server — dadurch war sie träge und ohne Netz gar nicht bedienbar.
 * Jetzt ist der lokale Speicher die Quelle für die Anzeige:
 *
 *   * Änderungen sind sofort sichtbar (kein Warten auf die Antwort)
 *   * die Liste liegt in AsyncStorage → funktioniert offline
 *   * wenn Netz da ist, wird zusätzlich im Hintergrund zum Server geschrieben
 *     (bester Versuch, Fehler stören die Bedienung nicht)
 *
 * Die Server-Liste wird beim Start einmal gelesen und *zusammengeführt*: was
 * lokal schon steht, bleibt (inkl. Haken); Server-Posten werden übernommen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalShoppingItem = {
  /** lokale Id; bei Server-Posten die echte Zeilen-Id (dann synchronisierbar) */
  id: string;
  name: string;
  checked: boolean;
  recipeTitle?: string | null;
  /** true = liegt (auch) auf dem Server */
  synced: boolean;
};

const STORAGE_KEY = 'spoonful:shopping-local:v1';

let items: LocalShoppingItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeShoppingLocal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getShoppingLocal(): LocalShoppingItem[] {
  return items;
}

export function getShoppingLocalServer(): LocalShoppingItem[] {
  return items;
}

function persist() {
  try {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Speicher voll/kein Zugriff — die Anzeige läuft trotzdem lokal weiter */
  }
}

function apply(next: LocalShoppingItem[]) {
  items = next;
  persist();
  emit();
}

/** Einmal beim Start aufrufen (App.tsx) — liest die gespeicherte Liste. */
export async function hydrateShoppingLocal(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      items = parsed.filter((i: any) => i && typeof i.name === 'string');
      emit();
    }
  } catch {
    /* kaputter Eintrag → leere Liste */
  }
}

const newId = () => `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const key = (name: string, recipeTitle?: string | null) =>
  `${String(recipeTitle ?? '').trim().toLowerCase()}::${name.trim().toLowerCase()}`;

/** Neuen Posten eintragen (gibt den lokalen Posten zurück). */
export function addLocalItem(name: string, recipeTitle?: string | null): LocalShoppingItem {
  const value = name.trim();
  const item: LocalShoppingItem = { id: newId(), name: value, checked: false, recipeTitle: recipeTitle ?? null, synced: false };
  apply([...items, item]);
  return item;
}

export function toggleLocalItem(id: string) {
  apply(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
}

export function setLocalChecked(id: string, checked: boolean) {
  apply(items.map((i) => (i.id === id ? { ...i, checked } : i)));
}

export function removeLocalItem(id: string) {
  apply(items.filter((i) => i.id !== id));
}

/** Alle abgehakten entfernen. */
export function clearLocalChecked() {
  apply(items.filter((i) => !i.checked));
}

export function markLocalSynced(localId: string, serverId: string) {
  apply(items.map((i) => (i.id === localId ? { ...i, id: serverId, synced: true } : i)));
}

/**
 * Server-Liste einmischen: bekannte Posten behalten ihren lokalen Zustand,
 * neue kommen dazu. Lokale Posten ohne Server-Id werden zu Server-Posten,
 * sobald derselbe Name vom Server kommt (so entstehen keine Dubletten).
 */
export function mergeServerItems(server: { _id?: string; id?: string; name?: string; checked?: boolean; recipeTitle?: string | null }[]) {
  const next = [...items];
  for (const row of server) {
    const serverId = String(row?._id ?? row?.id ?? '');
    const name = String(row?.name ?? '').trim();
    if (!serverId || !name) continue;
    const existingById = next.findIndex((i) => i.id === serverId);
    if (existingById !== -1) {
      next[existingById] = { ...next[existingById], checked: !!row?.checked, synced: true };
      continue;
    }
    const k = key(name, row?.recipeTitle);
    const localMatch = next.findIndex((i) => !i.synced && key(i.name, i.recipeTitle) === k);
    if (localMatch !== -1) {
      next[localMatch] = { ...next[localMatch], id: serverId, checked: !!row?.checked, synced: true };
      continue;
    }
    next.push({ id: serverId, name, checked: !!row?.checked, recipeTitle: row?.recipeTitle ?? null, synced: true });
  }
  const changed = JSON.stringify(next) !== JSON.stringify(items);
  if (changed) apply(next);
}
