

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { colors, fonts, rgbaHelper } from '../theme';
import { useTranslation } from '../lib/i18n';
import { loadExtras } from '../lib/cooking-extras';
import { CroppedImage } from './CroppedImage';

export type StepPhoto = { step: number; uri: string };

export function useStepPhotos(recipeKey: string, userId?: string | null): { ready: boolean; photos: StepPhoto[] } {
  const [ready, setReady] = useState(false);
  const [photos, setPhotos] = useState<StepPhoto[]>([]);

  useEffect(() => {
    let alive = true;
    if (!recipeKey) {
      setPhotos([]);
      setReady(true);
      return () => {
        alive = false;
      };
    }
    loadExtras(userId ?? undefined, recipeKey)
      .then((data) => {
        if (!alive) return;
        const list = Object.keys(data.photos ?? {})
          .map((k) => ({ step: Number(k) + 1, uri: data.photos[k] }))
          .filter((p) => Number.isFinite(p.step) && !!p.uri)
          .sort((a, b) => a.step - b.step);
        setPhotos(list);
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setPhotos([]);
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [recipeKey, userId]);

  return { ready, photos };
}

export function StepPhotoStrip({
  photos,
  onOpen,
  label,
  style,
}: {
  photos: StepPhoto[];
  onOpen: (startIndex: number) => void;
  label: string;
  style?: object;
}) {
  if (!photos.length) return null;
  return (
    <Pressable onPress={() => onOpen(0)} style={[{ marginTop: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 12 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Camera size={14} color={colors.accentInk} />
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{label} ({photos.length})</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        {photos.map((p, i) => (
          <Pressable key={`${p.step}-${i}`} onPress={() => onOpen(i)}>
            <CroppedImage uri={p.uri} style={{ width: 92, height: 92, borderRadius: 12 }} />
            <Text style={{ fontSize: 10.5, color: colors.textSecondary, marginTop: 3 }}>{`${p.step}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Pressable>
  );
}

export function StepPhotoSlideshow({
  visible,
  photos,
  steps,
  title,
  startIndex = 0,
  onClose,
}: {
  visible: boolean;
  photos: StepPhoto[];
  steps: string[];
  title?: string;
  startIndex?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setIndex(Math.max(0, Math.min(Math.max(0, photos.length - 1), startIndex)));
  }, [visible, startIndex, photos.length]);

  const next = useCallback(() => setIndex((i) => Math.min(photos.length - 1, i + 1)), [photos.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const handlers = useRef({ next, prev });
  handlers.current = { next, prev };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -20) handlers.current.next();
        else if (g.dx > 20) handlers.current.prev();
      },
    }),
  ).current;

  const current = photos[index];
  const stepText = current ? steps[current.step - 1] ?? '' : '';
  const label = useMemo(() => (current ? t('s.slideOfStep', { n: current.step }) : ''), [current, t]);

  if (!visible || !current) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.92) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 42, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: '#fff' }}>{title ?? ''}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {label} · {t('s.slideOf', { n: index + 1, m: photos.length })}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        <View {...pan.panHandlers} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
          <CroppedImage uri={current.uri} style={{ width: '100%', height: '68%', borderRadius: 18 }} />
          {stepText ? (
            <Text numberOfLines={3} style={{ marginTop: 14, fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
              {stepText}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 26 }}>
          <Pressable onPress={prev} disabled={index === 0} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', opacity: index === 0 ? 0.4 : 1 }}>
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{`${index + 1}/${photos.length}`}</Text>
          <Pressable onPress={next} disabled={index >= photos.length - 1} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', opacity: index >= photos.length - 1 ? 0.4 : 1 }}>
            <ChevronRight size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default StepPhotoSlideshow;
