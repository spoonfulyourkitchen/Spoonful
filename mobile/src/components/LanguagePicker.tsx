import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Globe, TriangleAlert, X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { LANGUAGES, isRtlLanguage, markLanguagePickerShown, useTranslation, type Language } from '../lib/i18n';

/**
 * 2.1.2: language picker as a popup.
 *
 * Used in two places:
 *  - Settings ("Sprache"), opened by the user,
 *  - automatically on the very first start when the phone language is not one
 *    of the supported ones (soft hint instead of a hard fallback).
 */
export function LanguagePicker({
  visible,
  onClose,
  hintBody,
  onPicked,
}: {
  visible: boolean;
  onClose: () => void;
  /** Extra explanation for the automatic first-start hint. */
  hintBody?: string;
  onPicked?: (lang: Language) => void;
}) {
  const { t, lang, setLang } = useTranslation();

  const choose = (next: Language) => {
    setLang(next);
    markLanguagePickerShown();
    onPicked?.(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.overlayStrong }}>
        <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={{ width: '100%', maxWidth: 420, maxHeight: '86%', borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
              <Globe size={19} color={colors.accent} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              {t('langue.title')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <X size={19} color={colors.textSecondary} />
            </Pressable>
          </View>

          {hintBody ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 12 }}>
              <TriangleAlert size={15} color={colors.accent} />
              <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>{hintBody}</Text>
            </View>
          ) : null}

          <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 6 }}>
              {LANGUAGES.map((l) => {
                const active = l.code === lang;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => choose(l.code)}
                    accessibilityRole="button"
                    accessibilityLabel={l.native}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1,
                        borderColor: active ? colors.accent : colors.cardBorder,
                        backgroundColor: active ? colors.accentSoft : colors.bg,
                        paddingHorizontal: 13, paddingVertical: 12, opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: active ? '800' : '600', color: active ? colors.accent : colors.textPrimary }}>
                        {l.native}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                        {l.name}{isRtlLanguage(l.code) ? ' · RTL' : ''}
                      </Text>
                    </View>
                    {active ? <Check size={16} color={colors.accent} strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [{ marginTop: 12, alignItems: 'center', paddingVertical: 12, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.textSecondary }}>{t('langue.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default LanguagePicker;
