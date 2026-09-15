/**
 * 3.2.1: Popup zum Festlegen des Bild-Ausschnitts — neu gebaut.
 *
 * Was jetzt geht (genau das, was gewünscht war):
 *  - Man sieht das **komplette Bild** (nicht mehr nur einen Ausschnitt).
 *  - Der **Rahmen** (das, was später angezeigt wird) lässt sich mit einem
 *    Finger **frei über das Bild schieben**.
 *  - Mit **zwei Fingern** lässt sich das Bild **vergrößern/verkleinern**
 *    (wie in anderen Apps); die Stelle unter den Fingern bleibt dabei stehen.
 *  - Gespeichert bleibt „Fokuspunkt + Zoom", deshalb stimmt der Ausschnitt in
 *    jeder Rahmengröße (Karte, Kopfbereich, Diashow).
 *
 * Gespeichert wird über `lib/photo-crop.ts`; angezeigt über `<CroppedImage />`.
 */
import React, { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, LayoutChangeEvent, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Check, Minus, Move, Plus, RotateCcw, X } from 'lucide-react-native';

import { colors, fonts, rgbaHelper } from '../theme';
import { useTranslation } from '../lib/i18n';
import { cropFromFrame, DEFAULT_CROP, registerPhotoCrop, type PhotoCrop } from '../lib/photo-crop';

/** Seitenverhältnis des Rahmens (Breite : Höhe) - wie die Rezept-Karten. */
const FRAME_ASPECT = 1.6;
/** Wie weit man höchstens hineinzoomen kann (relativ zur Vollbild-Anzeige). */
const MAX_PINCH = 6;

