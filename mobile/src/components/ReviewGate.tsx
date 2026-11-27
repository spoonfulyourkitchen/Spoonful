import { tr2 } from '../lib/hardcoded-l10n';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { api } from '../lib/api';
import { convexClient } from '../lib/convex-auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts } from '../theme';
import { completeReview, hydrateReview, useReview } from '../lib/review';

export function ReviewGate() {
  const { t, lang } = useTranslation();
  const review = useReview();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    void hydrateReview();
  }, []);

  useEffect(() => {
    if (!review.complete || review.dismissed) return;
    setCanClose(false);
    const timer = setTimeout(() => setCanClose(true), 12000);
    return () => clearTimeout(timer);
  }, [review.complete, review.dismissed]);

  if (!review.complete || review.dismissed) return null;

  const close = () => completeReview();

  const send = async () => {
    if (busy || stars < 1) return;
    setBusy(true);
    try {
      await convexClient.mutation(api.feedback.submit as any, { rating: stars, text: text.trim() });
    } catch {}
    setBusy(false);
    close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (canClose) close(); }}>
      <View style={{ flex: 1, backgroundColor: colors.overlayStrong, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 26, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 22 }}>
          {canClose ? (
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}

          <Text style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 }}>
            {tr2('Wie gefällt dir Spoonful?', 'How do you like Spoonful?', lang)}
          </Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 6 }}>
            {tr2('Sag uns kurz, wie es läuft.', 'Tell us how it is going.', lang)}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setStars(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} / 5`}
                accessibilityState={{ selected: stars === n }}
                style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}
              >
                <Star
                  size={32}
                  color={stars >= n ? colors.accentInk : colors.cardBorder}
                  fill={stars >= n ? colors.accent : 'transparent'}
                  strokeWidth={1.6}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tr2('Was würdest du ändern?', 'What would you change?', lang)}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={400}
            style={{
              minHeight: 74, marginTop: 14, borderRadius: 14, borderWidth: 1,
              borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary, padding: 12, fontSize: 14,
              textAlignVertical: 'top',
            }}
          />

          <Pressable
            onPress={() => void send()}
            disabled={busy || stars < 1}
            accessibilityRole="button"
            style={({ pressed }) => [{
              marginTop: 14, borderRadius: 999, paddingVertical: 13, alignItems: 'center',
              backgroundColor: colors.darkButton, opacity: busy || stars < 1 ? 0.4 : pressed ? 0.85 : 1,
            }]}
          >
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 15 }}>
              {tr2('Senden', 'Send', lang)}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default ReviewGate;
