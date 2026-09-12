import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Lock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { setRecoveryPending } from '../lib/recovery';
import { colors, fonts } from '../theme';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { AppButton, GlassCard } from '../components/ui';

/**
 * Shown after a user opens a password-reset link (spoonful://reset).
 * The recovery session is already active; here the user picks a new password.
 */
export function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const finishLater = () => {
    setRecoveryPending(false);
  };

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setDone(true);
      setRecoveryPending(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <WashBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }}>
          <View style={{ alignItems: 'center' }}>
            <Logo size={58} />
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, fontFamily: fonts.display, marginTop: 10, textAlign: 'center' }}>
              {done ? 'Password updated' : 'Choose a new password'}
            </Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              {done
                ? 'Your Spoonful password has been changed. You can now continue using the app.'
                : 'Enter a new password for your Spoonful account.'}
            </Text>
          </View>

          <GlassCard pad={18} radius={24} style={{ marginTop: 22 }}>
            {done ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={26} color={colors.success} strokeWidth={3} />
                </View>
                <Text style={{ marginTop: 14, fontSize: 15, color: colors.textPrimary, textAlign: 'center', lineHeight: 21 }}>
                  Keep this new password somewhere safe. You are signed in.
                </Text>
              </View>
            ) : (
              <>
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder="New password (min 8 characters)" secureTextEntry value={password} onChangeText={setPassword} />
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder="Repeat new password" secureTextEntry value={confirm} onChangeText={setConfirm} />
                {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 6, lineHeight: 18 }}>{error}</Text> : null}
                <AppButton label={busy ? 'Updating…' : 'Set new password'} variant="dark" style={{ marginTop: 14 }} busy={busy} onPress={() => void submit()} />
              </>
            )}
            {!done ? (
              <Pressable onPress={finishLater} hitSlop={8} style={{ alignItems: 'center', paddingTop: 14 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Later - keep the current password</Text>
              </Pressable>
            ) : null}
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </WashBackground>
  );
}

function Field(props: {
  icon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, marginBottom: 10 }}>
      {props.icon}
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        value={props.value}
        onChangeText={props.onChangeText}
        style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary }}
      />
    </View>
  );
}