type Frame = { x: number; y: number; w: number; h: number };
type ImgView = { s: number; ox: number; oy: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function PhotoCropHost() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<{ uri: string; crop: PhotoCrop } | null>(null);
  const resolver = useRef<((c: PhotoCrop | null) => void) | null>(null);

  useEffect(() => {
    registerPhotoCrop(
      (uri) =>
        new Promise<PhotoCrop | null>((resolve) => {
          resolver.current = resolve;
          setState({ uri, crop: { ...DEFAULT_CROP } });
        }),
    );
    return () => registerPhotoCrop(null);
  }, []);

  const close = useCallback((result: PhotoCrop | null) => {
    setState(null);
    const resolve = resolver.current;
    resolver.current = null;
    if (resolve) resolve(result);
  }, []);

  /* ── Größen ─────────────────────────────────────────────────────────────── */
  const stageW = Math.max(200, Math.round(width - 68));
  const stageH = Math.round(stageW * 1.02);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<Frame>({ x: 0, y: 0, w: 0, h: 0 });
  const [view, setView] = useState<ImgView>({ s: 1, ox: 0, oy: 0 });

  /** Kleinstes erlaubtes Maß: das ganze Bild passt genau in die Bühne. */
  const imgPxW = imgSize?.w ?? 0;
  const imgPxH = imgSize?.h ?? 0;
  const minScale = useCallback(
    () => (imgPxW && imgPxH ? Math.min(stageW / imgPxW, stageH / imgPxH) : 1),
    [imgPxW, imgPxH, stageW, stageH],
  );

  /** Startwerte: ganzes Bild sichtbar, Rahmen mittig und groß. */
  const resetView = useCallback(() => {
    if (!imgPxW || !imgPxH) return;
    const s = Math.min(stageW / imgPxW, stageH / imgPxH);
    const rectW = imgPxW * s;
    const rectH = imgPxH * s;
    const rectX = (stageW - rectW) / 2;
    const rectY = (stageH - rectH) / 2;
    let w = rectW * 0.8;
    let h = w / FRAME_ASPECT;
    if (h > rectH * 0.8) {
      h = rectH * 0.8;
      w = h * FRAME_ASPECT;
    }
    setFrame({ w, h, x: rectX + (rectW - w) / 2, y: rectY + (rectH - h) / 2 });
    setView({ s, ox: rectX, oy: rectY });
  }, [imgPxW, imgPxH, stageW, stageH]);

  /* Bildgröße holen (API + das geladene Bild als Reserve). */
  useEffect(() => {
    if (!state?.uri) {
      setImgSize(null);
      return;
    }
    let alive = true;
    try {
      Image.getSize(
        state.uri,
        (w, h) => {
          if (alive && w > 0 && h > 0) setImgSize({ w, h });
        },
        () => undefined,
      );
    } catch {
      /* onLoad unten übernimmt */
    }
    return () => {
      alive = false;
    };
  }, [state?.uri]);

  useEffect(() => {
    resetView();
  }, [resetView, state?.uri]);

  /* ── Gesten: 1 Finger = Rahmen schieben, 2 Finger = zoomen ───────────────── */
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const viewRef = useRef(view);
  viewRef.current = view;
  const imgRef = useRef(imgSize);
  imgRef.current = imgSize;
  /** Position der Bühne auf dem Bildschirm (um Finger-Punkte umzurechnen). */
  const originRef = useRef({ x: 0, y: 0 });
  const stageBoxRef = useRef<ComponentRef<typeof View> | null>(null);
  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    void w;
    void h;
    try {
      stageBoxRef.current?.measureInWindow?.((x: number, y: number) => {
        originRef.current = { x, y };
      });
    } catch {
      /* Notnagel: dann wird eben ohne Ursprung gerechnet */
    }
  };

  const gesture = useRef({
    mode: 'none' as 'none' | 'frame' | 'pinch',
    dx0: 0,
    dy0: 0,
    frameX: 0,
    frameY: 0,
    dist0: 1,
    mid0: { x: 0, y: 0 },
    view0: { s: 1, ox: 0, oy: 0 } as ImgView,
  });

  /** Bildgrenzen in Bühnen-Koordinaten (damit der Rahmen im Bild bleibt). */
  const imageBounds = () => {
    const img = imgRef.current;
    const v = viewRef.current;
    const iw = img?.w ?? 0;
    const ih = img?.h ?? 0;
    return { left: v.ox, top: v.oy, right: v.ox + iw * v.s, bottom: v.oy + ih * v.s };
  };

  const beginGesture = useCallback(
    (touches: { pageX: number; pageY: number }[], dx: number, dy: number) => {
      const g = gesture.current;
      if (touches.length >= 2) {
        const [a, b] = touches;
        g.mode = 'pinch';
        g.dist0 = Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
        g.mid0 = { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
        g.view0 = { ...viewRef.current };
        return;
      }
      g.mode = 'frame';
      g.dx0 = dx;
      g.dy0 = dy;
      g.frameX = frameRef.current.x;
      g.frameY = frameRef.current.y;
    },
    [],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, g) => {
        beginGesture(e.nativeEvent.touches as any, g.dx, g.dy);
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches as any as { pageX: number; pageY: number }[];
        const mode = gesture.current.mode;
        const wantPinch = touches.length >= 2;
        // Finger dazu oder weg: Basis neu setzen, damit nichts springt.
        if ((wantPinch && mode !== 'pinch') || (!wantPinch && mode === 'pinch')) {
          beginGesture(touches, g.dx, g.dy);
          return;
        }

        if (wantPinch) {
          const [a, b] = touches;
          const origin = originRef.current;
          const dist = Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
          const mid = { x: (a.pageX + b.pageX) / 2 - origin.x, y: (a.pageY + b.pageY) / 2 - origin.y };
          const base = gesture.current.view0;
          const low = minScale();
          const next = clamp((base.s * dist) / gesture.current.dist0, low, low * MAX_PINCH);
          // Die Bildstelle unter der Finger-Mitte bleibt stehen.
          const px = (gesture.current.mid0.x - origin.x - base.ox) / base.s;
          const py = (gesture.current.mid0.y - origin.y - base.oy) / base.s;
          const nextView = { s: next, ox: mid.x - px * next, oy: mid.y - py * next };
          viewRef.current = nextView;
          setView(nextView);
          return;
        }

        // Ein Finger: Rahmen innerhalb des Bildes verschieben.
        const f = frameRef.current;
        const bounds = imageBounds();
        const x = clamp(gesture.current.frameX + (g.dx - gesture.current.dx0), bounds.left, Math.max(bounds.left, bounds.right - f.w));
        const y = clamp(gesture.current.frameY + (g.dy - gesture.current.dy0), bounds.top, Math.max(bounds.top, bounds.bottom - f.h));
        const next = { ...f, x, y };
        frameRef.current = next;
        setFrame(next);
      },
      onPanResponderRelease: () => {
        gesture.current.mode = 'none';
      },
      onPanResponderTerminate: () => {
        gesture.current.mode = 'none';
      },
    }),
  ).current;

  /* Zoom-Knöpfe (für alle, die nicht kneifen wollen) - zoomen um die Rahmenmitte. */
  const zoomBy = (factor: number) => {
    const low = minScale();
    const v = viewRef.current;
    const s = clamp(v.s * factor, low, low * MAX_PINCH);
    const real = s / v.s;
    const cx = frame.x + frame.w / 2;
    const cy = frame.y + frame.h / 2;
    const nextView = { s, ox: cx - (cx - v.ox) * real, oy: cy - (cy - v.oy) * real };
    viewRef.current = nextView;
    setView(nextView);
  };

  /* ── Rahmen -> gespeicherter Ausschnitt ──────────────────────────────────── */
  const toCrop = (): PhotoCrop => {
    const img = imgSize;
    if (!img?.w || !img?.h || !frame.w || !view.s) return { ...DEFAULT_CROP };
    return cropFromFrame({ frame, view, imageW: img.w, imageH: img.h });
  };

  const onImgLoad = (e: any) => {
    const src = e?.nativeEvent?.source;
    if (src?.width && src?.height) setImgSize({ w: src.width, h: src.height });
  };

  const crop = toCrop();
  const part = 1 / Math.max(1, crop.zoom);
  const marker = {
    x: clamp(crop.fx - part / 2, 0, Math.max(0, 1 - part)),
    y: clamp(crop.fy - part / 2, 0, Math.max(0, 1 - part)),
    w: part,
    h: part,
  };
  const miniW = 92;
  const miniH = Math.round(miniW / FRAME_ASPECT);
  const pill = {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surfaceMuted,
  };
  const imgW = (imgSize?.w ?? 0) * view.s;
  const imgH = (imgSize?.h ?? 0) * view.s;

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.7), alignItems: 'center', justifyContent: 'center', padding: 14 }}>
        <View style={{ width: '100%', maxWidth: 470, borderRadius: 22, backgroundColor: colors.card, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
              {t('s.cropTitle')}
            </Text>
            <Pressable onPress={() => close(null)} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('s.cropHint')}</Text>

          {/* Bühne: das GANZE Bild, darüber der bewegliche Rahmen */}
          <View
            ref={stageBoxRef}
            {...pan.panHandlers}
            onLayout={onStageLayout}
            style={{
              alignSelf: 'center',
              marginTop: 12,
              width: stageW,
              height: stageH,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: '#0A0A0C',
            }}
          >
            {state && imgW > 0 ? (
              <Image
                source={{ uri: state.uri }}
                resizeMode="stretch"
                onLoad={onImgLoad}
                style={{ position: 'absolute', left: view.ox, top: view.oy, width: imgW, height: imgH }}
              />
            ) : state ? (
              <Image
                source={{ uri: state.uri }}
                resizeMode="contain"
                onLoad={onImgLoad}
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
              />
            ) : null}

            {/* Dunkle Bereiche außerhalb des Rahmens */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, frame.y), backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: frame.y + frame.h, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: frame.y, width: Math.max(0, frame.x), height: frame.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: frame.x + frame.w, right: 0, top: frame.y, height: frame.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />

            {/* Rahmen + Raster + Griff */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: frame.x,
                top: frame.y,
                width: frame.w,
                height: frame.h,
                borderWidth: 2,
                borderColor: colors.accent,
                borderRadius: 10,
              }}
            >
              <View style={{ position: 'absolute', left: frame.w / 3, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View style={{ position: 'absolute', left: (2 * frame.w) / 3, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View style={{ position: 'absolute', top: frame.h / 3, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View style={{ position: 'absolute', top: (2 * frame.h) / 3, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View
                style={{
                  position: 'absolute',
                  left: frame.w / 2 - 16,
                  top: frame.h / 2 - 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Move size={16} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            {t('s.cropPinch')}
          </Text>

          {/* Zoom-Steuerung */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => zoomBy(1 / 1.25)}
              accessibilityRole="button"
              style={({ pressed }) => [{ ...pill, width: 40, height: 38, borderRadius: 12, opacity: pressed ? 0.7 : 1 }]}
            >
              <Minus size={16} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ minWidth: 54, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
              {(view.s / Math.max(0.0001, minScale())).toFixed(2)}x
            </Text>
            <Pressable
              onPress={() => zoomBy(1.25)}
              accessibilityRole="button"
              style={({ pressed }) => [{ ...pill, width: 40, height: 38, borderRadius: 12, opacity: pressed ? 0.7 : 1 }]}
            >
              <Plus size={16} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={resetView}
              accessibilityRole="button"
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <RotateCcw size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropReset')}</Text>
            </Pressable>
          </View>

          {/* Kontrolle: dasselbe Bild klein, mit der Markierung wie später */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <View style={{ width: miniW, height: miniH, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
              {state ? <Image source={{ uri: state.uri }} resizeMode="stretch" style={{ width: miniW, height: miniH, opacity: 0.5 }} /> : null}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: marker.x * miniW,
                  top: marker.y * miniH,
                  width: Math.max(8, marker.w * miniW),
                  height: Math.max(8, marker.h * miniH),
                  borderWidth: 2,
                  borderColor: colors.accent,
                  borderRadius: 6,
                }}
              />
            </View>
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>{t('s.cropMoveHint')}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={() => close(null)}
              accessibilityRole="button"
              style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropCancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => close(toCrop())}
              accessibilityRole="button"
              style={({ pressed }) => [
                { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, paddingVertical: 12, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Check size={17} color={colors.darkButtonText} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.darkButtonText }}>{t('s.cropApply')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default PhotoCropHost;



