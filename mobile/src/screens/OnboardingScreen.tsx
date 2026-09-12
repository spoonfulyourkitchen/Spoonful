import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChefHat, Flame, HeartPulse, Leaf, SkipForward } from 'lucide-react-native';
import { api } from '../lib/api';
import { useMutation, useQuery } from '../lib/convex-auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, readableText } from '../theme';
import { AppButton, GlassCard } from '../components/ui';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';

/**
 * First-start onboarding (2.0.0): three steps - goal, diet/allergies, cooking
 * experience - all skippable, stored on the profile and used for pre-filtering
 * recipes and for the AI Chef detail level. Shown only once (users.onboarded_at).
 */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const saveProfile = useMutation(api.users.saveProfile);
  const profile = useQuery(api.users.currentUser) as any;

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [goal, setGoal] = useState<string>(profile?.goal ?? '');
  const [diet, setDiet] = useState<string>(profile?.diet ?? '');
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [experience, setExperience] = useState<string>(profile?.cookingExperience ?? '');
  const [busy, setBusy] = useState(false);

  const GOALS: { value: string; label: string }[] = [
    { value: 'lose', label: t('onb.lose') },
    { value: 'keep', label: t('onb.keep') },
    { value: 'gain', label: t('onb.gain') },
  ];
  const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'glutenFree', 'lactoseFree'];
  const ALLERGENS = ['nuts', 'milk', 'gluten', 'eggs', 'soy', 'fish', 'shellfish'];
  const EXPERIENCE = [
    { value: 'beginner', label: t('onb.expStarted') },
    { value: '1-2 years', label: t('onb.exp1to2') },
    { value: '3-5 years', label: t('onb.exp3to5') },
    { value: '5+ years', label: t('onb.exp5plus') },
    { value: 'professional', label: t('onb.expPro') },
  ];

  const toggleAllergy = (v: string) =>
    setAllergies((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveProfile({
        goal: goal || 'keep',
        diet: diet || '',
        allergies,
        cookingExperience: experience || undefined,
        onboardedAt: Date.now(),
      });
    } catch {
      /* offline: the query refresh will simply try again on the next start */
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 14,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 13,
          opacity: pressed ? 0.75 : 1,
        },
        active
          ? { borderColor: colors.accent, backgroundColor: colors.accentSoft }
          : { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: active ? colors.accent : colors.cardBorder,
          backgroundColor: active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Check size={12} color={readableText(colors.accent)} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );


  const title = step === 0 ? t('onb.goalTitle') : step === 1 ? t('onb.dietTitle') : t('onb.expTitle');
  const desc = step === 0 ? t('onb.goalDesc') : step === 1 ? t('onb.dietDesc') : t('onb.expDesc');

  return (
    <WashBackground>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Logo size={52} />
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              fontWeight: '800',
              color: colors.textPrimary,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {step === 0 ? t('onb.welcome') : title}
          </Text>
          <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
            {step === 0 ? t('onb.intro') : desc}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: i <= step ? colors.accent : colors.surfaceMuted,
              }}
            />
          ))}
        </View>

        <GlassCard pad={16} radius={22} style={{ marginTop: 18 }}>
          {step === 0
            ? GOALS.map((g) => chip(g.label, goal === g.value, () => setGoal(goal === g.value ? '' : g.value)))
            : null}

          {step === 1 ? (
            <View style={{ gap: 8 }}>
              {chip(t('onb.none'), diet === '', () => setDiet(''))}
              {DIETS.map((d) => chip(t(`onb.${d}`), diet === d, () => setDiet(diet === d ? '' : d)))}
              <View style={{ height: 10 }} />
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.textPrimary }}>{t('onb.allergyTitle')}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 }}>{t('onb.allergyDesc')}</Text>
              <View style={{ gap: 8, marginTop: 2 }}>
                {ALLERGENS.map((a) => chip(t(`onb.${a}`), allergies.includes(a), () => toggleAllergy(a)))}
              </View>
            </View>
          ) : null}

          {step === 2
            ? EXPERIENCE.map((e) =>
                chip(e.label, experience === e.value, () => setExperience(experience === e.value ? '' : e.value)),
              )
            : null}
        </GlassCard>

        <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>
          {t('onb.privacy')}
        </Text>

        <AppButton
          label={step === 2 ? t('onb.finish') : t('onb.next')}
          variant="dark"
          style={{ marginTop: 14 }}
          busy={busy}
          onPress={() => (step === 2 ? void finish() : setStep((s) => (s + 1) as 0 | 1 | 2))}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          {step > 0 ? (
            <Pressable onPress={() => setStep((s) => (s - 1) as 0 | 1 | 2)} hitSlop={8}>
              <Text style={{ fontSize: 13.5, color: colors.textSecondary, fontWeight: '600' }}>{t('onb.back')}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => void finish()}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          >
            <SkipForward size={14} color={colors.accent} />
            <Text style={{ fontSize: 13.5, color: colors.accent, fontWeight: '700' }}>{t('onb.skip')}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          <Leaf size={13} color={colors.textSecondary} />
          <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>Spoonful</Text>
        </View>
      </ScrollView>
    </WashBackground>
  );
}

export default OnboardingScreen;
