import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts, readableText } from '../theme';
import { useTranslation } from '../lib/i18n';
import { navigate } from '../navigation/rootRef';
import { completeLocalTest, useLocalTestStage } from '../lib/local-test';
import { ensureStartedAt, saveLocalPrefs } from '../lib/local-prefs';
import {
  DEFAULT_INTRO_ANSWERS,
  readIntroAnswers,
  saveIntroAnswers,
  type IntroAnswers,
} from '../lib/intro-answers';
import {
  computeTargets,
  goalTagFromOnboarding,
  setNutritionProfile,
  waterGoalFor,
  type Activity,
  type Sex,
} from '../lib/nutrition-profile';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';

const SEEN_KEY = 'spoonful:intro-seen';
const ENTRY_KEY = 'spoonful:auth-entry';
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

type StepId =
  | 'welcome'
  | 'name'
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
  | 'review';

export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const showIntro = Boolean((route.params as any)?.showIntro);
  const localTest = useLocalTestStage();
  const { t, rtl } = useTranslation();
  const [answers, setAnswers] = useState<IntroAnswers>(DEFAULT_INTRO_ANSWERS);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [heightText, setHeightText] = useState('175');
  const [weightText, setWeightText] = useState('75');

  const head = useRef(new Animated.Value(0)).current;
  const body = useRef(new Animated.Value(0)).current;
  const foot = useRef(new Animated.Value(0)).current;

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['welcome', 'name', 'goal', 'sex', 'age', 'height', 'weight', 'activity'];
    if (answers.goal && answers.goal !== 'keep') list.push('target');
    list.push('diet', 'allergies', 'experience', 'household', 'time', 'cuisines', 'reminders', 'review');
    return list;
  }, [answers.goal]);

  const step = steps[Math.min(index, steps.length - 1)];
  const total = steps.length;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    void (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      const entry = await AsyncStorage.getItem(ENTRY_KEY).catch(() => null);
      const stored = await readIntroAnswers().catch(() => null);
      if (seen === '1' && !showIntro) {
        navigate('Auth', { register: entry ? entry === 'register' : Boolean(stored?.completedAt) });
        return;
      }
      if (stored) {
        setAnswers({ ...DEFAULT_INTRO_ANSWERS, ...stored });
        setHeightText(String(stored.height));
        setWeightText(String(stored.weight));
      }
      setReady(true);
    })();
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro) return;
    setIndex(0);
    navigation.setParams({ showIntro: false } as any);
  }, [showIntro, navigation]);

  useEffect(() => {
    const values = [head, body, foot];
    values.forEach((v) => v.stopAnimation());
    if (reduceMotion) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    values.forEach((v) => v.setValue(0));
    Animated.stagger(
      70,
      values.map((v) =>
        Animated.spring(v, { toValue: 1, damping: 15, stiffness: 150, mass: 0.7, useNativeDriver: true }),
      ),
    ).start();
  }, [index, reduceMotion, head, body, foot]);

  const save = (patch: Partial<IntroAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      void saveIntroAnswers(next).catch(() => {});
      return next;
    });
  };

  const commitHeight = (raw: string) => {
    setHeightText(raw);
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n >= 120 && n <= 230) save({ height: Math.round(n) });
  };

  const commitWeight = (raw: string) => {
    setWeightText(raw);
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n >= 30 && n <= 300) save({ weight: Math.round(n * 10) / 10 });
  };

  const bump = (key: 'height' | 'weight', delta: number) => {
    const current = key === 'height' ? answers.height : answers.weight;
    const next = Math.max(key === 'height' ? 120 : 30, Math.min(key === 'height' ? 230 : 300, current + delta));
    if (key === 'height') {
      setHeightText(String(Math.round(next)));
      save({ height: Math.round(next) });
    } else {
      setWeightText(String(Math.round(next * 10) / 10));
      save({ weight: Math.round(next * 10) / 10 });
    }
  };

  const toggleIn = (key: 'allergies' | 'cuisines', value: string) => {
    const list = answers[key];
    save({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] } as Partial<IntroAnswers>);
  };

  const finish = async (register: boolean) => {
    await saveIntroAnswers({ ...answers, completedAt: register ? Date.now() : 0 }).catch(() => {});
    await AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    await AsyncStorage.setItem(ENTRY_KEY, register ? 'register' : 'login').catch(() => {});
    await ensureStartedAt().catch(() => 0);
    await AsyncStorage.setItem('spoonful:profile-refresh:v2', '1').catch(() => {});
    await saveLocalPrefs({
      name: answers.name,
      goal: answers.goal,
      diet: answers.diet,
      allergies: answers.allergies,
      experience: answers.experience,
      householdSize: answers.householdSize,
      cookTime: answers.cookTime,
      cuisines: answers.cuisines,
    }).catch(() => {});
    setNutritionProfile({
      sex: answers.sex,
      age: answers.age,
      height: answers.height,
      weight: answers.weight,
      activity: answers.activity,
      goal: goalTagFromOnboarding(answers.goal),
      targetWeight: answers.targetWeight || undefined,
      syncedAt: Date.now(),
    });
    if (localTest === 'onboarding') {
      await completeLocalTest();
      return;
    }
    navigate('Auth', { register });
  };

  const next = () => {
    if (index >= total - 1) {
      void finish(true);
      return;
    }
    setIndex(index + 1);
  };

  const back = () => {
    if (index === 0) return;
    setIndex(index - 1);
  };

  const canContinue = (() => {
    if (step === 'name') return answers.name.trim().length > 1;
    if (step === 'goal') return !!answers.goal;
    if (step === 'time') return !!answers.cookTime;
    if (step === 'height') return answers.height >= 120 && answers.height <= 230;
    if (step === 'weight') return answers.weight >= 30 && answers.weight <= 300;
    return true;
  })();

  const allergens = useMemo(
    () => (answers.diet === 'vegan' ? ALLERGENS.filter((a) => a !== 'milk' && a !== 'eggs') : ALLERGENS),
    [answers.diet],
  );

  const targetProfile = useMemo(
    () => ({
      sex: answers.sex,
      age: answers.age,
      height: answers.height,
      weight: answers.weight,
      activity: answers.activity,
      goal: goalTagFromOnboarding(answers.goal),
    }),
    [answers],
  );
  const targets = useMemo(() => computeTargets(targetProfile), [targetProfile]);
  const water = useMemo(() => waterGoalFor(targetProfile), [targetProfile]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const copy = (() => {
    switch (step) {
      case 'name': return { title: t('onb.nameTitle'), body: t('onb.nameBody') };
      case 'goal': return { title: t('onb.goalTitle'), body: t('onb.goalDesc') };
      case 'sex': return { title: t('ob.sexTitle'), body: t('ob.sexBody') };
      case 'age': return { title: t('ob.ageTitle'), body: t('ob.ageBody') };
      case 'height': return { title: t('ob.heightTitle'), body: t('ob.heightBody') };
      case 'weight': return { title: t('ob.weightTitle'), body: t('ob.weightBody') };
      case 'activity': return { title: t('ob.activityTitle'), body: t('ob.activityBody') };
      case 'target': return { title: t('ob.targetTitle'), body: t('ob.targetBody') };
      case 'diet': return { title: t('onb.dietTitle'), body: t('onb.dietDesc') };
      case 'allergies': return { title: t('onb.allergyTitle'), body: t('onb.allergyDesc') };
      case 'experience': return { title: t('onb.expTitle'), body: t('onb.expDesc') };
      case 'household': return { title: t('ob.householdTitle'), body: t('ob.householdBody') };
      case 'time': return { title: t('ob.timeTitle'), body: t('ob.timeBody') };
      case 'cuisines': return { title: t('ob.cuisineTitle'), body: t('ob.cuisineBody') };
      case 'reminders': return { title: t('ob.reminderTitle'), body: t('ob.reminderBody') };
      case 'review': return { title: t('ob.reviewTitle'), body: t('ob.reviewBody') };
      default: return { title: t('onb.welcome'), body: t('onb.intro') };
    }
  })();

  const targetDelta = (kg: number) => {
    const sign = answers.goal === 'gain' ? 1 : -1;
    save({ targetWeight: Math.max(40, Math.round((answers.weight + sign * kg) * 10) / 10) });
  };

  const options = (() => {
    if (step === 'welcome') {
      return (
        <View style={{ gap: 12, marginTop: 4 }}>
          {[t('ob.autosave'), t('ob.bodyNote'), t('onb.privacy')].map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={welcomeDot}><Check size={13} color={colors.accent} strokeWidth={3} /></View>
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary }}>{line}</Text>
            </View>
          ))}
        </View>
      );
    }
    if (step === 'name') {
      return (
        <TextInput
          value={answers.name}
          onChangeText={(v) => save({ name: v })}
          placeholder={t('onb.namePh')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={40}
          style={{
            minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder,
            backgroundColor: colors.card, paddingHorizontal: 16, fontSize: 18,
            fontWeight: '600', color: colors.textPrimary,
          }}
        />
      );
    }
    if (step === 'goal') {
      return (
        <View>
          <Option label={t('onb.lose')} hint={t('ob.goalHintLose')} active={answers.goal === 'lose'} onPress={() => save({ goal: 'lose' })} rtl={rtl} />
          <Option label={t('onb.keep')} hint={t('ob.goalHintKeep')} active={answers.goal === 'keep'} onPress={() => save({ goal: 'keep' })} rtl={rtl} />
          <Option label={t('onb.gain')} hint={t('ob.goalHintGain')} active={answers.goal === 'gain'} onPress={() => save({ goal: 'gain' })} rtl={rtl} />
        </View>
      );
    }
    if (step === 'sex') {
      return (
        <View>
          <Option label={t('ob.male')} active={answers.sex === 'male'} onPress={() => save({ sex: 'male' as Sex })} rtl={rtl} />
          <Option label={t('ob.female')} active={answers.sex === 'female'} onPress={() => save({ sex: 'female' as Sex })} rtl={rtl} />
        </View>
      );
    }
    if (step === 'age') {
      return (
        <Counter
          value={String(answers.age)}
          unit={t('ob.years')}
          onChange={(v) => {
            const n = Number(v);
            if (Number.isFinite(n)) save({ age: Math.min(99, Math.max(14, Math.round(n))) });
          }}
          onBump={(d) => save({ age: Math.min(99, Math.max(14, answers.age + d)) })}
        />
      );
    }
    if (step === 'height') {
      return <Counter value={heightText} unit={t('ob.cm')} onChange={commitHeight} onBump={(d) => bump('height', d)} />;
    }
    if (step === 'weight') {
      return <Counter value={weightText} unit={t('ob.kg')} onChange={commitWeight} onBump={(d) => bump('weight', d * 0.5)} />;
    }
    if (step === 'activity') {
      return (
        <View>
          {([1, 2, 3, 4] as Activity[]).map((level) => (
            <Option key={level} label={t(`ob.act${level}`)} active={answers.activity === level} onPress={() => save({ activity: level })} rtl={rtl} />
          ))}
        </View>
      );
    }
    if (step === 'target') {
      const current = answers.targetWeight || answers.weight;
      return (
        <View>
          <View style={targetCard}>
            <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>
              {current}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('ob.kg')}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {(answers.goal === 'gain' ? [2, 5, 8] : [2, 5, 10]).map((kg) => (
              <Chip key={kg} label={`${answers.goal === 'gain' ? '+' : '-'}${kg} ${t('ob.kg')}`} active={Math.abs(current - (answers.weight + (answers.goal === 'gain' ? kg : -kg))) < 0.2} onPress={() => targetDelta(kg)} />
            ))}
          </View>
        </View>
      );
    }
    if (step === 'diet') {
      return (
        <View>
          <Option label={t('onb.none')} active={answers.diet === ''} onPress={() => save({ diet: '' })} rtl={rtl} />
          {DIETS.map((diet) => (
            <Option key={diet} label={t(`onb.${diet}`)} active={answers.diet === diet} onPress={() => save({ diet })} rtl={rtl} />
          ))}
        </View>
      );
    }
    if (step === 'allergies') {
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {allergens.map((allergen) => (
            <Chip key={allergen} label={t(`onb.${allergen}`)} active={answers.allergies.includes(allergen)} onPress={() => toggleIn('allergies', allergen)} />
          ))}
        </View>
      );
    }
    if (step === 'experience') {
      return (
        <View>
          {EXPERIENCE.map((level) => (
            <Option key={level} label={t(EXPERIENCE_KEYS[level])} active={answers.experience === level} onPress={() => save({ experience: level })} rtl={rtl} />
          ))}
        </View>
      );
    }
    if (step === 'household') {
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((size) => (
            <Chip key={size} label={t('ob.people', { n: size })} active={answers.householdSize === size} onPress={() => save({ householdSize: size })} />
          ))}
        </View>
      );
    }
    if (step === 'time') {
      return (
        <View>
          {COOK_TIMES.map((minutes) => (
            <Option key={minutes} label={t(`ob.time${minutes}`)} active={answers.cookTime === minutes} onPress={() => save({ cookTime: minutes })} rtl={rtl} />
          ))}
        </View>
      );
    }
    if (step === 'cuisines') {
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CUISINES.map((cuisine) => (
            <Chip key={cuisine} label={t(`ob.${cuisine}`)} active={answers.cuisines.includes(cuisine)} onPress={() => toggleIn('cuisines', cuisine)} />
          ))}
        </View>
      );
    }
    if (step === 'reminders') {
      return (
        <View>
          <Option label={t('ob.reminderOn')} active={answers.notifications} onPress={() => save({ notifications: true })} rtl={rtl} />
          <Option label={t('ob.reminderOff')} active={!answers.notifications} onPress={() => save({ notifications: false })} rtl={rtl} />
        </View>
      );
    }
    if (step === 'review') {
      const rows = [
        { label: t('onb.goalTitle'), value: t(`onb.${answers.goal || 'keep'}`) },
        { label: t('ob.sexTitle'), value: answers.sex === 'female' ? t('ob.female') : t('ob.male') },
        { label: t('ob.ageTitle'), value: `${answers.age} ${t('ob.years')}` },
        { label: t('ob.heightTitle'), value: `${answers.height} ${t('ob.cm')}` },
        { label: t('ob.weightTitle'), value: `${answers.weight} ${t('ob.kg')}` },
        { label: t('onb.dietTitle'), value: answers.diet ? t(`onb.${answers.diet}`) : t('onb.none') },
        { label: t('ob.householdTitle'), value: t('ob.people', { n: answers.householdSize }) },
      ];
      return (
        <View>
          <View style={reviewCard}>
            {rows.map((row) => (
              <View key={row.label} style={{ flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ fontSize: 13.5, color: colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>{row.label}</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, flexShrink: 0 }} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </View>
          <View style={planCard}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: colors.accent }}>{t('ob.planTitle')}</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: colors.textPrimary, marginTop: 6 }}>{t('ob.kcalDay', { n: targets.budget })}</Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 4 }}>
              {t('ob.waterDay', { n: water })}
              {'  '}
              {t('ob.proteinDay', { n: targets.protein })}
            </Text>
            <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.textSecondary, marginTop: 8 }}>{t('ob.reviewNote')}</Text>
          </View>
        </View>
      );
    }
    return null;
  })();

  return (
    <WashBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size={26} />
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.2 }}>spoonful</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
              {t('ob.progress', { n: index + 1, total })}
            </Text>
            <Pressable onPress={() => void finish(false)} hitSlop={12} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{t('onb.skip')}</Text>
            </Pressable>
          </View>

          <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceMuted, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ height: 3, width: `${Math.round(((index + 1) / total) * 100)}%`, borderRadius: 2, backgroundColor: colors.accent }} />
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingTop: 22, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={fade(head)}>
              <Text style={heading}>{copy.title}</Text>
              <Text style={bodyText}>{copy.body}</Text>
            </Animated.View>
            <Animated.View style={[{ marginTop: 22 }, fade(body)]}>{options}</Animated.View>
          </ScrollView>

          <Animated.View style={fade(foot, 10)}>
            <Pressable
              accessibilityRole="button"
              disabled={!canContinue}
              onPress={next}
              style={({ pressed }) => [
                primaryBtn,
                { backgroundColor: colors.darkButton, opacity: !canContinue ? 0.35 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 16 }}>
                {step === 'review' ? t('ob.accountCta') : step === 'welcome' ? t('ob.start') : t('onb.next')}
              </Text>
              <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                <ArrowRight size={18} color={colors.darkButtonText} />
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, minHeight: 44 }}>
              {index > 0 ? (
                <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                  <ArrowLeft size={15} color={colors.textSecondary} />
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.textSecondary }}>{t('onb.back')}</Text>
                </Pressable>
              ) : <View />}
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('ob.autosave')}</Text>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </WashBackground>
  );
}

