import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { colors, fonts, rgbaHelper } from '../theme';

export type NoticeAction = { label: string; onPress?: () => void; variant?: 'accent' | 'dark' | 'ghost' | 'danger' };
export type Notice = {
  title: string;
  body?: string;
  actions?: NoticeAction[];
  tone?: 'info' | 'success' | 'error';
};

let current: Notice | null = null;
const listeners = new Set<(n: Notice | null) => void>();

function emit() {
  listeners.forEach((fn) => fn(current));
}

export function showNotice(notice: Notice): void {
  current = notice;
  emit();
}

export function dismissNotice(): void {
  current = null;
  emit();
}

function useNotice(): Notice | null {
  const [notice, setNotice] = useState<Notice | null>(current);
  useEffect(() => {
    listeners.add(setNotice);
    setNotice(current);
    return () => {
      listeners.delete(setNotice);
    };
  }, []);
  return notice;
}

const AUTO_HIDE_MS = 3200;

export function AppNoticeHost() {
  const notice = useNotice();
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => drag.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -36) {
          Animated.timing(enter, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => dismissNotice());
        } else {
          Animated.spring(drag, { toValue: 0, damping: 16, stiffness: 220, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (!notice) return;
    drag.setValue(0);
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, damping: 16, stiffness: 200, mass: 0.8, useNativeDriver: true }).start();
    const hasActions = !!notice.actions?.length;
    if (hasActions || notice.tone === 'error') return;
    const timer = setTimeout(() => dismissNotice(), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [notice, enter, drag]);

  if (!notice) return null;

  const tone = notice.tone ?? 'info';
  const accent = tone === 'success' ? colors.success : tone === 'error' ? colors.rose : colors.accent;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Info;
  const actions = notice.actions ?? [];
  const translateY = Animated.add(
    enter.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }),
    drag,
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: insets.top + 8,
        zIndex: 1000,
        transform: [{ translateY }],
        opacity: enter,
      }}
    >
      <View
        {...pan.panHandlers}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: rgbaHelper(accent, 0.28),
          backgroundColor: colors.card,
          paddingLeft: 12,
          paddingRight: 10,
          paddingVertical: 11,
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rgbaHelper(accent, 0.14),
            marginTop: 1,
          }}
        >
          <Icon size={15} color={accent} strokeWidth={2.4} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 14.5, fontWeight: '800', color: colors.textPrimary }} numberOfLines={2}>
            {notice.title}
          </Text>
          {notice.body ? (
            <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }} numberOfLines={3}>
              {notice.body}
            </Text>
          ) : null}
          {actions.length ? (
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
              {actions.map((action, i) => (
                <Pressable
                  key={`${action.label}-${i}`}
                  onPress={() => {
                    dismissNotice();
                    action.onPress?.();
                  }}
                  hitSlop={6}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: action.variant === 'danger' ? colors.rose : action.variant === 'ghost' ? colors.textSecondary : accent,
                    }}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Pressable onPress={dismissNotice} hitSlop={10} accessibilityRole="button" style={{ padding: 2 }}>
          <X size={15} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
