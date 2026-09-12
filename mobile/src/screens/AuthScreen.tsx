import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, Lock, Mail, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '../lib/convex-auth';
import { sendConfirmationEmail, clearVerifyState } from '../lib/verify';
import { setRecoveryPending } from '../lib/recovery';
import { colors, fonts } from '../theme';
import { goBack } from '../navigation/rootRef';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { AppButton, GlassCard } from '../components/ui';

type Mode = 'login' | 'register' | 'forgot' | 'code';
type Method = 'password' | 'magic';
/** Why we are asking for a code: signup confirmation, magic link or reset. */
type CodePurpose = 'signup' | 'magic' | 'recovery';

const COOKING_OPTIONS = [
  { value: 'beginner', label: 'Just started' },
  { value: '1-2 years', label: '1-2 years' },
  { value: '3-5 years', label: '3-5 years' },
  { value: '5+ years', label: '5+ years' },
  { value: 'professional', label: 'Professional' },
];

/** Spoonful auth (Supabase): step-by-step signup, password/magic-link login. */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithPassword, signUp, sendOtp, sendReset, verifyOtp } = useAuthActions();

  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<Method>('password');
  // Signup wizard: 1 name, 2 cooking experience, 3 email+password
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  // Code screen (step 2 of every flow): which code are we waiting for?
  const [codePurpose, setCodePurpose] = useState<CodePurpose>('signup');
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [cookingExp, setCookingExp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  /** True when the last error was "please confirm your email first". */
  const needsResend = /confirm your email/i.test(error ?? '');

  const showError = (e: unknown, fallback: string) => {
    const raw = e instanceof Error ? e.message : String(e ?? '');
    setError(raw && raw !== 'Unexpected error' ? friendly(raw) : fallback);
  };

  /** Sends a fresh confirmation link (used when signing in unconfirmed). */
  const resendConfirmation = async () => {
    if (resendBusy) return;
    const address = email.trim();
    if (!address.includes('@')) {
      setResendNote('Please enter your email address first.');
      return;
    }
    setResendBusy(true);
    const res = await sendConfirmationEmail(address);
    if (res.ok) setResendNote('Sent - please check your inbox (and spam).');
    else if (res.reason === 'mail_failed') setResendNote('The mail service is having trouble - please try again in a few minutes.');
    else if (res.reason === 'throttled') setResendNote('Please wait a moment before trying again.');
    else setResendNote(res.message ?? 'Could not send the email.');
    setResendBusy(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRegStep(1);
    setError(null);
    setNotice(null);
    setCode('');
    setCodeNote(null);
    setResendNote(null);
  };

  /** Step 2 of signup / magic-link / password-reset: ask for the emailed code. */
  const openCode = (purpose: CodePurpose) => {
    setCodePurpose(purpose);
    setCode('');
    setCodeNote(null);
    setResendNote(null);
    setError(null);
    setNotice(null);
    setMode('code');
  };

  /* ---------------- wizard helpers ---------------- */
  const nextStep = () => {
    setError(null);
    if (regStep === 1) {
      if (!name.trim()) {
        setError('Tell us your name.');
        return;
      }
      setRegStep(2);
    } else if (regStep === 2) {
      if (!cookingExp) {
        setError('Choose your cooking experience.');
        return;
      }
      setRegStep(3);
    }
  };

  const prevStep = () => {
    setError(null);
    if (mode === 'register' && regStep > 1) {
      setRegStep((regStep - 1) as 1 | 2 | 3);
      return;
    }
    if (mode === 'code') {
      switchMode(codePurpose === 'recovery' ? 'forgot' : 'login');
      return;
    }
    if (mode === 'login') goBack();
    else switchMode('login');
  };

  const submitLogin = async () => {
    if (!email.includes('@') || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithPassword(email, password);
    } catch (e) {
      showError(e, 'Could not sign in. Please check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const submitMagic = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendOtp(email);
      openCode('magic');
    } catch (e) {
      showError(e, 'Could not send the sign-in code.');
    } finally {
      setBusy(false);
    }
  };
  const submitRegister = async () => {
    if (!email.trim().includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res: any = await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        cookingExperience: cookingExp || undefined,
      });
      const account: any = res?.user ?? res?.session?.user ?? null;
      const confirmed = !!(account?.email_confirmed_at || account?.confirmed_at);
      if (res?.session && confirmed) {
        // Supabase confirmed the address directly (mailer_autoconfirm) - done.
        setNotice('Your account is ready.');
      } else {
        // A confirmation code is on its way - step 2 asks for it.
        openCode('signup');
      }
    } catch (e) {
      showError(e, 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendReset(email);
      openCode('recovery');
    } catch (e) {
      showError(e, 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: check the 8 digit code the user copied out of the email. */
  const verifyCode = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError('Enter the code from your email (8 digits).');
      return;
    }
    setBusy(true);
    setError(null);
    setCodeNote(null);
    try {
      await verifyOtp({
        email,
        token,
        type: codePurpose === 'magic' ? 'email' : codePurpose,
      });
      if (codePurpose === 'recovery') {
        setCode('');
        // The recovery session is active - step 3 asks for the new password.
        setRecoveryPending(true);
      } else {
        await clearVerifyState();
        setNotice('You are all set.');
      }
    } catch (e) {
      showError(e, 'That code is not valid any more. Please request a new one.');
    } finally {
      setBusy(false);
    }
  };

  /** Sends a fresh code for the current step (link stayed in the email too). */
  const resendCode = async () => {
    if (resendBusy) return;
    setResendBusy(true);
    setError(null);
    try {
      if (codePurpose === 'signup') {
        const r = await sendConfirmationEmail(email.trim());
        if (!r.ok) throw new Error(r.message ?? 'Could not send the code.');
      } else if (codePurpose === 'magic') {
        await sendOtp(email);
      } else {
        await sendReset(email);
      }
      setCodeNote(`New code sent to ${email.trim() || 'your email'}.`);
    } catch (e) {
      showError(e, 'Could not send a new code right now.');
    } finally {
      setResendBusy(false);
    }
  };

  const onSubmit = () => {
    if (mode === 'code') void verifyCode();
    else if (mode === 'register') void submitRegister();
    else if (mode === 'forgot') void submitForgot();
    else if (method === 'magic') void submitMagic();
    else void submitLogin();
  };

  const codeTitle =
    codePurpose === 'signup' ? 'Confirm your email' : codePurpose === 'magic' ? 'Enter your sign-in code' : 'Enter your reset code';
  const codeSubtitle =
    codePurpose === 'signup'
      ? `We emailed an 8 digit code to ${email.trim() || 'your email'}. Copy it out of the mail and paste it below.`
      : codePurpose === 'magic'
        ? `We emailed an 8 digit sign-in code to ${email.trim() || 'your email'}. Paste it below to sign in.`
        : `We emailed an 8 digit code to ${email.trim() || 'your email'}. Paste it below, then choose a new password.`;

  const headerTitle =
    mode === 'code'
      ? codeTitle
      : mode === 'register'
        ? regStep === 1
          ? 'What should we call you?'
          : regStep === 2
            ? 'How long have you been cooking?'
            : 'Create your account'
        : mode === 'forgot'
          ? 'Reset password'
          : 'Welcome to Spoonful';

  const headerSubtitle =
    mode === 'code'
      ? codeSubtitle
      : mode === 'register'
        ? regStep === 1
          ? 'Your name shows on your profile and in the community.'
          : regStep === 2
            ? 'Just pick what fits best - you can change it later.'
            : 'One last step. Use your real email so your code can reach you.'
        : mode === 'forgot'
          ? 'We will email you an 8 digit code to set a new password.'
          : 'Your recipes, tracker and shopping list in one calm kitchen.';

  return (
    <WashBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }}>
          <Pressable onPress={prevStep} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <ArrowLeft size={15} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {mode === 'register' && regStep > 1 ? 'Back' : 'Back to sign in'}
            </Text>
          </Pressable>

          {mode === 'register' && regStep < 4 ? (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: regStep >= n ? colors.accent : colors.surfaceMuted }} />
              ))}
            </View>
          ) : null}

          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <Logo size={58} />
            <Text style={{ fontSize: 23, fontWeight: '800', color: colors.textPrimary, fontFamily: fonts.display, letterSpacing: -0.4, marginTop: 8, textAlign: 'center' }}>
              {headerTitle}
            </Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              {headerSubtitle}
            </Text>
          </View>

          <GlassCard pad={18} radius={24} style={{ marginTop: 20 }}>
            {mode === 'register' && regStep === 1 ? (
              <Field icon={<User size={16} color={colors.textSecondary} />} placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
            ) : null}

            {mode === 'register' && regStep === 2 ? (
              <View style={{ gap: 8 }}>
                {COOKING_OPTIONS.map((o) => {
                  const active = cookingExp === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => setCookingExp(active ? '' : o.value)}
                      style={({ pressed }) => [
                        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, opacity: pressed ? 0.75 : 1 },
                        active ? { borderColor: colors.accent, backgroundColor: colors.accentSoft } : { borderColor: colors.cardBorder, backgroundColor: colors.card },
                      ]}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{o.label}</Text>
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {active ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {mode === 'register' && regStep === 3 ? (
              <>
                <Field icon={<Mail size={16} color={colors.textSecondary} />} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder="Password (min 8 characters)" secureTextEntry value={password} onChangeText={setPassword} />
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder="Repeat password" secureTextEntry value={confirm} onChangeText={setConfirm} />
              </>
            ) : null}

            {mode === 'code' ? (
              <View>
                <CodeField value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} onComplete={() => void verifyCode()} />
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginTop: 2 }}>
                  Tap the code, keep your finger on it and press Paste. The email has the same code.
                </Text>
                {codeNote ? <Text style={{ fontSize: 12.5, color: colors.success, marginTop: 8 }}>{codeNote}</Text> : null}
                <Pressable onPress={() => void resendCode()} disabled={resendBusy} hitSlop={6} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.accent, fontSize: 13.5, fontWeight: '700' }}>
                    {resendBusy ? 'Sending a new code...' : 'Send a new code'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {mode === 'login' || mode === 'forgot' ? (
              mode === 'forgot' ? (
                <Field icon={<Mail size={16} color={colors.textSecondary} />} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              ) : (
                <>
                  <Field icon={<Mail size={16} color={colors.textSecondary} />} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                  {method === 'password' ? (
                    <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <ModePill active={method === 'password'} label="Password" onPress={() => setMethod('password')} />
                    <ModePill active={method === 'magic'} label="Magic link" onPress={() => setMethod('magic')} />
                  </View>
                </>
              )
            ) : null}

            {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{error}</Text> : null}
        {needsResend ? (
          <Pressable onPress={() => void resendConfirmation()} disabled={resendBusy} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
              {resendBusy ? 'Sending…' : resendNote ?? 'Resend confirmation email'}
            </Text>
          </Pressable>
        ) : resendNote ? (
          <Text style={{ color: colors.accent, fontSize: 13, marginTop: 8 }}>{resendNote}</Text>
        ) : null}
            {notice && mode !== 'register' ? (
              <View style={{ flexDirection: 'row', gap: 8, borderRadius: 14, backgroundColor: colors.successBg, padding: 12, marginTop: 10 }}>
                <Check size={18} color={colors.success} />
                <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>{notice}</Text>
              </View>
            ) : null}

            <AppButton
              label={
                busy
                  ? 'Please wait...'
                  : mode === 'code'
                    ? 'Verify code'
                    : mode === 'register'
                      ? regStep === 3
                        ? 'Create account'
                        : 'Continue'
                      : mode === 'forgot'
                        ? 'Email me a code'
                        : method === 'magic'
                          ? 'Email me a sign-in code'
                          : 'Sign in'
              }
              variant="dark"
              style={{ marginTop: 14 }}
              busy={busy}
              onPress={() => {
                if (mode === 'register' && regStep < 3) nextStep();
                else onSubmit();
              }}
            />
          </GlassCard>

          {mode === 'login' ? (
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <Pressable onPress={() => switchMode('register')} hitSlop={6}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  New to Spoonful? <Text style={{ color: colors.accent, fontWeight: '800' }}>Create account</Text>
                </Text>
              </Pressable>
              <Pressable onPress={() => switchMode('forgot')} hitSlop={6} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>Forgot password?</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </WashBackground>
  );
}

function ModePill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, opacity: pressed ? 0.7 : 1 },
        active ? { backgroundColor: colors.accentSoft, borderColor: colors.accent } : { borderColor: colors.cardBorder },
      ]}
    >
      <Text style={{ fontSize: 12.5, fontWeight: active ? '700' : '500', color: active ? colors.accent : colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

function Field(props: {
  icon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, marginBottom: 10 }}>
      {props.icon}
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        value={props.value}
        onChangeText={props.onChangeText}
        style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary }}
      />
    </View>
  );
}

