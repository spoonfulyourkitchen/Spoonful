

import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhotoCrop = {
  fx: number;
  fy: number;
  zoom: number;
  

  iw?: number;
  ih?: number;
};

export const DEFAULT_CROP: PhotoCrop = { fx: 0.5, fy: 0.5, zoom: 1 };

export const isCropDefault = (c?: PhotoCrop | null): boolean =>
  !c || (Math.abs(c.fx - 0.5) < 0.01 && Math.abs(c.fy - 0.5) < 0.01 && c.zoom <= 1.01);

export const clampCrop = (c: PhotoCrop): PhotoCrop => {
  const zoom = Math.max(1, Math.min(3, c.zoom));
  const room = zoom <= 1.01 ? 0 : (zoom - 1) / (2 * zoom);
  return {
    zoom,
    fx: Math.max(0.5 - room, Math.min(0.5 + room, c.fx)),
    fy: Math.max(0.5 - room, Math.min(0.5 + room, c.fy)),
    ...(c.iw && c.ih && c.iw > 0 && c.ih > 0 ? { iw: c.iw, ih: c.ih } : {}),
  };
};

const STORE_KEY = 'spoonful:photo-crops';

export function cropFromFrame(input: {
  
  frame: { x: number; y: number; w: number; h: number };
  
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
  

  return clampCrop({ fx, fy, zoom: Math.max(1, widthZoom, 1 / edge), iw: imageW, ih: imageH });
}

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

export async function getCrop(uri?: string | null): Promise<PhotoCrop | null> {
  if (!uri) return null;
  const store = await loadStore();
  return store[cropKey(uri)] ?? null;
}

export async function setCrop(uri: string | null | undefined, crop: PhotoCrop | null): Promise<void> {
  if (!uri) return;
  const store = await loadStore();
  const key = cropKey(uri);
  if (!crop || isCropDefault(crop)) delete store[key];
  else store[key] = clampCrop(crop);
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export async function copyCrop(from?: string | null, to?: string | null): Promise<void> {
  if (!from || !to) return;
  const c = await getCrop(from);
  if (c) await setCrop(to, c);
}

type CropHandler = (uri: string) => Promise<PhotoCrop | null>;

let handler: CropHandler | null = null;

export function registerPhotoCrop(next: CropHandler | null): void {
  handler = next;
}

export async function openPhotoCrop(uri: string): Promise<PhotoCrop | null> {
  if (!handler || !uri) return null;
  try {
    return await handler(uri);
  } catch {
    return null;
  }
}

export async function editPhotoCrop(uri?: string | null): Promise<{ uri: string; crop: PhotoCrop | null } | null> {
  if (!uri) return null;
  const crop = await openPhotoCrop(uri);
  if (crop) await setCrop(uri, crop);
  return { uri, crop };
}
