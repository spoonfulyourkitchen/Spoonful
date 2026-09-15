/**
 * 3.2.2: Tests der DeepSeek-Sperrzeit (Stoßzeiten).
 *
 * Regel: Peak nur Mo–Fr in den UTC-Fenstern 01:00–04:00 und 06:00–10:00.
 * In deutscher Zeit (Sommer) also 03:00–06:00 und 08:00–12:00.
 */
import {
  berlinOffsetMinutes,
  berlinPeakWindows,
  isDeepSeekPeak,
  nextOffPeak,
  peakSummary,
} from '../../supabase/functions/ai/peak';

const utc = (text: string) => new Date(`${text}Z`);

describe('isDeepSeekPeak', () => {
  test('Werktag in der Frühstoßzeit (01:00–04:00 UTC)', () => {
    expect(isDeepSeekPeak(utc('2026-09-14T02:00:00'))).toBe(true); // Montag
    expect(isDeepSeekPeak(utc('2026-09-14T03:59:00'))).toBe(true);
    expect(isDeepSeekPeak(utc('2026-09-14T04:00:00'))).toBe(false);
  });

  test('Werktag in der zweiten Stoßzeit (06:00–10:00 UTC)', () => {
    expect(isDeepSeekPeak(utc('2026-09-14T06:00:00'))).toBe(true);
    expect(isDeepSeekPeak(utc('2026-09-14T09:59:00'))).toBe(true);
    expect(isDeepSeekPeak(utc('2026-09-14T10:00:00'))).toBe(false);
  });

  test('Werktag außerhalb der Fenster ist Off-Peak', () => {
    expect(isDeepSeekPeak(utc('2026-09-14T00:30:00'))).toBe(false);
    expect(isDeepSeekPeak(utc('2026-09-14T05:00:00'))).toBe(false);
    expect(isDeepSeekPeak(utc('2026-09-14T12:30:00'))).toBe(false);
    expect(isDeepSeekPeak(utc('2026-09-14T20:00:00'))).toBe(false);
  });

  test('Wochenende ist immer Off-Peak', () => {
    expect(isDeepSeekPeak(utc('2026-09-19T02:00:00'))).toBe(false); // Samstag
    expect(isDeepSeekPeak(utc('2026-09-20T08:30:00'))).toBe(false); // Sonntag
  });
});

describe('deutsche Zeit', () => {
  test('Sommerzeit: Fenster 03–06 und 08–12 Uhr', () => {
    const summer = utc('2026-09-14T12:00:00'); // MESZ
    expect(berlinOffsetMinutes(summer)).toBe(120);
    expect(berlinPeakWindows(summer)).toEqual(['03:00–06:00', '08:00–12:00']);
  });

  test('Winterzeit: Fenster 02–05 und 07–11 Uhr', () => {
    const winter = utc('2026-11-16T12:00:00'); // MEZ
    expect(berlinOffsetMinutes(winter)).toBe(60);
    expect(berlinPeakWindows(winter)).toEqual(['02:00–05:00', '07:00–11:00']);
  });

  test('peakSummary nennt Zeit und Zone', () => {
    expect(peakSummary(utc('2026-09-14T12:00:00'))).toContain('MESZ');
    expect(peakSummary(utc('2026-09-14T02:00:00'))).toContain('Peak');
  });
});

describe('nextOffPeak', () => {
  test('aus der Frühstoßzeit heraus auf 04:00 UTC', () => {
    expect(nextOffPeak(utc('2026-09-14T02:30:00')).toISOString()).toBe('2026-09-14T04:00:00.000Z');
  });

  test('während Off-Peak sofort', () => {
    expect(nextOffPeak(utc('2026-09-14T12:00:00')).toISOString()).toBe('2026-09-14T12:00:00.000Z');
  });
});
