import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Sparkles, X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { convexClient, useConvexAuth, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { addPendingOp } from '../lib/offline';
import { saveLocalPrefs } from '../lib/local-prefs';
import {
  DEFAULT_INTRO_ANSWERS,
  readIntroAnswers,
  saveIntroAnswers,
  type IntroAnswers,
} from '../lib/intro-answers';
import { goalTagFromOnboarding, setNutritionProfile, type Activity, type Sex } from '../lib/nutrition-profile';

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

type Step =
  | 'intro'
  | 'goal'
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'activity'
  | 'target'
  | 'diet'
  | 'allergies'
  | 'experience'
  | 'household'
  | 'time'
  | 'cuisines'
  | 'reminders'
  | 'done';

const FLOW: Step[] = [
  'goal',
  'sex',
  'age',
  'height',
  'weight',
  'activity',
  'target',
  'diet',
  'allergies',
  'experience',
  'household',
  'time',
  'cuisines',
  'reminders',
  'done',
];

export function ProfileRefreshGate() {
  const { t, lang } = useTranslation();
  const { isAuthenticated } = useConvexAuth();
  const due = useQuery(api.users.profileRefreshDue) as boolean | undefined;
  const [closed, setClosed] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<IntroAnswers>(DEFAULT_INTRO_ANSWERS);

  const visible = !closed && isAuthenticated && due === true;

  useEffect(() => {
    if (due === true) setClosed(false);
  }, [due]);

  useEffect(() => {
    void readIntroAnswers()
      .then((stored) => {
        if (stored) setAnswers({ ...DEFAULT_INTRO_ANSWERS, ...stored });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible || step !== 'intro') return;
    setCanClose(false);
    const timer = setTimeout(() => setCanClose(true), 12000);
    return () => clearTimeout(timer);
  }, [visible, step]);

  const save = (patch: Partial<IntroAnswers>) => setAnswers((prev) => ({ ...prev, ...patch }));

  const toggleIn = (key: 'allergies' | 'cuisines', value: string) => {
    const list = answers[key];
    save({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] } as Partial<IntroAnswers>);
  };

  const dismiss = () => {
    setClosed(true);
    setStep('intro');
  };

  const complete = async () => {
    await saveIntroAnswers({ ...answers, completedAt: Date.now() }).catch(() => {});
    await saveLocalPrefs({
      goal: answers.goal,
      diet: answers.diet,
      allergies: answers.allergies,
      experience: answers.experience,
      householdSize: answers.householdSize,
      cookTime: answers.cookTime,
      cuisines: answers.cuisines,
    }).catch(() => {});
    setNutritionProfile({
      goal: goalTagFromOnboarding(answers.goal),
      sex: answers.sex,
      age: answers.age,
      height: answers.height,
      weight: answers.weight,
      activity: answers.activity,
      targetWeight: answers.targetWeight || undefined,
      syncedAt: Date.now(),
    });
    const completedAt = Date.now();
    const onboarding = { ...answers, completedAt };
    await addPendingOp('profile.save', {
      name: answers.name || undefined,
      goal: answers.goal || 'keep',
      diet: answers.diet,
      allergies: answers.allergies,
      cookingExperience: answers.experience || undefined,
      onboardedAt: completedAt,
      onboarding,
      prefs: { startedAt: completedAt },
    }).catch(() => {});
    await convexClient.mutation(api.users.completeProfileRefresh as any, {}).catch(() => {});
    dismiss();
  };

  const index = FLOW.indexOf(step);
  const total = FLOW.length;

  const copy = useMemo(() => {
    switch (step) {
      case 'goal':
        return { title: t('onb.goalTitle'), body: t('onb.goalDesc') };
      case 'sex':
        return { title: t('ob.sexTitle'), body: t('ob.sexBody') };
      case 'age':
        return { title: t('ob.ageTitle'), body: t('ob.ageBody') };
      case 'height':
        return { title: t('ob.heightTitle'), body: t('ob.heightBody') };
      case 'weight':
        return { title: t('ob.weightTitle'), body: t('ob.weightBody') };
      case 'activity':
        return { title: t('ob.activityTitle'), body: t('ob.activityBody') };
      case 'target':
        return { title: t('ob.targetTitle'), body: t('ob.targetBody') };
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

  if (!visible) return null;

  if (step === 'intro') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => { if (canClose) dismiss(); }} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: 24, padding: 22 }}>
            {canClose ? (
              <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
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
                ? 'Seit deinem Start sind neue Angaben dazugekommen: Ziel, Körperdaten, Aktivität, Allergien, Ernährung, Kocherfahrung, Haushaltsgröße, Kochzeit und Küchen. Damit Tagesplan, Rezepte, Bibliothek und KI-Koch wirklich zu dir passen, fragen wir sie einmal komplett ab. Dein Name bleibt, deine bisherigen Antworten sind vorausgefüllt. Dauert etwa zwei Minuten.'
                : 'Since you started, new details were added: goal, body data, activity, allergies, diet, cooking experience, household size, cooking time and cuisines. So your daily plan, recipes, library and AI Chef really fit you, we ask for them once, complete. Your name stays, your existing answers are filled in. Takes about two minutes.'}
            </Text>
            <Pressable
              onPress={() => { setStep('goal'); }}
              accessibilityRole="button"
              style={({ pressed }) => [{ marginTop: 18, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 14 }}>
                {lang === 'de' ? 'Annehmen und ergänzen' : 'Accept and complete'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const optionRow = (label: string, active: boolean, onPress: () => void, hint?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {active ? <Check size={16} color={colors.accent} /> : null}
    </Pressable>
  );

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{ borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder, backgroundColor: active ? colors.accentSoft : colors.card, paddingHorizontal: 14, paddingVertical: 9 }}
    >
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: active ? colors.accent : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );

  const counter = (
    value: number,
    unit: string,
    stepSize: number,
    min: number,
    max: number,
    onChange: (next: number) => void,
    decimals = 0,
  ) => (
    <View style={{ alignItems: 'center', gap: 14, paddingTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, Math.round((value - stepSize) * 10) / 10))}
          accessibilityRole="button"
          style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>-</Text>
        </Pressable>
        <View style={{ alignItems: 'center', minWidth: 120 }}>
          <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
            {decimals ? value.toFixed(1).replace('.', ',') : String(Math.round(value))}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{unit}</Text>
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, Math.round((value + stepSize) * 10) / 10))}
          accessibilityRole="button"
          style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  const targetKg = answers.targetWeight || answers.weight;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
            {t('ob.progress', { n: index + 1, total })}
          </Text>
          <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button">
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
            {step === 'goal' ? (
              <View>
                {optionRow(t('onb.lose'), answers.goal === 'lose', () => save({ goal: 'lose' }), t('ob.goalHintLose'))}
                {optionRow(t('onb.keep'), answers.goal === 'keep', () => save({ goal: 'keep' }), t('ob.goalHintKeep'))}
                {optionRow(t('onb.gain'), answers.goal === 'gain', () => save({ goal: 'gain' }), t('ob.goalHintGain'))}
              </View>
            ) : null}

            {step === 'sex' ? (
              <View>
                {optionRow(t('ob.male'), answers.sex === 'male', () => save({ sex: 'male' as Sex }))}
                {optionRow(t('ob.female'), answers.sex === 'female', () => save({ sex: 'female' as Sex }))}
              </View>
            ) : null}

            {step === 'age' ? counter(answers.age, t('ob.years'), 1, 14, 99, (next) => save({ age: Math.round(next) })) : null}

            {step === 'height'
              ? counter(answers.height, t('ob.cm'), 1, 120, 230, (next) => save({ height: Math.round(next) }))
              : null}

            {step === 'weight'
              ? counter(answers.weight, t('ob.kg'), 0.5, 30, 300, (next) => save({ weight: Math.round(next * 10) / 10 }), 1)
              : null}

            {step === 'activity' ? (
              <View>
                {([1, 2, 3, 4] as Activity[]).map((level) =>
                  optionRow(t(`ob.act${level}`), answers.activity === level, () => save({ activity: level })),
                )}
              </View>
            ) : null}

            {step === 'target' ? (
              <View>
                {counter(targetKg, t('ob.kg'), 0.5, 30, 300, (next) => save({ targetWeight: Math.round(next * 10) / 10 }), 1)}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                  {(answers.goal === 'gain' ? [2, 5, 8] : [2, 5, 10]).map((kg) => {
                    const sign = answers.goal === 'gain' ? 1 : -1;
                    const value = Math.round((answers.weight + sign * kg) * 10) / 10;
                    return chip(
                      `t${kg}`,
                      `${sign > 0 ? '+' : '-'}${kg} ${t('ob.kg')}`,
                      Math.abs(targetKg - value) < 0.2,
                      () => save({ targetWeight: value }),
                    );
                  })}
                </View>
              </View>
            ) : null}

            {step === 'diet' ? (
              <View>
                {optionRow(t('onb.none'), answers.diet === '', () => save({ diet: '' }))}
                {DIETS.map((diet) => optionRow(t(`onb.${diet}`), answers.diet === diet, () => save({ diet })))}
              </View>
            ) : null}

            {step === 'allergies' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ALLERGENS.map((allergen) =>
                  chip(allergen, t(`onb.${allergen}`), answers.allergies.includes(allergen), () => toggleIn('allergies', allergen)),
                )}
              </View>
            ) : null}

            {step === 'experience' ? (
              <View>
                {EXPERIENCE.map((level) =>
                  optionRow(t(EXPERIENCE_KEYS[level]), answers.experience === level, () => save({ experience: level })),
                )}
              </View>
            ) : null}

            {step === 'household' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PEOPLE.map((size) => chip(`p${size}`, t('ob.people', { n: size }), answers.householdSize === size, () => save({ householdSize: size })))}
              </View>
            ) : null}

            {step === 'time' ? (
              <View>
                {COOK_TIMES.map((minutes) =>
                  optionRow(t(`ob.time${minutes}`), answers.cookTime === minutes, () => save({ cookTime: minutes })),
                )}
              </View>
            ) : null}

            {step === 'cuisines' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CUISINES.map((cuisine) =>
                  chip(cuisine, t(`ob.${cuisine}`), answers.cuisines.includes(cuisine), () => toggleIn('cuisines', cuisine)),
                )}
              </View>
            ) : null}

            {step === 'reminders' ? (
              <View>
                {optionRow(t('ob.reminderOn'), answers.notifications, () => save({ notifications: true }))}
                {optionRow(t('ob.reminderOff'), !answers.notifications, () => save({ notifications: false }))}
              </View>
            ) : null}

            {step === 'done' ? (
              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
                {[
                  { label: t('onb.goalTitle'), value: answers.goal === 'lose' ? t('onb.lose') : answers.goal === 'gain' ? t('onb.gain') : t('onb.keep') },
                  { label: t('ob.ageTitle'), value: `${answers.age} ${t('ob.years')}` },
                  { label: t('ob.heightTitle'), value: `${answers.height} ${t('ob.cm')}` },
                  { label: t('ob.weightTitle'), value: `${answers.weight} ${t('ob.kg')}` },
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