/** Big paste-friendly field for the 8 digit codes that arrive by email. */
function CodeField(props: { value: string; onChangeText: (v: string) => void; onComplete?: () => void }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.card,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 10,
      }}
    >
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder="00000000"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="oneTimeCode"
        maxLength={12}
        onSubmitEditing={props.onComplete}
        style={{ fontSize: 26, letterSpacing: 6, textAlign: 'center', fontWeight: '800', color: colors.textPrimary, paddingVertical: 4 }}
      />
    </View>
  );
}

function friendly(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('token has expired') || lower.includes('expired or is invalid')) return 'That code has expired - tap "Send a new code" and try again.';
  if (lower.includes('invalid token') || lower.includes('token is invalid') || lower.includes('invalid otp')) return 'That code does not look right. Please check the digits and try again.';
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already')) return 'An account with this email already exists - sign in instead.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first (check your inbox).';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts - please wait a moment and try again.';
  if (lower.includes('password should be at least')) return 'Your password must be at least 8 characters.';
  // Supabase could not hand the confirmation mail to the mail provider.
  if (lower.includes('sending confirmation email') || lower.includes('error sending')) {
    return 'We could not send the confirmation email right now. Your account is created - you can sign in and use Spoonful, and confirm the address later from Settings.';
  }
  if (lower.includes('for security purposes') || lower.includes('only request this after')) {
    return 'Just a moment - please wait a few seconds before trying again.';
  }
  return raw;
}



