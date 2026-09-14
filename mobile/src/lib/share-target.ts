/**
 * 3.2.0: Teilen-Ziel (Android).
 *
 * Wird in TikTok/Instagram/YouTube auf "Teilen" getippt, erscheint Spoonful.
 * Der Link kommt über das native Modul `ShareIntent` an; hier wird er
 * zwischengespeichert und im AI Chef automatisch in die Video-Box geladen.
 */
import { useEffect, useState } from 'react';
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

/** Erste URL aus einem geteilten Text holen. */
export function firstUrl(text?: string | null): string | null {
  const match = /(https?:\/\/[^\s]+)/i.exec(String(text ?? ''));
  return match ? match[1] : null;
}

/**
 * Holt einen geteilten Link ab (App-Start und jedes Mal, wenn die App wieder
 * in den Vordergrund kommt - z. B. direkt nach dem Teilen).
 */
export function useSharedVideoLink(onLink: (url: string) => void): void {
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
          onLink(url);
        }
      } catch {
        /* kein geteilter Inhalt */
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Kleiner Hook für Screens: liefert den zuletzt geteilten Link. */
export function usePendingVideoUrl(): string | null {
  const [url, setUrl] = useState<string | null>(pending);
  useEffect(() => subscribePendingVideoUrl(setUrl), []);
  return url;
}
