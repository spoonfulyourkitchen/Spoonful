/**
 * 3.2.2: kleine Helfer, damit nichts „ewig hängt".
 *
 * Punkt 13/70 der Stabilitäts-Liste: jede Netzwerk-Anfrage bekommt ein
 * Zeitlimit. Ein hängender Aufruf sieht für den Nutzer aus wie ein Absturz —
 * „die App friert ein" ist in Wahrheit meistens ein Versprechen ohne Ende.
 */

/** Nach `ms` ablehnen, statt unbegrenzt zu warten. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'timeout'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Text mit Zeitlimit holen (inkl. Abbruch der Verbindung). */
export async function fetchText(
  url: string,
  init: RequestInit = {},
  ms = 9000,
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Zahl aus Text lesen ("1,49", "1.49", " 12 "), sonst `fallback`. */
export function parseNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const raw = String(value ?? '').trim().replace(/[^0-9.,-]/g, '');
  if (!raw) return fallback;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = raw.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

/** Sichere Array-Position (Punkt 10: kein Absturz bei leeren Listen). */
export function at<T>(list: readonly T[] | undefined | null, index: number): T | undefined {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return undefined;
  return list[index];
}
