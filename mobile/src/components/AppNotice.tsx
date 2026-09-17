/**
 * 3.3.0: Eigene, gestaltete Meldungen statt der System-Dialoge.
 *
 * Vorher kamen viele Hinweise über `Alert.alert(...)` — die sehen auf jedem
 * Handy anders aus („zackig"), übernehmen keine Theme-Farben und lassen sich
 * nicht übersetzen. Diese Komponente zeigt dieselben Informationen als
 * themefarbene Karte in der App:
 *
 *   showNotice({ title, body, actions: [{ label, onPress }] })
 *
 * Genutzt wird ausschließlich das Theme (`colors.*`), es gibt also keine
 * festen Farben und keine festen Texte im Design.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { AppButton } from './ui';

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

/** Eine gestaltete Meldung anzeigen. */
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

/** Einmal im App-Root einhängen. */
export function AppNoticeHost() {
  const notice = useNotice();
  if (!notice) return null;
  const tone = notice.tone ?? 'info';
  const accent = tone === 'success' ? colors.success : tone === 'error' ? colors.rose : colors.accent;
  const toneBg = tone === 'success' ? colors.successBg : tone === 'error' ? colors.roseBg : colors.accentSoft;
  const actions: NoticeAction[] = notice.actions?.length ? notice.actions : [{ label: 'OK', variant: 'dark' }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissNotice} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.overlayStrong }}>
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.card,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
              {notice.title}
            </Text>
          </View>
          {notice.body ? (
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{notice.body}</Text>
          ) : null}
          <View style={{ marginTop: 16, gap: 8 }}>
            {actions.map((action, i) => (
              <AppButton
                key={`${action.label}-${i}`}
                label={action.label}
                variant={action.variant ?? (i === 0 ? 'dark' : 'ghost')}
                onPress={() => {
                  dismissNotice();
                  action.onPress?.();
                }}
              />
            ))}
          </View>
          <Pressable onPress={dismissNotice} style={{ marginTop: 10, alignItems: 'center' }}>
            <View style={{ height: 4, width: 44, borderRadius: 2, backgroundColor: toneBg }} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
