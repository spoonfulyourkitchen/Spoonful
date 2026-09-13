/**
 * 3.1.0: Bild-Ausschnitt (Fokuspunkt) für Fotos.
 *
 * Jedes Foto kann festlegen, **welche Stelle** angezeigt wird. Gespeichert
 * wird nur der Fokuspunkt (fx/fy in 0..1) plus Zoom - damit funktioniert der
 * Ausschnitt in jeder Rahmengröße (Kopfbereich, Karte, Diashow).
 *
 * Ablauf: Foto wählen → `openPhotoCrop(uri)` öffnet das Popup → Ergebnis
 * speichern. Das Anzeigen übernimmt `<CroppedImage />` / `<RecipeImage />`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhotoCrop = { fx: number; fy: number; zoom: number };

export const DEFAULT_CROP: PhotoCrop = { fx: 0.5, fy: 0.5, zoom: 1 };

export const isCropDefault = (c?: PhotoCrop | null): boolean =>
  !c || (Math.abs(c.fx - 0.5) < 0.01 && Math.abs(c.fy - 0.5) < 0.01 && c.zoom <= 1.01);

export const clampCrop = (c: PhotoCrop): PhotoCrop => {
  const zoom = Math.max(1, Math.min(3, c.zoom));
  // Je größer der Zoom, desto weiter darf verschoben werden.
  const room = zoom <= 1.01 ? 0 : (zoom - 1) / (2 * zoom);
  return {
    zoom,
    fx: Math.max(0.5 - room, Math.min(0.5 + room, c.fx)),
    fy: Math.max(0.5 - room, Math.min(0.5 + room, c.fy)),
  };
};

const STORE_KEY = 'spoonful:photo-crops';

/** Kurzer, stabiler Schlüssel für eine (evtl. sehr lange) Bild-URL. */
export function cropKey(uri?: string | null): string {
  if (!uri) return '';
  let h = 5381;
  for (let i = 0; i < uri.length; i++) h = ((h << 5) + h + uri.charCodeAt(i)) | 0;
  return `p${(h >>> 0).toString(36)}${uri.length.toString(36)}`;
}

let cache: Record<string, PhotoCrop> | null = null;

async function loadStore(): Promise<Record<string, PhotoCrop>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
  return cache as Record<string, PhotoCrop>;
}

/** Ausschnitt eines Bildes holen (null = mittig, ohne Zoom). */
export async function getCrop(uri?: string | null): Promise<PhotoCrop | null> {
  if (!uri) return null;
  const store = await loadStore();
  return store[cropKey(uri)] ?? null;
}

/** Ausschnitt setzen bzw. entfernen (Standard wird gelöscht). */
export async function setCrop(uri: string | null | undefined, crop: PhotoCrop | null): Promise<void> {
  if (!uri) return;
  const store = await loadStore();
  const key = cropKey(uri);
  if (!crop || isCropDefault(crop)) delete store[key];
  else store[key] = clampCrop(crop);
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* Ausschnitt ist Komfort - Fehler dürfen nichts kaputt machen */
  }
}

/** Ausschnitt von einer URL auf eine andere übertragen (z. B. lokal → Upload). */
export async function copyCrop(from?: string | null, to?: string | null): Promise<void> {
  if (!from || !to) return;
  const c = await getCrop(from);
  if (c) await setCrop(to, c);
}

/* ── Brücke zum Popup ─────────────────────────────────────────────────────── */
type CropHandler = (uri: string) => Promise<PhotoCrop | null>;

let handler: CropHandler | null = null;

export function registerPhotoCrop(next: CropHandler | null): void {
  handler = next;
}

/**
 * Öffnet das Ausschnitt-Popup für ein Bild. Ohne gemountetes Popup (z. B. in
 * Tests) wird sofort null zurückgegeben - der Aufrufer speichert dann einfach
 * ohne Ausschnitt.
 */
export async function openPhotoCrop(uri: string): Promise<PhotoCrop | null> {
  if (!handler || !uri) return null;
  try {
    return await handler(uri);
  } catch {
    return null;
  }
}

/**
 * Hilfsfunktion für alle Foto-Stellen: Bild wählen, Ausschnitt festlegen,
 * Ausschnitt speichern. Gibt die Bild-URL zurück (oder null bei Abbruch).
 */
export async function editPhotoCrop(uri?: string | null): Promise<{ uri: string; crop: PhotoCrop | null } | null> {
  if (!uri) return null;
  const crop = await openPhotoCrop(uri);
  if (crop) await setCrop(uri, crop);
  return { uri, crop };
}
