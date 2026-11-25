import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Check, Crop, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react-native';

import { colors, fonts, rgbaHelper } from '../theme';
import { useTranslation } from '../lib/i18n';
import { clampCrop, getCrop, registerPhotoCrop, type PhotoCrop } from '../lib/photo-crop';

const FRAME_ASPECT = 4 / 3;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type TouchPoint = { pageX?: number; pageY?: number; clientX?: number; clientY?: number };

const touchX = (touch: TouchPoint) => touch.pageX ?? touch.clientX ?? 0;
const touchY = (touch: TouchPoint) => touch.pageY ?? touch.clientY ?? 0;
const touchDistance = (a: TouchPoint, b: TouchPoint) =>
  Math.hypot(touchX(a) - touchX(b), touchY(a) - touchY(b));

function focalRange(stageW: number, stageH: number, imgW: number, imgH: number, zoom: number) {
  const scale = Math.max(stageW / imgW, stageH / imgH) * zoom;
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const minX = Math.min(0.5, stageW / (2 * drawW));
  const minY = Math.min(0.5, stageH / (2 * drawH));
  return { minX, maxX: 1 - minX, minY, maxY: 1 - minY };
}

export function PhotoCropHost() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<{ uri: string } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [fx, setFx] = useState(0.5);
  const [fy, setFy] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [whole, setWhole] = useState(false);
  const resolver = useRef<((crop: PhotoCrop | null) => void) | null>(null);

  const stageW = Math.max(190, Math.round(Math.min(width - 48, 430, height * 0.5 * FRAME_ASPECT)));
  const stageH = Math.round(stageW / FRAME_ASPECT);

  const stageRef = useRef({ w: stageW, h: stageH });
  stageRef.current = { w: stageW, h: stageH };
  const imgRef = useRef(imgSize);
  imgRef.current = imgSize;
  const live = useRef({ fx, fy, zoom });
  live.current = { fx, fy, zoom };
  const wholeRef = useRef(whole);
  wholeRef.current = whole;

  useEffect(() => {
    registerPhotoCrop(
      (uri) =>
        new Promise<PhotoCrop | null>((resolve) => {
          resolver.current = resolve;
          setImgSize(null);
          setFx(0.5);
          setFy(0.5);
          setZoom(1);
          setWhole(false);
          setState({ uri });
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

  useEffect(() => {
    if (!state?.uri) return;
    let alive = true;
    try {
      Image.getSize(
        state.uri,
        (w, h) => {
          if (alive && w > 0 && h > 0) setImgSize({ w, h });
        },
        () => undefined,
      );
    } catch {}
    void getCrop(state.uri).then((stored) => {
      if (!alive || !stored) return;
      if (stored.whole) {
        setWhole(true);
        return;
      }
      setWhole(false);
      setFx(clamp(stored.fx, 0, 1));
      setFy(clamp(stored.fy, 0, 1));
      setZoom(clamp(stored.zoom, 1, MAX_ZOOM));
    });
    return () => {
      alive = false;
    };
  }, [state?.uri]);

  const applyZoom = useRef<(next: number) => void>(() => undefined);
  applyZoom.current = (next: number) => {
    const img = imgRef.current;
    if (!img) return;
    const stage = stageRef.current;
    const value = clamp(next, 1, MAX_ZOOM);
    const range = focalRange(stage.w, stage.h, img.w, img.h, value);
    setZoom(value);
    setFx((current) => clamp(current, range.minX, range.maxX));
    setFy((current) => clamp(current, range.minY, range.maxY));
  };

  const gesture = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    fx: 0.5,
    fy: 0.5,
    zoom: 1,
    dx: 0,
    dy: 0,
    distance: 1,
  });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !wholeRef.current,
      onMoveShouldSetPanResponder: () => !wholeRef.current,
      onPanResponderGrant: (event, stateGesture) => {
        if (wholeRef.current) return;
        const touches = Array.isArray(event.nativeEvent.touches) ? event.nativeEvent.touches : [];
        if (touches.length >= 2) {
          gesture.current.mode = 'pinch';
          gesture.current.distance = Math.max(1, touchDistance(touches[0], touches[1]));
          gesture.current.zoom = live.current.zoom;
          return;
        }
        gesture.current.mode = 'pan';
        gesture.current.fx = live.current.fx;
        gesture.current.fy = live.current.fy;
        gesture.current.dx = stateGesture.dx;
        gesture.current.dy = stateGesture.dy;
      },
      onPanResponderMove: (event, stateGesture) => {
        if (wholeRef.current) return;
        const img = imgRef.current;
        const stage = stageRef.current;
        if (!img) return;
        const touches = Array.isArray(event.nativeEvent.touches) ? event.nativeEvent.touches : [];

        if (touches.length >= 2) {
          if (gesture.current.mode !== 'pinch') {
            gesture.current.mode = 'pinch';
            gesture.current.distance = Math.max(1, touchDistance(touches[0], touches[1]));
            gesture.current.zoom = live.current.zoom;
            return;
          }
          const distance = Math.max(1, touchDistance(touches[0], touches[1]));
          applyZoom.current(gesture.current.zoom * (distance / gesture.current.distance));
          return;
        }

        if (gesture.current.mode !== 'pan') return;
        const scale = Math.max(stage.w / img.w, stage.h / img.h) * gesture.current.zoom;
        const drawW = img.w * scale;
        const drawH = img.h * scale;
        const range = focalRange(stage.w, stage.h, img.w, img.h, gesture.current.zoom);
        const nextFx = gesture.current.fx - (stateGesture.dx - gesture.current.dx) / drawW;
        const nextFy = gesture.current.fy - (stateGesture.dy - gesture.current.dy) / drawH;
        setFx(clamp(nextFx, range.minX, range.maxX));
        setFy(clamp(nextFy, range.minY, range.maxY));
      },
      onPanResponderRelease: () => {
        gesture.current.mode = 'none';
      },
      onPanResponderTerminate: () => {
        gesture.current.mode = 'none';
      },
    }),
  ).current;

  const onImageLoad = (event: any) => {
    const source = event?.nativeEvent?.source;
    if (source?.width > 0 && source?.height > 0) {
      setImgSize((current) =>
        current && current.w === source.width && current.h === source.height
          ? current
          : { w: source.width, h: source.height },
      );
    }
  };

  const cover = imgSize ? Math.max(stageW / imgSize.w, stageH / imgSize.h) : 1;
  const scale = cover * zoom;
  const drawW = (imgSize?.w ?? 0) * scale;
  const drawH = (imgSize?.h ?? 0) * scale;
  const left = stageW / 2 - fx * drawW;
  const top = stageH / 2 - fy * drawH;

  const apply = () => {
    if (whole || !imgSize) {
      close({ ...clampCrop({ fx: 0.5, fy: 0.5, zoom: 1 }), whole: true });
      return;
    }
    close(clampCrop({ fx, fy, zoom, iw: imgSize.w, ih: imgSize.h }));
  };

  const chip = (active: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.cardBorder,
    backgroundColor: active ? colors.accentSoft : colors.surfaceMuted,
    paddingVertical: 9,
  });

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View
        style={{
          flex: 1,
          backgroundColor: rgbaHelper('#000000', 0.78),
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <View style={{ width: '100%', maxWidth: 470, borderRadius: 22, backgroundColor: colors.card, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
              {t('s.cropTitle')}
            </Text>
            <Pressable onPress={() => close(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('s.cropCancel')}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            {whole ? t('s.cropWhole') : t('s.cropHint')}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => setWhole(false)}
              accessibilityRole="button"
              accessibilityLabel={t('s.cropPart')}
              style={chip(!whole)}
            >
              <Crop size={14} color={!whole ? colors.accent : colors.textSecondary} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: !whole ? colors.accent : colors.textSecondary }}>
                {t('s.cropPart')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setWhole(true)}
              accessibilityRole="button"
              accessibilityLabel={t('s.cropWhole')}
              style={chip(whole)}
            >
              <Maximize2 size={14} color={whole ? colors.accent : colors.textSecondary} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: whole ? colors.accent : colors.textSecondary }}>
                {t('s.cropWhole')}
              </Text>
            </Pressable>
          </View>

          <View
            {...pan.panHandlers}
            style={{
              alignSelf: 'center',
              marginTop: 10,
              width: stageW,
              height: stageH,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: '#0A0A0C',
            }}
          >
            {state ? (
              whole ? (
                <Image
                  source={{ uri: state.uri }}
                  resizeMode="contain"
                  onLoad={onImageLoad}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : imgSize && drawW > 0 ? (
                <Image
                  source={{ uri: state.uri }}
                  resizeMode="stretch"
                  onLoad={onImageLoad}
                  style={{ position: 'absolute', left, top, width: drawW, height: drawH }}
                />
              ) : (
                <Image
                  source={{ uri: state.uri }}
                  resizeMode="contain"
                  onLoad={onImageLoad}
                  style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
                />
              )
            ) : null}

            {!whole ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  borderRadius: 14,
                }}
              >
                <View style={{ position: 'absolute', left: stageW / 3, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
                <View style={{ position: 'absolute', left: (2 * stageW) / 3, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
                <View style={{ position: 'absolute', top: stageH / 3, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
                <View style={{ position: 'absolute', top: (2 * stageH) / 3, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
              </View>
            ) : null}
          </View>

          {!whole ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => applyZoom.current(zoom / 1.25)}
                accessibilityRole="button"
                accessibilityLabel="zoom out"
                style={({ pressed }) => [
                  { alignItems: 'center', justifyContent: 'center', width: 40, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Minus size={16} color={colors.textPrimary} />
              </Pressable>
              <Text style={{ minWidth: 54, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
                {zoom.toFixed(2)}x
              </Text>
              <Pressable
                onPress={() => applyZoom.current(zoom * 1.25)}
                accessibilityRole="button"
                accessibilityLabel="zoom in"
                style={({ pressed }) => [
                  { alignItems: 'center', justifyContent: 'center', width: 40, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Plus size={16} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setFx(0.5);
                  setFy(0.5);
                  applyZoom.current(1);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('s.cropReset')}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <RotateCcw size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropReset')}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={() => close(null)}
              accessibilityRole="button"
              style={({ pressed }) => [
                { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropCancel')}</Text>
            </Pressable>
            <Pressable
              onPress={apply}
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
