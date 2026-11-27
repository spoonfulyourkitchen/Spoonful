import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag, MessageSquare, Send, Trash2, X } from 'lucide-react-native';

import { api } from '../lib/api';
import { useMutation, useQuery } from '../lib/convex-auth';
import { addPendingOp, getConnNow } from '../lib/offline';
import { colors } from '../theme';
import { useTranslation } from '../lib/i18n';

const REPORT_REASONS: { value: string; key: string }[] = [
  { value: 'spam', key: 'cmtSpam' },
  { value: 'offensive', key: 'cmtOffensive' },
  { value: 'wrong', key: 'cmtWrong' },
  { value: 'other', key: 'cmtOther' },
];

export function CommentSheet({
  shareId,
  shareTitle,
  userName,
  onClose,
}: {
  shareId: string | null;
  shareTitle: string;
  userName?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [reportReason, setReportReason] = useState<string | null>(null);

  const comments = useQuery(api.sharing.comments, shareId ? { sharedRecipeId: shareId } : {});
  const addComment = useMutation(api.sharing.addComment);
  const deleteComment = useMutation(api.sharing.deleteComment);
  const report = useMutation(api.sharing.report);

  

  const [pending, setPending] = useState<any[]>([]);
  useEffect(() => {
    setPending([]);
  }, [shareId]);
  const shown = useMemo(() => {
    const serverList: any[] = Array.isArray(comments) ? comments : [];
    const stillOpen = pending.filter(
      (p) => !serverList.some((c: any) => String(c.text ?? '') === String(p.text ?? '') && String(c.userName ?? '') === String(p.userName ?? '')),
    );
    return [...serverList, ...stillOpen];
  }, [comments, pending]);

  const send = () => {
    const text = draft.trim();
    if (!shareId || !text) return;
    
    const local = { _id: `loc-${Date.now()}`, text, userName: userName ?? '', mine: true, local: true };
    setPending((prev) => [...prev, local]);
    setDraft('');
    void (async () => {
      const payload = { sharedRecipeId: shareId, text, userName: userName ?? null };
      if (getConnNow() === 'offline') {
        await addPendingOp('community.comment', payload);
        return;
      }
      try {
        await addComment(payload);
      } catch {
        await addPendingOp('community.comment', payload);
      }
    })();
  };

  const remove = (id: string) => {
    Alert.alert(t('s.cmtDelConfirm'), t('s.cmtDelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setPending((prev) => prev.filter((c) => c._id !== id));
          void (async () => {
            if (getConnNow() === 'offline') {
              await addPendingOp('community.comment.remove', { id });
              return;
            }
            try {
              await deleteComment({ id });
            } catch {
              await addPendingOp('community.comment.remove', { id });
            }
          })();
        },
      },
    ]);
  };

  const sendReport = async (reason: string) => {
    if (!shareId) return;
    setReportReason(reason);
    try {
      await report({ targetType: 'recipe', targetId: shareId, reason });
      Alert.alert(t('s.cmtThanks'), t('s.cmtThanksBody'));
    } catch (e) {
      Alert.alert(t('s.cmtReportFail'), e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setReportReason(null);
    }
  };

  return (
    <Modal visible={!!shareId} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingHorizontal: 18,
              paddingTop: 14,
              maxHeight: '82%',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MessageSquare size={17} color={colors.accentInk} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                  {shareTitle}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {comments === undefined ? (
                <ActivityIndicator color={colors.accentInk} style={{ marginVertical: 18 }} />
              ) : shown.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginVertical: 14 }}>
                  {t('s.cmtEmpty')}

                </Text>
              ) : (
                shown.map((c) => (
                  <View key={c._id} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.accentInk }}>{c.userName}</Text>
                      {c.mine ? (
                        <Pressable onPress={() => remove(c._id)} hitSlop={8}>
                          <Trash2 size={14} color={colors.rose} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 13.5, color: colors.textPrimary, marginTop: 3, lineHeight: 19 }}>{c.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('s.cmtPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                style={{
                  flex: 1,
                  maxHeight: 90,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.bg,
                  color: colors.textPrimary,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 14,
                }}
              />
              <Pressable
                onPress={send}
                disabled={!draft.trim()}
                style={({ pressed }) => [
                  {
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.darkButton,
                    opacity: pressed || !draft.trim() ? 0.6 : 1,
                  },
                ]}
              >
                <Send size={18} color={colors.darkButtonText} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Flag size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.cmtReport')}</Text>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => void sendReport(r.value)}
                  disabled={reportReason != null}
                  style={({ pressed }) => [
                    {
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: reportReason === r.value ? colors.roseBg : colors.surfaceMuted,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{t(`s.${r.key}`)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: Math.max(16, insets.bottom + 8) }} />
          </View>
        </View>
    
        </KeyboardAvoidingView></Modal>
  );
}

export default CommentSheet;
