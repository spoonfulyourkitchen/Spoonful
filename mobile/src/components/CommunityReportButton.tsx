import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Flag, Send, X } from 'lucide-react-native';
import { useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { colors } from '../theme';

const REASONS: { id: string; key: string }[] = [
  { id: 'spam', key: 's.commReportSpam' },
  { id: 'offensive', key: 's.commReportOffensive' },
  { id: 'wrong', key: 's.commReportWrong' },
  { id: 'other', key: 's.commReportOther' },
];

export function CommunityReportButton({ shareId }: { shareId: string }) {
  const report = useMutation(api.sharing.report);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) {
      setError(t('s.commReportPickReason'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await report({
        targetType: 'recipe',
        targetId: shareId,
        reason,
        note: message.trim() || undefined,
      } as any);
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setReason(null);
        setMessage('');
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your report could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
        accessibilityLabel={t('s.commReport')}
      >
        <Flag size={13} color={colors.textSecondary} strokeWidth={2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ width: '100%', maxWidth: 420, backgroundColor: colors.bg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Flag size={18} color={colors.rose} strokeWidth={2.2} />
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{t('s.commReportTitle')}</Text>
                </View>
                <Pressable onPress={close} hitSlop={8}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              {sent ? (
                <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={22} color={colors.success} />
                  </View>
                  <Text style={{ marginTop: 10, fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{t('s.commReportSent')}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('s.commReportThanks')}</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>{t('s.commReportHint')}</Text>
                  {REASONS.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setReason(r.id)}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: reason === r.id ? colors.accent : colors.cardBorder, backgroundColor: reason === r.id ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, opacity: pressed ? 0.85 : 1 }]}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: reason === r.id ? colors.accent : colors.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                        {reason === r.id ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{t(r.key)}</Text>
                    </Pressable>
                  ))}
                  {reason === 'other' ? (
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder={t('s.xPhReportWhat')}
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      style={{ minHeight: 70, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, padding: 12, marginTop: 2, marginBottom: 6 }}
                    />
                  ) : null}
                  {error ? <Text style={{ color: colors.rose, fontSize: 13, marginBottom: 8 }}>{error}</Text> : null}
                  <Pressable
                    onPress={() => void submit()}
                    disabled={busy}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, backgroundColor: colors.darkButton, opacity: busy || pressed ? 0.75 : 1 }]}
                  >
                    <Send size={16} color={colors.darkButtonText} />
                    <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{busy ? '…' : t('s.commReport')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
