import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Sparkles } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useConvexAuth } from '../lib/convex-auth';
import { addPendingOp } from '../lib/offline';
import { saveLocalPrefs } from '../lib/local-prefs';
import { isLocalTestActive } from '../lib/local-test';
import { DEFAULT_INTRO_ANSWERS, readIntroAnswers, type IntroAnswers } from '../lib/intro-answers';

const MARKER_KEY = 'spoonful:profile-refresh:v1';
const SEEN_KEY = 'spoonful:intro-seen';
const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'glutenFree', 'lactoseFree'];
const ALLERGENS = ['nuts', 'milk', 'gluten', 'eggs', 'soy', 'fish', 'shellfish'];
const EXPERIENCE = ['beginner', '1-2 years', '3-5 years', '5+ years', 'professional'];
const EXPERIENCE_KEYS: Record<string, string> = {
  beginner: 'onb.expStarted',
  '1-2 years': 'onb.exp1to2',
  '3-5 years': 'onb.exp3to5',
  '5+ years': 'onb.exp5plus',
  professional: 'onb.expPro',
};
const COOK_TIMES = ['15', '30', '45', '60'];
const CUISINES = ['cItalian', 'cAsian', 'cMexican', 'cIndian', 'cMiddleEast', 'cFrench'];
const PEOPLE = [1, 2, 3, 4, 5, 6];

type Step = 'intro' | 'diet' | 'allergies' | 'experience' | 'household' | 'time' | 'cuisines' | 'reminders' | 'done';
const FLOW: Step[] = ['diet', 'allergies', 'experience', 'household', 'time', 'cuisines', 'reminders', 'done'];

