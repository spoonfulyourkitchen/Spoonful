

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import { Check, X } from 'lucide-react-native';

import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { AppButton, Chip } from './ui';

const GOALS = ['lose', 'maintain', 'gain'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];

export function ProfileEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const profile = useQuery(api.users.currentUser) as any;
  const saveProfile = useMutation(api.users.saveProfile);

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [allergies, setAllergies] = useState('');
  const [water, setWater] = useState('');
  const [diet, setDiet] = useState('');
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    setName(String(profile.name ?? ''));
    setRegion(String(profile.region ?? ''));
    setAllergies((Array.isArray(profile.allergies) ? profile.allergies : []).join(', '));
    setWater(profile.waterGoalMl ? String(profile.waterGoalMl) : '');
    setDiet(String(profile.diet ?? ''));
    setGoal(String(profile.goal ?? ''));
    setExperience(String(profile.cookingExperience ?? ''));
  }, [visible, profile]);

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({
        name: name.trim(),
        region: region.trim(),
        diet: diet.trim(),
        goal: goal.trim(),
        cookingExperience: experience.trim(),
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
        waterGoalMl: Number(water) > 0 ? Math.round(Number(water)) : undefined,
      });
      onClose();
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
                  {t('s.profileTitle')}
                </Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>{t('s.profileSub')}</Text>

              <Field label={t('s.profileName')} value={name} onChangeText={setName} />
              <Field label={t('s.profileRegion')} value={region} onChangeText={setRegion} />
              <Field label={t('s.profileAllergies')} value={allergies} onChangeText={setAllergies} />
              <Field label={t('s.profileWater')} value={water} onChangeText={setWater} keyboardType="number-pad" />

              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginTop: 4, marginBottom: 6 }}>
                {t('s.profileGoal')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {GOALS.map((g) => (
                  <Chip key={g} label={t(`s.profileGoal_${g}`)} active={goal === g} onPress={() => setGoal(goal === g ? '' : g)} />
                ))}
              </View>

              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
                {t('s.profileExperience')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {EXPERIENCE.map((e) => (
                  <Chip key={e} label={t(`s.profileExp_${e}`)} active={experience === e} onPress={() => setExperience(experience === e ? '' : e)} />
                ))}
              </View>

              <AppButton
                label={t('s.profileSave')}
                variant="dark"
                busy={busy}
                icon={<Check size={17} color={colors.darkButtonText} />}
                style={{ marginTop: 20 }}
                onPress={() => void save()}
              />
            </ScrollView>
          </View>
        </View>
    
        </KeyboardAvoidingView></Modal>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; keyboardType?: 'default' | 'number-pad' }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={colors.textSecondary}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 }}
      />
    </View>
  );
}

export default ProfileEditor;
