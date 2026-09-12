import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Flag, Send, X } from 'lucide-react-native';
import { useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText } from '../theme';

const REASONS = ['Wrong photo', 'Photo is not this dish', 'False information', 'Offensive content', 'Something else'];

/** Native "report this photo" flow - writes to the Supabase image_reports table. */
export function ReportPhotoButton({ recipeKey, recipeTitle, imageUrl, onDone }: { recipeKey: string; recipeTitle: string; imageUrl?: string; onDone?: (ok: boolean) => void }) {
  const reportImage = useMutation(api.recipes.reportImage);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsMessage = reason === REASONS[REASONS.length - 1];

  const submit = async () => {
    if (!reason) return;
    if (needsMessage && !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await reportImage({ recipeKey, recipeTitle, imageUrl, reason, message: message.trim() || undefined });
      setSent(true);
      onDone?.(true);
      setTimeout(() => { setOpen(false); setSent(false); setReason(null); setMessage(''); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your report could not be sent. Please try again.');
      onDone?.(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: colors.cardBorder }, pressed && { opacity: 0.75 }]} accessibilityLabel="Report photo">
        <Flag size={16} color={colors.textSecondary} strokeWidth={2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 420, backgroundColor: colors.bg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flag size={18} color={colors.rose} strokeWidth={2.2} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>Report this photo</Text>
              </View>
              <Pressable onPress={() => !busy && setOpen(false)} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>Help us keep {recipeTitle} accurate for everyone.</Text>
            {sent ? (
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={22} color={colors.success} />
                </View>
                <Text style={{ marginTop: 10, fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Report sent</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Thanks — we read every report.</Text>
              </View>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 240 }}>
                  {REASONS.map((r) => {
                    const active = reason === r;
                    return (
                      <Pressable key={r} onPress={() => setReason(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.rose : colors.cardBorder, backgroundColor: active ? colors.roseBg : colors.card, padding: 12, marginBottom: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? colors.rose : colors.textSecondary, opacity: active ? 1 : 0.4 }} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: active ? colors.rose : colors.textPrimary }}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {reason ? (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 4 }}>
                      {needsMessage ? 'Tell us more (required)' : 'Anything to add? (optional)'}
                    </Text>
                    <TextInput value={message} onChangeText={setMessage} placeholder="What did you notice?" placeholderTextColor={colors.textSecondary} multiline maxLength={1000} style={{ minHeight: 70, maxHeight: 120, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, padding: 10, fontSize: 14 }} />
                    {error ? <Text style={{ color: colors.rose, fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
                    <Pressable onPress={() => void submit()} disabled={busy || !reason || (needsMessage && !message.trim())} style={({ pressed }) => [{ marginTop: 14, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.rose }, (busy || !reason || (needsMessage && !message.trim())) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
                      <Text style={{ color: readableText(colors.rose), fontWeight: '700', fontSize: 15 }}>{busy ? 'Sending…' : 'Send report'}</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default ReportPhotoButton;

