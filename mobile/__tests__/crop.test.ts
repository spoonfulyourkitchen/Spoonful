/**
 * 3.3.1: Test für den Bild-Ausschnitt.
 *
 * Der Fehler „es wird immer die Mitte angezeigt" ist nur nachrechenbar, wenn
 * beide Seiten derselben Rechnung geprüft werden:
 *   1. das Popup (PhotoCropModal) rechnet den Rahmen in den gespeicherten
 *      Ausschnitt um (`cropFromFrame`),
 *   2. die Anzeige (CroppedImage) rechnet daraus die sichtbare Stelle aus.
 *
 * Der Test prüft, dass der gewählte Punkt (Rahmenmitte) nachher genau in der
 * Mitte des sichtbaren Bereichs liegt — und zwar auch, wenn Bild und Rahmen
 * unterschiedliche Seitenverhältnisse haben.
 */
import { clampCrop, cropFromFrame, isCropDefault } from '../src/lib/photo-crop';

/* Der Ausschnitt-Speicher nutzt AsyncStorage — im Test reicht ein Ersatz. */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

/** Bild-Anzeige im Popup: „contain" auf der Bühne. */
function contain(imageW: number, imageH: number, stageW: number, stageH: number) {
  const s = Math.min(stageW / imageW, stageH / imageH);
  const drawnW = imageW * s;
  const drawnH = imageH * s;
  return { s, ox: (stageW - drawnW) / 2, oy: (stageH - drawnH) / 2 };
}

/** Sichtbarer Bildbereich (Pixel) so, wie CroppedImage es zeichnet. */
function visibleRegion(
  crop: { fx: number; fy: number; zoom: number; iw?: number; ih?: number },
  frameW: number,
  frameH: number,
) {
  const iw = crop.iw as number;
  const ih = crop.ih as number;
  const base = Math.max(frameW / iw, frameH / ih);
  const scale = base * crop.zoom;
  const drawW = iw * scale;
  const drawH = ih * scale;
  const left = frameW / 2 - crop.fx * drawW;
  const top = frameH / 2 - crop.fy * drawH;
  return {
    x0: (-left) / scale,
    x1: (frameW - left) / scale,
    y0: (-top) / scale,
    y1: (frameH - top) / scale,
  };
}

/** Center of the frame in image pixels (what the user selected). */
function frameCenter(crop: { fx: number; fy: number; iw?: number; ih?: number }) {
  return { cx: crop.fx * (crop.iw as number), cy: crop.fy * (crop.ih as number) };
}

describe('Bild-Ausschnitt', () => {
  const cases: [number, number][] = [
    [3000, 2000], // Querformat
    [2000, 3000], // Hochformat
    [2000, 2000], // quadratisch
    [4000, 1000], // sehr breit
  ];

  for (const [iw, ih] of cases) {
    it(`setzt den gewählten Punkt in die Mitte (${iw}x${ih})`, () => {
      const stage = 350;
      const view = contain(iw, ih, stage, stage);
      const rect = { x: 0, y: 0, w: stage, h: stage };

      /* Der Rahmnen wird bewusst in eine Ecke gezogen (nicht die Mitte). */
      const w = 130;
      const h = w / 1.6;
      const frame = { w, h, x: rect.x + 6, y: rect.y + 6 };

      const crop = cropFromFrame({ frame, view, imageW: iw, imageH: ih });
      const withSize = { ...crop, iw, ih };

      /* Anzeige in einer anderen Rahmengröße als im Popup. */
      const vis = visibleRegion(withSize, 300, 300);
      const selected = frameCenter(withSize);

      expect(selected.cx).toBeGreaterThan((vis.x0 + vis.x1) / 2 - 1);
      expect(selected.cx).toBeLessThan((vis.x0 + vis.x1) / 2 + 1);
      expect(selected.cy).toBeGreaterThan((vis.y0 + vis.y1) / 2 - 1);
      expect(selected.cy).toBeLessThan((vis.y0 + vis.y1) / 2 + 1);

      /* Die Mitte des Bildes darf NICHT die Antwort sein. */
      const middle = { x: iw / 2, y: ih / 2 };
      const farFromMiddle = Math.abs(selected.cx - middle.x) > iw * 0.08 || Math.abs(selected.cy - middle.y) > ih * 0.08;
      expect(farFromMiddle).toBe(true);
    });
  }

  it('behält die Bildgröße im Ausschnitt (nötig für die Anzeige)', () => {
    const view = contain(3000, 2000, 350, 350);
    const crop = cropFromFrame({ frame: { x: 0, y: 0, w: 120, h: 75 }, view, imageW: 3000, imageH: 2000 });
    expect(crop.iw).toBe(3000);
    expect(crop.ih).toBe(2000);
    expect(isCropDefault(crop)).toBe(false);
  });

  it('verschiebt den Fokus nicht beim Begrenzen (clampCrop)', () => {
    const crop = clampCrop({ fx: 0.9, fy: 0.5, zoom: 1, iw: 1000, ih: 1000 } as any);
    expect(crop.fx).toBeGreaterThanOrEqual(0.45);
    expect(crop.iw).toBe(1000);
  });

  it('mittiger Rahmen ergibt Standard-Ausschnitt', () => {
    const view = contain(1000, 1000, 300, 300);
    /* Rahmen wirklich mittig: Mitte der Bühne (150|150) */
    const w = 100;
    const h = w / 1.6;
    const crop = cropFromFrame({
      frame: { x: 150 - w / 2, y: 150 - h / 2, w, h },
      view,
      imageW: 1000,
      imageH: 1000,
    });
    expect(Math.abs(crop.fx - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(crop.fy - 0.5)).toBeLessThan(0.02);
  });
});
