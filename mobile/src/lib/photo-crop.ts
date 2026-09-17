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

export type PhotoCrop = {
  fx: number;
  fy: number;
  zoom: number;
  /**
   * 3.3.0: Bildgröße zum Zeitpunkt des Zuschneidens (Pixel).
   *
   * Ohne sie musste die Anzeige die Größe erst per `Image.getSize` nachladen —
   * und bei Bildern, die als data-URL vorliegen (Kamera/Foto in der App), klappt
   * das nicht zuverlässig. Die Folge war der alte Fehler, dass immer die Mitte
   * des Bildes zu sehen war. Jetzt reist die Größe im Ausschnitt mit.
   */
  iw?: number;
  ih?: number;
};

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
    ...(c.iw && c.ih && c.iw > 0 && c.ih > 0 ? { iw: c.iw, ih: c.ih } : {}),
  };
};

const STORE_KEY = 'spoonful:photo-crops';

/**
 * 3.2.1: Rechnet „Rahmen über dem ganzen Bild" in den gespeicherten Ausschnitt um.
 *
 * Der Rahmen darf frei über dem Bild liegen. Damit die gewählte Stelle später
 * auch wirklich angezeigt wird, wird der Zoom so weit angehoben, dass der
 * Fokuspunkt nicht vom `clampCrop` beschnitten wird (früher verschwand die
 * Auswahl dadurch wieder in der Mitte).
 */
export function cropFromFrame(input: {
  /** Rahmen in Anzeige-Pixeln (relativ zur Bühne). */
  frame: { x: number; y: number; w: number; h: number };
  /** Bild-Anzeige: Maßstab + Ursprung in der Bühne. */
  view: { s: number; ox: number; oy: number };
  imageW: number;
  imageH: number;
}): PhotoCrop {
  const { frame, view, imageW, imageH } = input;
  if (!frame.w || !view.s || !imageW || !imageH) return { ...DEFAULT_CROP };
  const cx = (frame.x + frame.w / 2 - view.ox) / view.s;
  const cy = (frame.y + frame.h / 2 - view.oy) / view.s;
  const fx = Math.max(0, Math.min(1, cx / imageW));
  const fy = Math.max(0, Math.min(1, cy / imageH));
  const widthZoom = (imageW * view.s) / frame.w;
  const edge = Math.max(0.34, 1 - 2 * Math.abs(fx - 0.5), 1 - 2 * Math.abs(fy - 0.5));
  return clampCrop({ fx, fy, zoom: Math.max(1, widthZoom, 1 / edge) });
}

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
