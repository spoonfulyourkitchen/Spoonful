

export const PEAK_UTC_WINDOWS: [number, number][] = [
  [1, 4],
  [6, 10],
];

export function berlinOffsetMinutes(date: Date): number {
  const utc = new Date(date.getTime());
  const utcAsLocal = new Date(utc.getTime() + 0).getTime();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - utcAsLocal) / 60000);
}

export function isDeepSeekPeak(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return PEAK_UTC_WINDOWS.some(([from, to]) => hour >= from && hour < to);
}

function windowText(offsetMinutes: number, [from, to]: [number, number]): string {
  const pad = (value: number) => `${String(value % 24).padStart(2, '0')}:00`;
  return `${pad(from + offsetMinutes / 60)}–${pad(to + offsetMinutes / 60)}`;
}

export function berlinPeakWindows(date: Date = new Date()): string[] {
  const offset = berlinOffsetMinutes(date);
  return PEAK_UTC_WINDOWS.map((window) => windowText(offset, window));
}

export function nextOffPeak(date: Date = new Date()): Date {
  const next = new Date(date.getTime());
  next.setUTCSeconds(0, 0);
  if (!isDeepSeekPeak(next)) return next;
  for (let i = 0; i < 8 * 60; i += 1) {
    next.setUTCMinutes(next.getUTCMinutes() + 1);
    if (!isDeepSeekPeak(next)) return next;
  }
  return next;
}

export function peakSummary(date: Date = new Date()): string {
  const windows = berlinPeakWindows(date).join(' und ');
  const offset = berlinOffsetMinutes(date);
  return isDeepSeekPeak(date)
    ? `Peak (deutsche Zeit ${windows}; ${offset >= 120 ? 'MESZ' : 'MEZ'})`
    : `Off-Peak (${offset >= 120 ? 'MESZ' : 'MEZ'})`;
}
