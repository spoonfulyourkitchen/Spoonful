import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { supabase } from './supabase';
import { SUPABASE_STORAGE_BUCKET } from '../config';

export type PickedPhoto = {
  uri?: string;
  fileName?: string;
  type?: string;
  width?: number;
  height?: number;
  base64?: string;
};

const SHARED_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.7 as const,
  selectionLimit: 1,
  includeBase64: true,
  maxWidth: 1600,
  maxHeight: 1600,
};

const SCAN_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 1 as const,
  selectionLimit: 1,
  includeBase64: true,
  maxWidth: 2600,
  maxHeight: 2600,
};

async function run(source: 'camera' | 'library', options: Record<string, unknown> = {}): Promise<PickedPhoto | null> {
  try {
    const res = await (source === 'camera'
      ? launchCamera({ ...SHARED_OPTIONS, cameraType: 'back', saveToPhotos: false, ...options })
      : launchImageLibrary({ ...SHARED_OPTIONS, ...options }));
    if (res.didCancel || res.errorCode) return null;
    const asset = res.assets?.[0];
    if (!asset?.uri) return null;
    return {
      uri: asset.uri,
      fileName: asset.fileName,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
    };
  } catch {
    return null;
  }
}

export async function pickFromGallery(): Promise<PickedPhoto | null> {
  return run('library');
}

export async function takePhoto(): Promise<PickedPhoto | null> {
  return run('camera');
}

export async function takeSharpPhoto(): Promise<PickedPhoto | null> {
  return run('camera', { ...SCAN_OPTIONS });
}

export async function pickSharpPhoto(): Promise<PickedPhoto | null> {
  return run('library', { ...SCAN_OPTIONS });
}

const STEP_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.4 as const,
  selectionLimit: 1,
  includeBase64: true,
  maxWidth: 900,
  maxHeight: 900,
};

export async function takeStepPhoto(): Promise<PickedPhoto | null> {
  return run('camera', { ...STEP_OPTIONS });
}

export async function pickStepPhoto(): Promise<PickedPhoto | null> {
  return run('library', { ...STEP_OPTIONS });
}

export async function uploadPhotoToServer(
  base64: string | undefined,
  mime?: string,
): Promise<string | null> {
  if (!base64) return null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    const ext = (mime || 'image/jpeg').split('/')[1] || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(path, decodeBase64(base64), {
        contentType: mime || 'image/jpeg',
        upsert: false,
      });
    if (error || !data?.path) return null;

    const { data: publicUrl } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(data.path);
    return publicUrl?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function pickManyFromGallery(limit = 6): Promise<PickedPhoto[]> {
  try {
    const res = await launchImageLibrary({
      ...SHARED_OPTIONS,
      selectionLimit: Math.max(2, Math.min(10, limit)),
      quality: 0.6,
      maxWidth: 1400,
      maxHeight: 1400,
    });
    if (res.didCancel || res.errorCode) return [];
    return (res.assets ?? [])
      .filter((a) => !!a?.uri)
      .map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName,
        type: asset.type,
        width: asset.width,
        height: asset.height,
        base64: asset.base64,
      }));
  } catch {
    return [];
  }
}

export async function uploadPhotoOrQueue(
  base64: string | undefined,
  mime: string | undefined,
  queue: (payload: { base64: string; mime: string }) => Promise<void>,
): Promise<string | null> {
  if (!base64) return null;
  const url = await uploadPhotoToServer(base64, mime);
  if (url) return url;
  try {
    await queue({ base64, mime: mime || 'image/jpeg' });
  } catch {}
  return null;
}

function decodeBase64(b64: string): Uint8Array {
  const decoder = (globalThis as any).atob as ((data: string) => string) | undefined;
  if (typeof decoder !== 'function') throw new Error('base64 decoding is unavailable on this device');
  const binary = decoder(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
