/**
 * 3.2.1: Tests für den Bild-Ausschnitt (Rahmen über dem ganzen Bild).
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { clampCrop, cropFromFrame } from '../src/lib/photo-crop';

/** Bild 2000x1500, Bühne 300x300 -> Vollbild-Maßstab 0.15, Anzeige 300x225. */
const IMG = { imageW: 2000, imageH: 1500 };
const VIEW = { s: 0.15, ox: 0, oy: 37.5 };

describe('cropFromFrame', () => {
  test('Rahmen in der Mitte über dem ganzen Bild -> mittiger Fokus', () => {
    const crop = cropFromFrame({
      frame: { x: 0, y: 37.5, w: 300, h: 187.5 },
      view: VIEW,
      ...IMG,
    });
    expect(crop.fx).toBeCloseTo(0.5, 2);
    expect(crop.fy).toBeCloseTo(0.5, 2);
    expect(crop.zoom).toBeCloseTo(1, 2);
  });

  test('Rahmen ganz links -> linker Fokus, und der bleibt auch nach dem Begrenzen', () => {
    const crop = cropFromFrame({
      frame: { x: 0, y: 37.5, w: 150, h: 93.75 },
      view: VIEW,
      ...IMG,
    });
    expect(crop.fx).toBeLessThan(0.45);
    // Wichtig: clampCrop darf die gewählte Stelle nicht wieder zur Mitte ziehen.
    const limited = clampCrop(crop);
    expect(limited.fx).toBeCloseTo(crop.fx, 3);
  });

  test('Rahmen am rechten Rand -> rechter Fokus ohne Verschiebung', () => {
    const crop = cropFromFrame({
      frame: { x: 150, y: 37.5, w: 150, h: 93.75 },
      view: VIEW,
      ...IMG,
    });
    expect(crop.fx).toBeGreaterThan(0.55);
    expect(clampCrop(crop).fx).toBeCloseTo(crop.fx, 3);
  });

  test('Zwei-Finger-Zoom vergrößert den Zoom', () => {
    const small = cropFromFrame({ frame: { x: 0, y: 37.5, w: 300, h: 187.5 }, view: VIEW, ...IMG });
    const zoomed = cropFromFrame({ frame: { x: 0, y: 37.5, w: 300, h: 187.5 }, view: { ...VIEW, s: 0.3, oy: 0 }, ...IMG });
    expect(zoomed.zoom).toBeGreaterThan(small.zoom);
  });

  test('kaputte Werte -> Standard statt Absturz', () => {
    const crop = cropFromFrame({ frame: { x: 0, y: 0, w: 0, h: 0 }, view: VIEW, ...IMG });
    expect(crop).toEqual({ fx: 0.5, fy: 0.5, zoom: 1 });
  });
});
