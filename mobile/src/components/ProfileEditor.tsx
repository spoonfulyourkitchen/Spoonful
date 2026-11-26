import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Alert } from '../lib/alert';
import { Check, X } from 'lucide-react-native';

import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { AppButton, Chip } from './ui';
import { DEFAULT_INTRO_ANSWERS, saveIntroAnswers, type IntroAnswers } from '../lib/intro-answers';
import { saveLocalPrefs } from '../lib/local-prefs';
import { goalTagFromOnboarding, setNutritionProfile, type Activity, type Sex } from '../lib/nutrition-profile';

const GOALS = ['lose', 'keep', 'gain'];
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

export function ProfileEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang } = useTranslation();
  const profile = useQuery(api.users.currentUser) as any;
  const saveProfile = useMutation(api.users.saveProfile);

  const [name, setName] = useState('');
  const [water, setWater] = useState('');
  const [goal, setGoal] = useState('keep');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('75');
  const [targetWeight, setTargetWeight] = useState('0');
  const [activity, setActivity] = useState<Activity>(3);
  const [diet, setDiet] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [householdSize, setHouseholdSize] = useState(2);
  const [cookTime, setCookTime] = useState('');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    const raw = profile.onboarding && typeof profile.onboarding === 'object' ? profile.onboarding : {};
    const answers: IntroAnswers = { ...DEFAULT_INTRO_ANSWERS, ...raw };
    setName(String(profile.name ?? answers.name ?? ''));
    setWater(profile.waterGoalMl ? String(profile.waterGoalMl) : '');
    const savedGoal = String(profile.goal ?? answers.goal ?? 'keep');
    setGoal(savedGoal === 'maintain' ? 'keep' : savedGoal);
    setSex(answers.sex === 'female' ? 'female' : 'male');
    setAge(String(answers.age ?? 30));
    setHeight(String(answers.height ?? 175));
    setWeight(String(answers.weight ?? 75));
    setTargetWeight(String(answers.targetWeight ?? 0));
    setActivity((answers.activity === 1 || answers.activity === 2 || answers.activity === 4 ? answers.activity : 3) as Activity);
    setDiet(String(profile.diet ?? answers.diet ?? ''));
    setAllergies(Array.isArray(profile.allergies) ? profile.allergies : answers.allergies ?? []);
    setExperience(String(profile.cookingExperience ?? answers.experience ?? ''));
    setHouseholdSize(Number(answers.householdSize) || 2);
    setCookTime(String(answers.cookTime ?? ''));
    setCuisines(Array.isArray(answers.cuisines) ? answers.cuisines : []);
    setNotifications(answers.notifications !== false);
  }, [visible, profile]);

  const num = (value: string, fallback: number, min: number, max: number) => {
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };

  const save = async () => {
    setBusy(true);
    try {
      const completedAt = Number(profile?.onboarding?.completedAt) || Number(profile?.onboardedAt) || Date.now();
      const answers: IntroAnswers = {
        ...DEFAULT_INTRO_ANSWERS,
        ...(profile?.onboarding && typeof profile.onboarding === 'object' ? profile.onboarding : {}),
        name: name.trim(),
        goal,
        diet,
        allergies,
        experience,
        sex,
        age: Math.round(num(age, 30, 14, 99)),
        height: Math.round(num(height, 175, 120, 230)),
        weight: Math.round(num(weight, 75, 30, 300) * 10) / 10,
        targetWeight: Math.round(num(targetWeight, 0, 0, 300) * 10) / 10,
        activity,
        householdSize,
        cookTime,
        cuisines,
        notifications,
        completedAt,
      };
      const waterGoalMl = Number(water) > 0 ? Math.round(Number(water)) : undefined;
      await saveProfile({
        name: name.trim(),
        goal,
        diet,
        allergies,
        cookingExperience: experience,
        waterGoalMl,
        onboardedAt: completedAt,
        onboarding: answers,
        prefs: { ...(profile?.prefs ?? {}), startedAt: Number(profile?.prefs?.startedAt) || completedAt },
      });
      await saveLocalPrefs({
        name: name.trim(),
        goal,
        diet,
        allergies,
        experience,
        householdSize,
        cookTime,
        cuisines,
        ...(waterGoalMl ? { waterGoalMl } : {}),
      }).catch(() => {});
      await saveIntroAnswers(answers).catch(() => {});
      setNutritionProfile({
        sex,
        age: answers.age,
        height: answers.height,
        weight: answers.weight,
        activity,
        goal: goalTagFromOnboarding(goal),
        targetWeight: answers.targetWeight || undefined,
        syncedAt: completedAt,
      });
      await AsyncStorage.setItem('spoonful:want-reminders', notifications ? '1' : '0').catch(() => {});
      onClose();
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const L = (de: string, en: string) => (lang === 'de' ? de : en);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' }}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
                  {L('Dein Profil', 'Your profile')}
                </Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginBottom: 14 }}>
                {L(
                  'Alles aus dem Onboarding an einem Ort. Änderungen gelten für Tagesplan, Bibliothek und KI-Chef.',
                  'Everything from onboarding in one place. Changes apply to your daily plan, library and AI Chef.',
                )}
              </Text>

              <Field label={t('s.profileName')} value={name} onChangeText={setName} />
              <Field label={t('s.profileWater')} value={water} onChangeText={setWater} keyboardType="number-pad" hint={L('in ml, z. B. 2500', 'in ml, e.g. 2500')} />

              <Section title={t('s.profileGoal')}>
                <View style={chips}>
                  {GOALS.map((value) => (
                    <Chip
                      key={value}
                      label={value === 'lose' ? t('onb.lose') : value === 'gain' ? t('onb.gain') : t('onb.keep')}
                      active={goal === value}
                      onPress={() => setGoal(value)}
                    />
                  ))}
                </View>
              </Section>

              <Section title={t('ob.sexTitle')}>
                <View style={chips}>
                  <Chip label={t('ob.male')} active={sex === 'male'} onPress={() => setSex('male')} />
                  <Chip label={t('ob.female')} active={sex === 'female'} onPress={() => setSex('female')} />
                </View>
              </Section>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label={t('ob.ageTitle')} value={age} onChangeText={setAge} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label={t('ob.heightTitle')} value={height} onChangeText={setHeight} keyboardType="number-pad" /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label={t('ob.weightTitle')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label={t('ob.targetTitle')} value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" /></View>
              </View>

              <Section title={t('ob.activityTitle')}>
                <View style={chips}>
                  {([1, 2, 3, 4] as Activity[]).map((level) => (
                    <Chip key={level} label={t(`ob.act${level}`)} active={activity === level} onPress={() => setActivity(level)} />
                  ))}
                </View>
              </Section>

              <Section title={t('onb.dietTitle')}>
                <View style={chips}>
                  <Chip label={t('onb.none')} active={diet === ''} onPress={() => setDiet('')} />
                  {DIETS.map((value) => (
                    <Chip key={value} label={t(`onb.${value}`)} active={diet === value} onPress={() => setDiet(value)} />
                  ))}
                </View>
              </Section>

              <Section title={t('onb.allergyTitle')}>
                <View style={chips}>
                  {ALLERGENS.map((value) => (
                    <Chip key={value} label={t(`onb.${value}`)} active={allergies.includes(value)} onPress={() => toggle(allergies, value, setAllergies)} />
                  ))}
                </View>
              </Section>

              <Section title={t('onb.expTitle')}>
                <View style={chips}>
                  {EXPERIENCE.map((value) => (
                    <Chip key={value} label={t(EXPERIENCE_KEYS[value])} active={experience === value} onPress={() => setExperience(value)} />
                  ))}
                </View>
              </Section>

              <Section title={t('ob.householdTitle')}>
                <View style={chips}>
                  {PEOPLE.map((size) => (
                    <Chip key={size} label={t('ob.people', { n: size })} active={householdSize === size} onPress={() => setHouseholdSize(size)} />
                  ))}
                </View>
              </Section>

              <Section title={t('ob.timeTitle')}>
                <View style={chips}>
                  {COOK_TIMES.map((minutes) => (
                    <Chip key={minutes} label={t(`ob.time${minutes}`)} active={cookTime === minutes} onPress={() => setCookTime(minutes)} />
                  ))}
                </View>
              </Section>

              <Section title={t('ob.cuisineTitle')}>
                <View style={chips}>
                  {CUISINES.map((value) => (
                    <Chip key={value} label={t(`ob.${value}`)} active={cuisines.includes(value)} onPress={() => toggle(cuisines, value, setCuisines)} />
                  ))}
                </View>
              </Section>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 6 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{t('ob.reminderTitle')}</Text>
                <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.surfaceMuted, true: colors.accent }} thumbColor="#fff" />
              </View>

              <AppButton
                label={t('s.profileSave')}
                variant="dark"
                busy={busy}
                icon={<Check size={17} color={colors.darkButtonText} />}
                style={{ marginTop: 18 }}
                onPress={() => void save()}
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={label}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label: text,
  value,
  onChangeText,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  hint?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={label}>{text}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={colors.textSecondary}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 }}
      />
      {hint ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>{hint}</Text> : null}
    </View>
  );
}

const label = { fontSize: 11.5, fontWeight: '700' as const, color: colors.textSecondary, marginBottom: 6 };
const chips = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 };

export default ProfileEditor;
