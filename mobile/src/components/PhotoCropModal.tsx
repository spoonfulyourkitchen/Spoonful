/**
 * 3.1.0: Popup zum Festlegen des Bild-Ausschnitts.
 *
 * Erscheint Ã¼berall, wo ein Foto hinzugefÃ¼gt wird: Foto wÃ¤hlen, dann im Popup
 * ziehen (welche Stelle sichtbar ist) und zoomen. `<PhotoCropHost />` wird
 * einmal in App.tsx gemountet; die Aufrufer nutzen `openPhotoCrop(uri)`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Check, Minus, Plus, RotateCcw, X } from 'lucide-react-native';

import { colors, fonts, rgbaHelper } from '../theme';
import { useTranslation } from '../lib/i18n';
import { clampCrop, DEFAULT_CROP, registerPhotoCrop, type PhotoCrop } from '../lib/photo-crop';

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

  /* Gesten: ziehen verschiebt den sichtbaren Ausschnitt (fx/fy). */
  const stateRef = useRef(state);
  stateRef.current = state;
  const frameRef = useRef({ w: 300, h: 190 });
  const base = useRef<PhotoCrop>({ ...DEFAULT_CROP });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        base.current = { ...(stateRef.current?.crop ?? DEFAULT_CROP) };
      },
      onPanResponderMove: (_e, g) => {
        const b = base.current;
        const { w, h } = frameRef.current;
        const next = clampCrop({
          zoom: b.zoom,
          fx: b.fx - g.dx / Math.max(1, w * b.zoom),
          fy: b.fy - g.dy / Math.max(1, h * b.zoom),
        });
        setState((cur) => (cur ? { ...cur, crop: next } : cur));
      },
    }),
  ).current;

  const zoomBy = (delta: number) =>
    setState((cur) => (cur ? { ...cur, crop: clampCrop({ ...cur.crop, zoom: cur.crop.zoom + delta }) } : cur));
  const reset = () => setState((cur) => (cur ? { ...cur, crop: { ...DEFAULT_CROP } } : cur));

  const frameW = Math.max(220, width - 40);
  const frameH = Math.round(frameW * 0.62);
  frameRef.current = { w: frameW, h: frameH };

  const crop = state?.crop ?? DEFAULT_CROP;
  const pill = { alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surfaceMuted };

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.6), alignItems: 'center', justifyContent: 'center', padding: 18 }}>

        <View style={{ width: '100%', maxWidth: 460, borderRadius: 22, backgroundColor: colors.card, padding: 16 }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
              {t('s.cropTitle')}
            </Text>
            <Pressable onPress={() => close(null)} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('s.cropHint')}</Text>

          {/* Vorschau: Ziehen verschiebt den sichtbaren Ausschnitt */}
          <View {...pan.panHandlers} style={{ marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
            <View style={{ width: frameW, height: frameH, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {state ? (
                <Image
                  source={{ uri: state.uri }}
                  resizeMode="cover"
                  style={{
                    width: frameW * crop.zoom,
                    height: frameH * crop.zoom,
                    transform: [
                      { translateX: (0.5 - crop.fx) * frameW * crop.zoom },
                      { translateY: (0.5 - crop.fy) * frameH * crop.zoom },
                    ],
                  }}
                />
              ) : null}
            </View>
          </View>

          {/* Zoom-Steuerung */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Pressable onPress={() => zoomBy(-0.25)} style={({ pressed }) => [{ ...pill, width: 40, height: 38, borderRadius: 12, opacity: pressed ? 0.7 : 1 }]}>
              <Minus size={16} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ minWidth: 54, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
              {crop.zoom.toFixed(2)}Ã—
            </Text>
            <Pressable onPress={() => zoomBy(0.25)} style={({ pressed }) => [{ ...pill, width: 40, height: 38, borderRadius: 12, opacity: pressed ? 0.7 : 1 }]}>
              <Plus size={16} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={reset} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
              <RotateCcw size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropReset')}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable onPress={() => close(null)} style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingVertical: 12, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{t('s.cropCancel')}</Text>
            </Pressable>
            <Pressable onPress={() => close(crop)} style={({ pressed }) => [{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, paddingVertical: 12, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
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