export function ProfileRefreshGate() {
  const { t, lang } = useTranslation();
  const { isAuthenticated } = useConvexAuth();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<IntroAnswers>(DEFAULT_INTRO_ANSWERS);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [marker, seen, stored] = await Promise.all([
          AsyncStorage.getItem(MARKER_KEY),
          AsyncStorage.getItem(SEEN_KEY),
          readIntroAnswers(),
        ]);
        if (!alive) return;
        if (stored) setAnswers({ ...DEFAULT_INTRO_ANSWERS, ...stored });
        const oldUser = seen === '1' && !isLocalTestActive();
        if (!marker && oldUser && isAuthenticated) setVisible(true);
      } catch {}
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const save = (patch: Partial<IntroAnswers>) => setAnswers((prev) => ({ ...prev, ...patch }));

  const toggleIn = (key: 'allergies' | 'cuisines', value: string) => {
    const list = answers[key];
    save({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] } as Partial<IntroAnswers>);
  };

  const dismiss = async (permanent: boolean) => {
    if (permanent) await AsyncStorage.setItem(MARKER_KEY, '1').catch(() => {});
    setVisible(false);
    setStep('intro');
  };

  const complete = async () => {
    await saveLocalPrefs({
      diet: answers.diet,
      allergies: answers.allergies,
      experience: answers.experience,
      householdSize: answers.householdSize,
      cookTime: answers.cookTime,
      cuisines: answers.cuisines,
    }).catch(() => {});
    await addPendingOp('profile.save', {
      goal: answers.goal || 'keep',
      diet: answers.diet,
      allergies: answers.allergies,
      cookingExperience: answers.experience || undefined,
      onboardedAt: Date.now(),
    }).catch(() => {});
    await dismiss(true);
  };

  const index = FLOW.indexOf(step);
  const total = FLOW.length;

  const copy = useMemo(() => {
    switch (step) {
      case 'diet':
        return { title: t('onb.dietTitle'), body: t('onb.dietDesc') };
      case 'allergies':
        return { title: t('onb.allergyTitle'), body: t('onb.allergyDesc') };
      case 'experience':
        return { title: t('onb.expTitle'), body: t('onb.expDesc') };
      case 'household':
        return { title: t('ob.householdTitle'), body: t('ob.householdBody') };
      case 'time':
        return { title: t('ob.timeTitle'), body: t('ob.timeBody') };
      case 'cuisines':
        return { title: t('ob.cuisineTitle'), body: t('ob.cuisineBody') };
      case 'reminders':
        return { title: t('ob.reminderTitle'), body: t('ob.reminderBody') };
      default:
        return { title: t('ob.reviewTitle'), body: t('ob.reviewBody') };
    }
  }, [step, t]);

  if (!ready || !visible) return null;

  if (step === 'intro') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => void dismiss(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: 24, padding: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                <Sparkles size={18} color={colors.accent} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.textPrimary }}>
                {lang === 'de' ? 'Deine Küche, neu auf dich abgestimmt' : 'Your kitchen, tuned to you'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 12 }}>
              {lang === 'de'
                ? 'Seit deinem Start sind neue Angaben dazugekommen: Allergien, Ernährung, Kocherfahrung, Haushaltsgröße und Kochzeit. Damit Rezepte, Bibliothek und KI-Koch wirklich zu dir passen, möchten wir sie einmal kurz mit dir ergänzen. Dauert etwa eine Minute, deine bisherigen Angaben bleiben erhalten.'
                : 'Since you started, new details were added: allergies, diet, cooking experience, household size and cooking time. So recipes, library and AI Chef really fit you, we would like to fill them in with you once. Takes about a minute, your existing answers stay.'}
            </Text>
            <Pressable
              onPress={() => { setStep('diet'); }}
              accessibilityRole="button"
              style={({ pressed }) => [{ marginTop: 18, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 14 }}>
                {lang === 'de' ? 'Jetzt ergänzen' : 'Update now'}
              </Text>
            </Pressable>
            <Pressable onPress={() => void dismiss(false)} accessibilityRole="button" style={{ marginTop: 10, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                {lang === 'de' ? 'Später' : 'Later'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => void dismiss(false)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
            {t('ob.progress', { n: index + 1, total })}
          </Text>
          <Pressable onPress={() => void dismiss(false)} hitSlop={10} accessibilityRole="button">
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{lang === 'de' ? 'Später' : 'Later'}</Text>
          </Pressable>
        </View>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceMuted, marginHorizontal: 20, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ height: 3, width: `${Math.round(((index + 1) / total) * 100)}%`, borderRadius: 2, backgroundColor: colors.accent }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>{copy.title}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 6 }}>{copy.body}</Text>

          <View style={{ marginTop: 18 }}>
            {step === 'diet' ? (
              <View style={{ gap: 8 }}>
                {[{ value: '', label: t('onb.none') }, ...DIETS.map((d) => ({ value: d, label: t(`onb.${d}`) }))].map((option) => {
                  const active = answers.diet === option.value;
                  return (
                    <Pressable
                      key={option.value || 'none'}
                      onPress={() => save({ diet: option.value })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 13 }}
                    >
                      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.textPrimary }}>{option.label}</Text>
                      {active ? <Check size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'allergies' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ALLERGENS.map((allergen) => {
                  const active = answers.allergies.includes(allergen);
                  return (
                    <Pressable
                      key={allergen}
                      onPress={() => toggleIn('allergies', allergen)}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 9 }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: active ? colors.accent : colors.textPrimary }}>{t(`onb.${allergen}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'experience' ? (
              <View style={{ gap: 8 }}>
                {EXPERIENCE.map((level) => {
                  const active = answers.experience === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => save({ experience: level })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 13 }}
                    >
                      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.textPrimary }}>{t(EXPERIENCE_KEYS[level])}</Text>
                      {active ? <Check size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'household' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PEOPLE.map((size) => {
                  const active = answers.householdSize === size;
                  return (
                    <Pressable
                      key={size}
                      onPress={() => save({ householdSize: size })}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 16, paddingVertical: 9 }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: active ? colors.accent : colors.textPrimary }}>{t('ob.people', { n: size })}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'time' ? (
              <View style={{ gap: 8 }}>
                {COOK_TIMES.map((minutes) => {
                  const active = answers.cookTime === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => save({ cookTime: minutes })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 13 }}
                    >
                      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.textPrimary }}>{t(`ob.time${minutes}`)}</Text>
                      {active ? <Check size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'cuisines' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CUISINES.map((cuisine) => {
                  const active = answers.cuisines.includes(cuisine);
                  return (
                    <Pressable
                      key={cuisine}
                      onPress={() => toggleIn('cuisines', cuisine)}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 9 }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: active ? colors.accent : colors.textPrimary }}>{t(`ob.${cuisine}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'reminders' ? (
              <View style={{ gap: 8 }}>
                {[true, false].map((value) => {
                  const active = answers.notifications === value;
                  return (
                    <Pressable
                      key={String(value)}
                      onPress={() => save({ notifications: value })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 13 }}
                    >
                      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.textPrimary }}>{t(value ? 'ob.reminderOn' : 'ob.reminderOff')}</Text>
                      {active ? <Check size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {step === 'done' ? (
              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
                {[
                  { label: t('onb.dietTitle'), value: answers.diet ? t(`onb.${answers.diet}`) : t('onb.none') },
                  { label: t('onb.allergyTitle'), value: answers.allergies.length ? answers.allergies.map((a) => t(`onb.${a}`)).join(', ') : t('onb.none') },
                  { label: t('onb.expTitle'), value: answers.experience ? t(EXPERIENCE_KEYS[answers.experience]) : t('onb.none') },
                  { label: t('ob.householdTitle'), value: t('ob.people', { n: answers.householdSize }) },
                  { label: t('ob.timeTitle'), value: answers.cookTime ? t(`ob.time${answers.cookTime}`) : t('onb.none') },
                ].map((row) => (
                  <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>{row.label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 22 }}>
          <Pressable
            onPress={() => setStep(index <= 0 ? 'intro' : FLOW[index - 1])}
            style={{ flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card }}
          >
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{t('s.xBack')}</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (step === 'done') void complete(); else setStep(FLOW[index + 1]); }}
            style={{ flex: 2, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton }}
          >
            <Text style={{ fontWeight: '800', color: colors.darkButtonText }}>
              {step === 'done' ? (lang === 'de' ? 'Fertig' : 'Done') : t('onb.next')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
