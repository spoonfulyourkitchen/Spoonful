import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../lib/i18n';
import { colors, fonts } from '../theme';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { clearIntroAnswers, readIntroAnswers } from '../lib/intro-answers';
import { ensureStartedAt, saveLocalPrefs } from '../lib/local-prefs';
import { addWeightLocal } from '../lib/tracker-local';
import {
  goalTagFromOnboarding,
  setNutritionProfile,
  waterGoalFor,
  type NutritionProfile,
} from '../lib/nutrition-profile';
import { addPendingOp, flushPendingOps, getConnNow } from '../lib/offline';
import { markLocalOnboarded } from '../lib/onboarding';
import { requestNotifications, applyReminders } from '../lib/notifications';

export function OnboardingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!failed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [failed, pulse]);

  const apply = async () => {
    setFailed(false);
    try {
      const answers = await readIntroAnswers();
      const profile: NutritionProfile = {
        sex: answers?.sex ?? 'male',
        age: answers?.age ?? 30,
        height: answers?.height ?? 175,
        weight: answers?.weight ?? 75,
        activity: answers?.activity ?? 3,
        goal: goalTagFromOnboarding(answers?.goal ?? 'keep'),
      };
      const waterGoalMl = waterGoalFor(profile);
      setNutritionProfile({ ...profile, targetWeight: answers?.targetWeight || undefined });
      addWeightLocal(profile.weight);

      await addPendingOp('profile.save', {
        goal: answers?.goal || 'keep',
        diet: answers?.diet ?? '',
        allergies: answers?.allergies ?? [],
        cookingExperience: answers?.experience || undefined,
        onboardedAt: Date.now(),
        waterGoalMl,
      });
      await addPendingOp('tracker.weight.add', { kg: profile.weight, at: Date.now() });

      await ensureStartedAt().catch(() => 0);
      await AsyncStorage.setItem('spoonful:profile-refresh:v1', '1').catch(() => {});
      await saveLocalPrefs({
        name: answers?.name,
        goal: answers?.goal,
        diet: answers?.diet,
        allergies: answers?.allergies,
        experience: answers?.experience,
        householdSize: answers?.householdSize,
        cookTime: answers?.cookTime,
        cuisines: answers?.cuisines,
      }).catch(() => {});

      const wantsReminders = answers ? answers.notifications : true;
      void AsyncStorage.setItem('spoonful:want-reminders', wantsReminders ? '1' : '0').catch(() => {});
      if (wantsReminders) {
        void requestNotifications().then(() => applyReminders()).catch(() => {});
      }

      await clearIntroAnswers().catch(() => {});
      markLocalOnboarded();
      if (getConnNow() !== 'offline') void flushPendingOps();
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apply();
  }, []);

  return (
    <WashBackground>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Logo size={64} />
        <Text style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 12, textAlign: 'center', letterSpacing: -0.3 }}>
          {t('onb.planReady')}
        </Text>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
          {failed ? t('errors.connectionIssue') : t('onb.planReadyDesc')}
        </Text>
        {failed ? (
          <Pressable
            onPress={() => void apply()}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 18,
              minHeight: 48,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: colors.darkButton,
              paddingHorizontal: 24,
              paddingVertical: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 15 }}>{t('common.tryAgain')}</Text>
          </Pressable>
        ) : (
          <Animated.View style={{ marginTop: 18, opacity: pulse }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('common.loading')}</Text>
          </Animated.View>
        )}
      </View>
    </WashBackground>
  );
}

export default OnboardingScreen;