const heading = {
  fontFamily: fonts.display,
  fontSize: 27,
  lineHeight: 34,
  fontWeight: '800' as const,
  letterSpacing: -0.6,
  color: colors.textPrimary,
};
const bodyText = { fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 8, maxWidth: 340 };
const primaryBtn = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 9,
  minHeight: 54,
  borderRadius: 999,
  paddingVertical: 15,
};
const welcomeDot = {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: colors.accentSoft,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: 1,
};
const targetCard = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingVertical: 18,
  marginBottom: 16,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  backgroundColor: colors.card,
};
const reviewCard = {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  backgroundColor: colors.card,
  padding: 16,
  gap: 10,
};
const planCard = {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.accentBorder,
  backgroundColor: colors.accentSoft,
  padding: 16,
  marginTop: 12,
};

const fade = (value: Animated.Value, distance = 14) => ({
  opacity: value,
  transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
});

function Option({
  label,
  hint,
  active,
  onPress,
  rtl,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onPress: () => void;
  rtl?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [
        {
          minHeight: 54,
          flexDirection: rtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 8,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        active
          ? { borderColor: colors.accent, backgroundColor: colors.accentSoft }
          : { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
        {hint ? (
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 3 }}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: active ? colors.accent : colors.cardBorder,
          backgroundColor: active ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Check size={13} color={readableText(colors.accent)} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          minHeight: 44,
          justifyContent: 'center',
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 10,
          opacity: pressed ? 0.8 : 1,
        },
        active
          ? { borderColor: colors.accent, backgroundColor: colors.accentSoft }
          : { borderColor: colors.cardBorder, backgroundColor: colors.card },
      ]}
    >
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: active ? '800' : '600',
          color: active ? colors.accent : colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Counter({
  value,
  unit,
  onChange,
  onBump,
}: {
  value: string;
  unit: string;
  onChange: (raw: string) => void;
  onBump: (delta: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Pressable
        onPress={() => onBump(-1)}
        accessibilityRole="button"
        accessibilityLabel="minus"
        style={({ pressed }) => [circleBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={minusPlus}>-</Text>
      </Pressable>
      <View style={{ alignItems: 'center', minWidth: 120 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={5}
          selectTextOnFocus
          style={{
            fontSize: 46,
            fontWeight: '800',
            letterSpacing: -1,
            color: colors.textPrimary,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
            padding: 0,
            minWidth: 110,
          }}
        />
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{unit}</Text>
      </View>
      <Pressable
        onPress={() => onBump(1)}
        accessibilityRole="button"
        accessibilityLabel="plus"
        style={({ pressed }) => [circleBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={minusPlus}>+</Text>
      </Pressable>
    </View>
  );
}

const circleBtn = {
  width: 52,
  height: 52,
  borderRadius: 26,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  backgroundColor: colors.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const minusPlus = { fontSize: 26, fontWeight: '700' as const, color: colors.textPrimary, lineHeight: 30 };

export default LandingScreen;
