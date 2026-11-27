import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { Alert } from '../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MailCheck, RefreshCw, Send } from 'lucide-react-native';

import { useAuth, useAuthActions } from '../lib/convex-auth';
import { colors } from '../theme';
import { useTranslation } from '../lib/i18n';
import {
  clearVerifyState,
  loadVerifyState,
  markVerifyPending,
  needsConfirmation,
  refreshConfirmation,
  sendConfirmationEmail,
  type VerifyState,
} from '../lib/verify';

export function VerifyGate() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { signOut } = useAuthActions();
  const [state, setState] = useState<VerifyState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [bannerHidden, setBannerHidden] = useState(false);

  const pending = needsConfirmation(user);

  useEffect(() => {
    let alive = true;
    loadVerifyState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const email = (user as any)?.email;
    if (!user || !email) return;
    if (!needsConfirmation(user)) {
      if (state) {
        void clearVerifyState();
        setState(null);
      }
      return;
    }
    if (!state || state.email !== email) {
      void markVerifyPending(email).then(setState);
    }
  }, [user, state]);

  const send = useCallback(async () => {
    const email = (user as any)?.email ?? state?.email;
    if (!email || busy) return;
    setBusy(true);
    setNote(null);
    const res = await sendConfirmationEmail(email);
    if (res.ok) {
      setState(await loadVerifyState());
      setNote('Confirmation link sent - please check your inbox (and spam).');
    } else if (res.reason === 'mail_failed') {
      setNote('The mail service is having trouble. You can keep using Spoonful - we will try again later.');
    } else if (res.reason === 'throttled') {
      setNote('Please wait a moment before sending another email.');
    } else {
      setNote(res.message ?? 'Could not send the email.');
    }
    setBusy(false);
  }, [busy, state?.email, user]);

  const checkAgain = useCallback(async () => {
    setBusy(true);
    const ok = await refreshConfirmation();
    if (ok) {
      await clearVerifyState();
      setState(null);
      setNote(null);
    } else {
      setNote('Not confirmed yet. Open the link in the email, then try again.');
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!pending || !state?.sentAt) return;
    const id = setInterval(() => {
      void refreshConfirmation().then((ok) => {
        if (ok) void clearVerifyState().then(() => setState(null));
      });
    }, 20000);
    return () => clearInterval(id);
  }, [pending, state?.sentAt]);

  if (!user || !pending) return null;

  const locked = !!state?.sentAt;

  if (!locked) {
    if (bannerHidden) return null;
    return (
      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: insets.top + 6,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 20,
        }}
      >
        <MailCheck size={16} color={colors.accentInk} />
        <Text style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>
          {t('s.xConfirmBanner')}
        </Text>
        <Pressable
          onPress={() => void send()}
          disabled={busy}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderRadius: 999,
              backgroundColor: colors.darkButton,
              paddingHorizontal: 11,
              paddingVertical: 6,
              opacity: pressed || busy ? 0.8 : 1,
            },
          ]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.darkButtonText} /> : <Send size={13} color={colors.darkButtonText} />}
          <Text style={{ color: colors.darkButtonText, fontSize: 12, fontWeight: '700' }}>{t('s.xSendCode')}</Text>
        </Pressable>
        <Pressable onPress={() => setBannerHidden(true)} hitSlop={8}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>×</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', paddingHorizontal: 22 }}>
        <View style={{ borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MailCheck size={18} color={colors.accentInk} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.xConfirmTitle')}</Text>
          </View>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 10 }}>
            {t('s.xConfirmBody', { mail: (user as any)?.email ?? state?.email ?? '' })}
          </Text>

          {note ? <Text style={{ fontSize: 12.5, color: colors.accentInk, marginTop: 10 }}>{note}</Text> : null}

          <Pressable
            onPress={() => void checkAgain()}
            disabled={busy}
            style={({ pressed }) => [
              {
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 13,
                paddingVertical: 13,
                backgroundColor: pressed ? colors.darkButtonPressed : colors.darkButton,
                opacity: busy ? 0.8 : 1,
              },
            ]}
          >
            {busy ? <ActivityIndicator size="small" color={colors.darkButtonText} /> : <RefreshCw size={16} color={colors.darkButtonText} />}
            <Text style={{ color: colors.darkButtonText, fontWeight: '800' }}>{t('s.xConfirmedCheck')}</Text>
          </Pressable>

          <Pressable
            onPress={() => void send()}
            disabled={busy}
            style={({ pressed }) => [
              {
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 13,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Send size={15} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('s.xSendCodeAgain')}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert(t('s.xSignOutQuestion'), t('s.xSignOutBody'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('s.xSignOutTitle'),
                  style: 'destructive',
                  onPress: () => {
                    void clearVerifyState().then(() => signOut());
                  },
                },
              ]);
            }}
            style={{ marginTop: 14, alignSelf: 'center' }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, textDecorationLine: 'underline' }}>{t('s.xSignOutTitle')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default VerifyGate;
