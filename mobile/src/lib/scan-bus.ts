/**
 * 3.2.0: Kleiner "Übergabe-Kanal" für Scanner-Codes.
 *
 * Das langes Drücken auf den Tracker-Tab öffnet den Barcode-Scanner von
 * überall. Der Code landet hier und wird vom Tracker abgeholt, sobald er
 * sichtbar ist.
 */
let pending: string | null = null;
const listeners = new Set<(code: string) => void>();

export function setPendingBarcode(code: string): void {
  const value = String(code ?? '').trim();
  if (!value) return;
  pending = value;
  for (const l of listeners) l(value);
}

export function takePendingBarcode(): string | null {
  const value = pending;
  pending = null;
  return value;
}

export function subscribePendingBarcode(listener: (code: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
