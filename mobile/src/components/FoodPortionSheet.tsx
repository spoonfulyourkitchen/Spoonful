import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { BARCODE_L10N, pick } from '../lib/l10n';
import { portionGrams, scaleToPortion, type FoodHit, type PortionMode } from '../lib/foodFacts';
import { TutorialTarget } from './TutorialTarget';

/**
 * Portion chooser for products with per-100 g values (2.1.0).
 *
 * After a scan (or a search hit) the user decides how much they actually ate:
 * one portion, 100 g, the whole package or a custom amount in grams. The
 * tracker entry is then written with the scaled kcal/protein/carbs/fat.
 */
export function FoodPortionSheet({
  hit,
  visible,
  onClose,
  onConfirm,
}: {
  hit: FoodHit | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (grams: number, mode: PortionMode) => void;
}) {
  const { lang } = useTranslation();
  const [mode, setMode] = useState<PortionMode>('serving');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCustom('');
    setMode(hit?.servingGrams ? 'serving' : 'hundred');
  }, [visible, hit?.code, hit?.servingGrams]);

  const grams = hit ? portionGrams(hit, mode, Number(custom)) : null;
  const scaled = hit && grams ? scaleToPortion(hit, grams) : null;
  const servingLabel = hit?.servingGrams
    ? `${pick(lang, BARCODE_L10N.oneServing)} · ${hit.servingGrams} g`
    : pick(lang, BARCODE_L10N.oneServing);
  const packageLabel = hit?.packageGrams
    ? `${pick(lang, BARCODE_L10N.wholePackage)} · ${hit.packageGrams} g`
    : pick(lang, BARCODE_L10N.wholePackage);

  const options: { value: PortionMode; label: string; disabled?: boolean }[] = [
    { value: 'serving', label: servingLabel },
    { value: 'hundred', label: pick(lang, BARCODE_L10N.hundredG) },
    { value: 'package', label: packageLabel, disabled: !hit?.packageGrams },
    { value: 'custom', label: pick(lang, BARCODE_L10N.customAmount) },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlayStrong }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.textPrimary }}>
              {pick(lang, BARCODE_L10N.portionTitle)}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={pick(lang, BARCODE_L10N.cancel)}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {hit ? (
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 6 }}>
              {hit.brand ? `${hit.name} (${hit.brand})` : hit.name}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
            {hit?.kcal != null ? `${hit.kcal} kcal / 100 g` : ''}
            {hit?.serving ? ` · ${hit.serving}` : ''}
          </Text>

          <TutorialTarget id="tut-portion" style={{ marginTop: 12 }}>
            <View style={{ gap: 8 }}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => !o.disabled && setMode(o.value)}
                  disabled={!!o.disabled}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1,
                      borderColor: mode === o.value ? colors.accent : colors.cardBorder,
                      backgroundColor: mode === o.value ? colors.accentSoft : colors.card,
                      paddingHorizontal: 14, paddingVertical: 12,
                      opacity: o.disabled ? 0.45 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: mode === o.value ? colors.accent : colors.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                    {mode === o.value ? <Check size={13} color={colors.accent} strokeWidth={3} /> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </TutorialTarget>

          {mode === 'custom' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <TextInput
                value={custom}
                onChangeText={setCustom}
                keyboardType="decimal-pad"
                placeholder="150"
                placeholderTextColor={colors.textSecondary}
                style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 11, color: colors.textPrimary, fontSize: 15 }}
              />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{pick(lang, BARCODE_L10N.grams)}</Text>
            </View>
          ) : null}

          {scaled ? (
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 12 }}>
              {`${grams} g · ${scaled.calories} kcal`}
              {scaled.protein != null ? ` · ${scaled.protein} g P` : ''}
              {scaled.carbs != null ? ` · ${scaled.carbs} g C` : ''}
              {scaled.fat != null ? ` · ${scaled.fat} g F` : ''}
            </Text>
          ) : (
            <Text style={{ fontSize: 12.5, color: colors.rose, marginTop: 12 }}>{pick(lang, BARCODE_L10N.unknownAmount)}</Text>
          )}

          <Pressable
            onPress={() => {
              if (grams) onConfirm(grams, mode);
            }}
            disabled={!grams}
            accessibilityRole="button"
            style={({ pressed }) => [
              { marginTop: 14, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.darkButton, opacity: grams ? (pressed ? 0.85 : 1) : 0.45 },
            ]}
          >
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 15 }}>{pick(lang, BARCODE_L10N.addToTracker)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default FoodPortionSheet;
