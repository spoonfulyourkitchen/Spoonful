

import { useEffect, useRef, useState } from 'react';
import { AppState, NativeModules } from 'react-native';

type ShareNative = { getSharedText: () => Promise<string | null>; clear: () => void };
const native: ShareNative | undefined = (NativeModules as any)?.ShareIntent;

let pending: string | null = null;
const listeners = new Set<(url: string) => void>();

export function setPendingVideoUrl(url: string): void {
  const value = String(url ?? '').trim();
  if (!value) return;
  pending = value;
  for (const l of listeners) l(value);
}

export function takePendingVideoUrl(): string | null {
  const value = pending;
  pending = null;
  return value;
}

export function subscribePendingVideoUrl(listener: (url: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function firstUrl(text?: string | null): string | null {
  const match = /(https?:\/\/[^\s]+)/i.exec(String(text ?? ''));
  return match ? match[1] : null;
}

export function useSharedVideoLink(onLink: (url: string) => void): void {
  

  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;
  useEffect(() => {
    if (!native?.getSharedText) return;
    let alive = true;
    const check = async () => {
      try {
        const text = await native.getSharedText();
        if (!alive || !text) return;
        const url = firstUrl(text);
        native.clear?.();
        if (url) {
          setPendingVideoUrl(url);
          onLinkRef.current(url);
        }
      } catch {}
    };
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
}

export function usePendingVideoUrl(): string | null {
  const [url, setUrl] = useState<string | null>(pending);
  useEffect(() => subscribePendingVideoUrl(setUrl), []);
  return url;
}
