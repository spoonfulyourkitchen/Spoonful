import { translate } from '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ArrowLeft, Check, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '../lib/convex-auth';
import { readIntroAnswers } from '../lib/intro-answers';
import { IS_LOCAL_WEB } from '../lib/platform';
import { startLocalTest } from '../lib/local-test';
import { sendConfirmationEmail, clearVerifyState } from '../lib/verify';
import { setRecoveryPending } from '../lib/recovery';
import { passwordStrengthLevel, passwordStrengthColor, passwordStrengthKey, PASSWORD_MIN_LEVEL } from '../lib/password-strength';
import { colors, fonts } from '../theme';
import { navigate } from '../navigation/rootRef';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { AppButton, GlassCard } from '../components/ui';

type Mode = 'login' | 'register' | 'forgot' | 'code';
type Method = 'password' | 'magic';

type CodePurpose = 'signup' | 'magic' | 'recovery';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const wantsRegistration = (route.params as any)?.register === true;
  const { signInWithPassword, signUp, signInWithGoogle, sendOtp, sendReset, verifyOtp } = useAuthActions();

  const [mode, setMode] = useState<Mode>(wantsRegistration ? 'register' : 'login');

  useEffect(() => {
    setMode(wantsRegistration ? 'register' : 'login');
    setRegStep(1);
  }, [wantsRegistration]);
  const [method, setMethod] = useState<Method>('password');
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [codePurpose, setCodePurpose] = useState<CodePurpose>('signup');
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  

  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);
  const [localTest, setLocalTest] = useState(false);
  const consentsGiven = agreeAge && agreeTerms && agreeHealth;

  
  useEffect(() => {
    let alive = true;
    void readIntroAnswers().then((stored) => {
      if (alive && stored?.name) setName((current) => current || stored.name);
    }).catch(() => {});
    try {
      setLocalTest(IS_LOCAL_WEB);
    } catch {}
    return () => { alive = false; };
  }, []);

  const startFreshTest = async () => {
    await startLocalTest();
  };

  const needsResend = /confirm your email/i.test(error ?? '');
  
  const pwLevel = passwordStrengthLevel(password);

  const showError = (e: unknown, fallback: string) => {
    const raw = e instanceof Error ? e.message : String(e ?? '');
    setError(raw && raw !== 'Unexpected error' ? friendly(raw) : fallback);
  };

  
  const resendConfirmation = async () => {
    if (resendBusy) return;
    const address = email.trim();
    if (!address.includes('@')) {
      setResendNote(translate('ax.enterEmailFirst'));
      return;
    }
    setResendBusy(true);
    const res = await sendConfirmationEmail(address);
    if (res.ok) setResendNote(translate('ax.resendSent'));
    else if (res.reason === 'mail_failed') setResendNote(translate('ax.resendMailFail'));
    else if (res.reason === 'throttled') setResendNote(translate('ax.resendThrottle'));
    else setResendNote(res.message ?? translate('ax.emailSendFailed'));
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

  
  const openCode = (purpose: CodePurpose) => {
    setCodePurpose(purpose);
    setCode('');
    setCodeNote(null);
    setResendNote(null);
    setError(null);
    setNotice(null);
    setMode('code');
  };

  
  const nextStep = () => {
    setError(null);
    if (regStep === 1) {
      if (!email.trim().includes('@')) {
        setError(translate('ax.emailInvalid'));
        return;
      }
      setRegStep(2);
    }
  };

  const prevStep = () => {
    setError(null);
    if (mode === 'register' && regStep > 1) {
      setRegStep(1);
      return;
    }
    navigate('Landing', { showIntro: true } as any);
  };

  const submitLogin = async () => {
    if (!email.includes('@') || !password) {
      setError(translate('ax.emailPassMissing'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithPassword(email, password);
    } catch (e) {
      showError(e, translate('ax.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitMagic = async () => {
    if (!email.includes('@')) {
      setError(translate('ax.emailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendOtp(email);
      openCode('magic');
    } catch (e) {
      showError(e, translate('ax.signInCodeFailed'));
    } finally {
      setBusy(false);
    }
  };

  
  const submitGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      showError(e, translate('auth.googleFailed'));
    } finally {
      setGoogleBusy(false);
    }
  };

  const submitRegister = async () => {
    if (!email.trim().includes('@')) {
      setError(translate('ax.emailInvalid'));
      return;
    }
    if (password.length < 8) {
      setError(translate('ax.pwTooShort'));
      return;
    }
    if (passwordStrengthLevel(password) < PASSWORD_MIN_LEVEL) {
      setError(translate('auth.pwTooWeak'));
      return;
    }
    if (!consentsGiven) {
      setError(translate('auth.consentRequired'));
      return;
    }
    if (password !== confirm) {
      setError(translate('ax.pwMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const now = Date.now();
      const res: any = await signUp({
        email: email.trim(),
        password,
        name: name.trim() || email.trim().split('@')[0] || 'Spoonful cook',
        ageConfirmed: agreeAge,
        termsAcceptedAt: agreeTerms ? now : undefined,
        healthConsentAt: agreeHealth ? now : undefined,
      });
      const account: any = res?.user ?? res?.session?.user ?? null;
      const confirmed = !!(account?.email_confirmed_at || account?.confirmed_at);
      if (res?.session && confirmed) {
        setNotice(translate('ax.accountReady'));
      } else {
        openCode('signup');
      }
    } catch (e) {
      showError(e, translate('ax.registerFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!email.includes('@')) {
      setError(translate('ax.emailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendReset(email);
      openCode('recovery');
    } catch (e) {
      showError(e, translate('ax.resetFailed'));
    } finally {
      setBusy(false);
    }
  };

  
  const verifyCode = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError(translate('ax.codeMissing'));
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
        setRecoveryPending(true);
      } else {
        await clearVerifyState();
        setNotice(translate('ax.allSet'));
      }
    } catch (e) {
      showError(e, translate('ax.codeInvalid'));
    } finally {
      setBusy(false);
    }
  };

  
  const resendCode = async () => {
    if (resendBusy) return;
    setResendBusy(true);
    setError(null);
    try {
      if (codePurpose === 'signup') {
        const r = await sendConfirmationEmail(email.trim());
        if (!r.ok) throw new Error(r.message ?? translate('ax.codeSendFailed'));
      } else if (codePurpose === 'magic') {
        await sendOtp(email);
      } else {
        await sendReset(email);
      }
      setCodeNote(translate('ax.newCodeSent', { email: email.trim() || translate('ax.yourEmail') }));
    } catch (e) {
      showError(e, translate('ax.resendFailed'));
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
    codePurpose === 'signup' ? translate('auth.verifyYourEmail') : codePurpose === 'magic' ? translate('auth.signInWithCode') : translate('ax.resetCodeTitle');
  const codeSubtitle =
    codePurpose === 'signup'
      ? translate('ax.codeSubSignup', { email: email.trim() || translate('ax.yourEmail') })
      : codePurpose === 'magic'
        ? translate('ax.codeSubMagic', { email: email.trim() || translate('ax.yourEmail') })
        : translate('ax.codeSubReset', { email: email.trim() || translate('ax.yourEmail') });

  const headerTitle =
    mode === 'code'
      ? codeTitle
      : mode === 'register'
        ? regStep === 1
          ? translate('auth.createAccount')
          : translate('ax.pwTitle')
        : mode === 'forgot'
          ? translate('auth.resetPassword')
          : translate('auth.welcomeNew');

  const headerSubtitle =
    mode === 'code'
      ? codeSubtitle
      : mode === 'register'
        ? regStep === 1
          ? translate('ax.regSub')
          : translate('ax.pwSub')
        : mode === 'forgot'
          ? translate('ax.resetSub')
          : translate('ax.welcomeSub');

  return (
    <WashBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }}>
          <Pressable onPress={prevStep} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <ArrowLeft size={15} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {translate('s.xBack')}
            </Text>
          </Pressable>

          {mode === 'register' ? (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {[1, 2].map((n) => (
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
              <Field icon={<Mail size={16} color={colors.textSecondary} />} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            ) : null}

            {mode === 'register' && regStep === 2 ? (
              <>
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder={translate('s.xPhPasswordMin')} secureTextEntry reveal toggleLabelId="s.xShowPassword" hideLabelId="s.xHidePassword" value={password} onChangeText={setPassword} />
                {password ? (
                  <View style={{ marginTop: -2, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: i < pwLevel ? passwordStrengthColor(pwLevel) : colors.surfaceMuted,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', marginTop: 5, color: passwordStrengthColor(pwLevel) }}>
                      {translate(passwordStrengthKey(pwLevel))}
                    </Text>
                  </View>
                ) : null}
                <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder={translate('s.xPhRepeatPassword')} secureTextEntry value={confirm} onChangeText={setConfirm} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 }}>
                  {translate('auth.cookingExpLater')}
                </Text>
                <View style={{ marginTop: 12 }}>
                  <CheckRow checked={agreeAge} onToggle={() => setAgreeAge((v) => !v)} label={translate('auth.ageConfirm')} />
                  <CheckRow checked={agreeTerms} onToggle={() => setAgreeTerms((v) => !v)} label={translate('auth.acceptTerms')} />
                  <CheckRow checked={agreeHealth} onToggle={() => setAgreeHealth((v) => !v)} label={translate('auth.healthConsent')} />
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, marginLeft: 30 }}>
                    <Pressable onPress={() => navigate('Legal', { page: 'datenschutz' })} hitSlop={6}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12.5 }}>{translate('legal.navPrivacy')}</Text>
                    </Pressable>
                    <Pressable onPress={() => navigate('Legal', { page: 'agb' })} hitSlop={6}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12.5 }}>{translate('legal.navTerms')}</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : null}

            {mode === 'code' ? (
              <View>
                <CodeField value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} onComplete={() => void verifyCode()} />
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginTop: 2 }}>
                  {translate('ax.pasteHint')}
                </Text>
                {codeNote ? <Text style={{ fontSize: 12.5, color: colors.success, marginTop: 8 }}>{codeNote}</Text> : null}
                <Pressable onPress={() => void resendCode()} disabled={resendBusy} hitSlop={6} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.accent, fontSize: 13.5, fontWeight: '700' }}>
                    {resendBusy ? translate('ax.resendBusy') : translate('ax.resendNew')}
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
                    <Field icon={<Lock size={16} color={colors.textSecondary} />} placeholder={translate('s.xPhPassword')} secureTextEntry reveal toggleLabelId="s.xShowPassword" hideLabelId="s.xHidePassword" value={password} onChangeText={setPassword} />
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <ModePill active={method === 'password'} label={translate('s.authPassword')} onPress={() => setMethod('password')} />
                    <ModePill active={method === 'magic'} label={translate('s.authMagic')} onPress={() => setMethod('magic')} />
                  </View>
                </>
              )
            ) : null}

            {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{error}</Text> : null}
        {needsResend ? (
          <Pressable onPress={() => void resendConfirmation()} disabled={resendBusy} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
              {resendBusy ? translate('common.loading') : resendNote ?? translate('ax.resendConfirm')}
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
                  ? translate('common.loading')
                  : mode === 'code'
                    ? translate('auth.verify')
                    : mode === 'register'
                      ? regStep === 2
                        ? translate('auth.createAccount')
                        : translate('common.next')
                      : mode === 'forgot'
                        ? translate('auth.sendCode')
                        : method === 'magic'
                          ? translate('auth.signInWithCode')
                          : translate('landing.signIn')
              }
              variant="dark"
              style={{ marginTop: 14 }}
              busy={busy}
              disabled={mode === 'register' && regStep === 2 && (pwLevel < PASSWORD_MIN_LEVEL || !consentsGiven)}
              onPress={() => {
                if (mode === 'register' && regStep < 2) nextStep();
                else onSubmit();
              }}
            />

            {mode === 'login' ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{translate('auth.or')}</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
                </View>
                <Pressable
                  onPress={() => void submitGoogle()}
                  disabled={googleBusy || busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      borderRadius: 14,
                      paddingVertical: 13,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.card,
                      opacity: googleBusy || busy ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#4285F4' }}>G</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{translate('auth.continueWithGoogle')}</Text>
                </Pressable>

                {localTest ? (
                  <Pressable
                    onPress={() => void startFreshTest()}
                    accessibilityRole="button"
                    style={({ pressed }) => [{
                      marginTop: 14, borderRadius: 14, paddingVertical: 11, alignItems: 'center',
                      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                      Test starten (nur lokal)
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </GlassCard>

          {mode === 'login' ? (
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <Pressable onPress={() => navigate('Landing', { showIntro: true } as any)} hitSlop={6}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  {translate('s.authNew')} <Text style={{ color: colors.accent, fontWeight: '800' }}>{translate('s.authCreate')}</Text>
                </Text>
              </Pressable>
              <Pressable onPress={() => switchMode('forgot')} hitSlop={6} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>{translate('s.xForgotPassword')}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </WashBackground>
  );
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? colors.accent : colors.cardBorder,
          backgroundColor: checked ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Check size={13} color={colors.accentText} strokeWidth={3} /> : null}
      </View>
      <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>{label}</Text>
    </Pressable>
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
  
  reveal?: boolean;
  
  toggleLabelId?: string;
  hideLabelId?: string;
}) {
  const [hidden, setHidden] = useState(!!props.secureTextEntry);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, marginBottom: 10 }}>
      {props.icon}
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={props.secureTextEntry ? hidden : false}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        value={props.value}
        onChangeText={props.onChangeText}
        style={[{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary }, { backgroundColor: 'transparent' }]}/>
      {props.secureTextEntry && props.reveal ? (
        <Pressable
          onPress={() => setHidden((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={translate(hidden ? props.toggleLabelId ?? 's.xShowPassword' : props.hideLabelId ?? 's.xHidePassword')}
          style={({ pressed }) => [{ padding: 2 }, pressed && { opacity: 0.6 }]}
        >
          {hidden ? (
            <Eye size={18} color={colors.textSecondary} strokeWidth={2} />
          ) : (
            <EyeOff size={18} color={colors.accent} strokeWidth={2} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

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
        style={[{ fontSize: 26, letterSpacing: 6, textAlign: 'center', fontWeight: '800', color: colors.textPrimary, paddingVertical: 4 }, { backgroundColor: 'transparent' }]}/>
    </View>
  );
}

function friendly(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) return translate('ax.wrongCredentials');
  if (lower.includes('token has expired') || lower.includes('expired or is invalid')) return translate('ax.codeExpired');
  if (lower.includes('invalid token') || lower.includes('token is invalid') || lower.includes('invalid otp')) return translate('ax.codeWrong');
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already')) return translate('ax.accountExists');
  if (lower.includes('email not confirmed')) return translate('ax.emailNotConfirmed');
  if (lower.includes('rate limit') || lower.includes('too many')) return translate('ax.tooMany');
  if (lower.includes('password should be at least')) return translate('ax.pwTooShort');
  if (lower.includes('sending confirmation email') || lower.includes('error sending')) {
    return translate('ax.mailFailedLong');
  }
  if (lower.includes('for security purposes') || lower.includes('only request this after')) {
    return translate('ax.waitSeconds');
  }
  return raw;
}

