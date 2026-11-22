

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

export function at<T>(list: readonly T[] | undefined | null, index: number): T | undefined {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return undefined;
  return list[index];
}
