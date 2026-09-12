import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, MapPin, Trophy } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Chip, GlassCard, SectionLabel } from './ui';
import { useTranslation } from '../lib/i18n';

/**
 * Community extras (2.0.0, items 161-180): cooking challenges (create + join)
 * and "near me" - a region stored in the profile, so the feed can sort by
 * proximity without asking for a GPS permission.
 */
const REGION_KEY = 'spoonful:region';

export function CommunityExtras() {
  const { t } = useTranslation();
  const challenges = useQuery(api.sharing.challenges) as any[] | undefined;
  const createChallenge = useMutation(api.sharing.createChallenge);
  const joinChallenge = useMutation(api.sharing.joinChallenge);
  const saveProfile = useMutation(api.users.saveProfile);
  const profile = useQuery(api.users.currentUser) as any;

  const [region, setRegion] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(REGION_KEY)
      .then((v) => {
        if (v) setRegion(v);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!region && profile?.region) setRegion(String(profile.region));
  }, [profile, region]);

  const saveRegion = async () => {
    const value = region.trim().slice(0, 40);
    try {
      await AsyncStorage.setItem(REGION_KEY, value);
      await saveProfile({ region: value });
      setRegionOpen(false);
      setNote(`${t('x.near')}: ${value}`);
    } catch {
      /* offline: the local value is used once the connection is back */
    }
  };


  const [open, setOpen] = useState(false);

  // Collapsed by default: just a thin line, so the feed scrolls without clutter.
  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2, paddingVertical: 4, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Trophy size={14} color={colors.textSecondary} />
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>{t('x.challenges')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
        <ChevronDown size={15} color={colors.textSecondary} />
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(false)}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 4, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Trophy size={14} color={colors.accent} />
        <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
        <ChevronUp size={15} color={colors.textSecondary} />
      </Pressable>
      <SectionLabel>{t('x.challenges')}</SectionLabel>
      <GlassCard pad={16} radius={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Trophy size={18} color={colors.accent} />
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.textPrimary }}>{t('x.challenges')}</Text>
          <Chip label={t('x.near')} active={!!region} onPress={() => setRegionOpen((v) => !v)} />
        </View>

        {regionOpen ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10 }}>
              <MapPin size={15} color={colors.textSecondary} />
              <TextInput
                value={region}
                onChangeText={setRegion}
                placeholder={t('x.region')}
                placeholderTextColor={colors.textSecondary}
                style={{ flex: 1, paddingVertical: 9, color: colors.textPrimary }}
              />
            </View>
            <Pressable
              onPress={() => void saveRegion()}
              style={{ height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.darkButton, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 12 }}>{t('common.save')}</Text>
            </Pressable>
          </View>
        ) : null}

        {(challenges ?? []).slice(0, 4).map((c: any) => (
          <View key={c._id} style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                {c.emoji ? `${c.emoji} ` : ''}
                {c.title}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                {c.entries} {t('x.entries')}
              </Text>
            </View>
            {c.description ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{c.description}</Text> : null}
            <Pressable
              onPress={() => void joinChallenge({ challengeId: c._id, userName: profile?.name ?? '' }).catch(() => {})}
              style={({ pressed }) => [{ marginTop: 8, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>{t('x.join')}</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('x.challengeTitle')}
              placeholderTextColor={colors.textSecondary}
              style={{ paddingVertical: 9, color: colors.textPrimary }}
            />
          </View>
          <Pressable
            onPress={() => {
              if (title.trim().length < 3) return;
              void createChallenge({ title: title.trim(), days: 14 })
                .then(() => setTitle(''))
                .catch(() => {});
            }}
            style={{ height: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{t('x.newChallenge')}</Text>
          </Pressable>
        </View>

        {note ? <Text style={{ fontSize: 12, color: colors.success, marginTop: 8 }}>{note}</Text> : null}
      </GlassCard>
    </>
  );
}
