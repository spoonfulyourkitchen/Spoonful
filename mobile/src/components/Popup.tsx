import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * 2.1.1: one popup for the whole app.
 *
 * Everything that used to unfold further down the page (goal suggestion,
 * product lookups, list extras, confirmations) opens in this centred card
 * instead - the user never has to scroll to find what just happened.
 */
export type PopupAction = {
  label: string;
  onPress: () => void;
  /** primary = filled, ghost = quiet, danger = destructive. */
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Popup({
  visible,
  title,
  body,
  icon,
  actions,
  onClose,
  closeLabel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  icon?: React.ReactNode;
  actions: PopupAction[];
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: colors.overlayStrong }}>
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          accessible
          accessibilityLabel={body ? `${title}. ${body}` : title}
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.card,
            padding: 20,
            shadowColor: colors.shadowStrong,
            shadowOpacity: 0.22,
            shadowRadius: 26,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
          }}
        >
          {icon ? (
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, marginBottom: 12 }}>
              {icon}
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{title}</Text>
          {body ? <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 6 }}>{body}</Text> : null}

          <View style={{ gap: 8, marginTop: 16 }}>
            {actions.map((a) => {
              const variant = a.variant ?? 'primary';
              const bg =
                variant === 'primary' ? colors.darkButton : variant === 'danger' ? colors.roseBg : colors.surfaceMuted;
              const fg = variant === 'primary' ? colors.darkButtonText : variant === 'danger' ? colors.rose : colors.textPrimary;
              return (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => [
                    { borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: fg, fontWeight: '800', fontSize: 14.5 }}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default Popup;
