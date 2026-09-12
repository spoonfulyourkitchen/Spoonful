import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Calculator, CalendarCheck2, Flame, Plus, Sparkles, Trash2, TrendingUp, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, readableText, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { AppButton, EmptyState, GlassCard, PageHeader, TextField } from '../components/ui';
import { TrackerExtras as TrackerPanel } from '../components/TrackerExtras';
import { useCachedList, OfflineBadge, addPendingOp } from '../lib/offline';
import { useTranslation } from '../lib/i18n';

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function parseNum(v: string): number | undefined {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}
function roundN(v: number) {
  return Math.round(v * 10) / 10;
}
/** Safe percentage for progress bars: never NaN/Infinity, always 0..100. */
function pctOf(value: number, goal: number): number {
  const v = Number(value);
  const g = Number(goal);
  if (!Number.isFinite(v) || !Number.isFinite(g) || g <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / g) * 100)));
}
/** Keeps profile input inside physically plausible ranges. */
function clamp(v: number, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

type Sex = 'male' | 'female';
type Activity = 1 | 2 | 3 | 4;
type GoalTag = 'cut' | 'maintain' | 'bulk';
type Profile = { sex: Sex; age: number; height: number; weight: number; activity: Activity; goal: GoalTag };

const PROFILE_KEY = 'spoonful:nutrition-profile';
const DEFAULT_PROFILE: Profile = { sex: 'male', age: 30, height: 175, weight: 75, activity: 3, goal: 'maintain' };
const ACTIVITY_FACTORS: Record<Activity, number> = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725 };

/** Mifflin-St Jeor BMR → TDEE → calorie budget + macro targets. */
function computeTargets(p: Profile) {
  // clamp first: a stray 0/NaN in the stored profile must not produce NaN goals
  const weight = clamp(p.weight, 30, 300, DEFAULT_PROFILE.weight);
  const height = clamp(p.height, 120, 230, DEFAULT_PROFILE.height);
  const age = clamp(p.age, 12, 100, DEFAULT_PROFILE.age);
  const factor = ACTIVITY_FACTORS[p.activity] ?? ACTIVITY_FACTORS[3];
  const base = 10 * weight + 6.25 * height - 5 * age;
  const bmr = p.sex === 'male' ? base + 5 : base - 161;
  const tdee = Math.round(bmr * factor);
  let budget = tdee;
  if (p.goal === 'cut') budget = tdee - 500;
  if (p.goal === 'bulk') budget = tdee + 350;
  budget = Math.max(1400, Math.min(6000, Math.round(budget / 50) * 50));
  const protein = Math.round(weight * (p.goal === 'maintain' ? 1.6 : 2));
  const fat = Math.max(45, Math.round((budget * 0.25) / 9));
  const carbs = Math.max(60, Math.round((budget - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee, budget, protein, fat, carbs };
}

export function TrackerScreen() {
  const entriesLive = useQuery(api.calorieEntries.list);
  const { data: entries, offline, apply } = useCachedList('tracker', entriesLive);
  const logManual = useMutation(api.calorieEntries.logManual);
  const removeEntry = useMutation(api.calorieEntries.remove);
  const { t } = useTranslation();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [ageT, setAgeT] = useState('');
  const [heightT, setHeightT] = useState('');
  const [weightT, setWeightT] = useState('');

  useEffect(() => {
    if (showProfile && hydrated) {
      setAgeT(String(profile.age));
      setHeightT(String(profile.height));
      setWeightT(String(profile.weight));
    }
  }, [showProfile, hydrated]);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p.sex === 'string') setProfile({ ...DEFAULT_PROFILE, ...p });
        } catch { /* ignore */ }
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const profileReady = hydrated ? profile : DEFAULT_PROFILE;
  const targets = computeTargets(profileReady);
  const kcalGoal = targets.budget;
  const proteinGoal = targets.protein;
  const carbsGoal = targets.carbs;
  const fatGoal = targets.fat;
  const goalLabel = profileReady.goal === 'cut' ? 'Cutting (deficit)' : profileReady.goal === 'bulk' ? 'Bulking (surplus)' : 'Maintaining';
  const activityLabel: Record<Activity, string> = { 1: 'Mostly sitting', 2: 'Lightly active', 3: 'Moderately active', 4: 'Very active' };

  const all = entries ?? [];
  const today = all.filter((e: any) => startOfDay(e.eatenAt) === startOfDay(Date.now()));
  const todayCal = today.reduce((s: number, e: any) => s + (e.calories ?? 0), 0);
  const todayProtein = roundN(today.reduce((s: number, e: any) => s + (e.protein ?? 0), 0));
  const todayCarbs = roundN(today.reduce((s: number, e: any) => s + (e.carbs ?? 0), 0));
  const todayFat = roundN(today.reduce((s: number, e: any) => s + (e.fat ?? 0), 0));

  const calPct = pctOf(todayCal, kcalGoal);
  const proteinPct = pctOf(todayProtein, proteinGoal);
  const carbsPct = pctOf(todayCarbs, carbsGoal);
  const fatPct = pctOf(todayFat, fatGoal);
  const remaining = Math.max(0, Math.round((kcalGoal - todayCal) * 10) / 10);

  const week: { day: number; cals: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = startOfDay(d.getTime());
    const cals = all.filter((e: any) => startOfDay(e.eatenAt) === key).reduce((s: number, e: any) => s + (e.calories ?? 0), 0);
    week.push({ day: key, cals });
  }
  const weekMax = Math.max(kcalGoal, ...week.map((w) => w.cals), 300);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = startOfDay(Date.now() - i * 86400000);
    const has = all.some((e: any) => startOfDay(e.eatenAt) === d && (e.calories ?? 0) > 0);
    if (!has) break;
    streak++;
  }

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError(t('s.trackNeedName')); return; }
    const calories = parseNum(kcal);
    const gramsP = parseNum(protein);
    const gramsC = parseNum(carbs);
    const gramsF = parseNum(fat);
    if (calories === undefined && gramsP === undefined && gramsC === undefined && gramsF === undefined) {
      setError(t('s.trackNeedNutr'));
      return;
    }
    const payload = { title: name.trim(), calories: calories ?? null, protein: gramsP ?? null, carbs: gramsC ?? null, fat: gramsF ?? null };
    if (offline) {
      apply((prev: any[]) => [{ _id: `tmp-${Date.now()}`, ...payload, eatenAt: Date.now() }, ...prev]);
      void addPendingOp('tracker.log', payload);
      setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat(''); setShowForm(false);
      Alert.alert(t('s.trackOfflineT'), t('s.trackOfflineB'));
      return;
    }
    setBusy(true);
    try {
      await logManual({ title: payload.title, calories, protein: gramsP, carbs: gramsC, fat: gramsF });
      setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat(''); setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log the meal.');
    } finally {
      setBusy(false);
    }
  };

  const del = (id: any) => {
    if (String(id).startsWith('tmp-')) {
      apply((prev: any[]) => prev.filter((e: any) => e._id !== id));
      return;
    }
    if (offline) {
      apply((prev: any[]) => prev.filter((e: any) => e._id !== id));
      void addPendingOp('tracker.remove', { id });
      return;
    }
    Alert.alert(t('s.trackRemoveT'), t('s.trackRemoveB'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('s.trackRemove'), style: 'destructive', onPress: () => { try { removeEntry({ id }); } catch { /* reactive */ } } },
    ]);
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PageHeader eyebrow={t('s.trackEyebrow')} title={t('tracker.title')} />
          </View>
          {offline ? <OfflineBadge /> : null}
          <Pressable onPress={() => setShowForm(true)} style={({ pressed }) => [{ marginBottom: 16, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>
              {t('tracker.logMeal')}
            </Text>
          </Pressable>
        </View>

        {/* 2.1.1: scanning and searching food is the first thing on the page */}
        <TrackerPanel />

        <GlassCard pad={16} radius={22}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Calculator size={16} color={colors.accent} strokeWidth={2.2} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.trackPlan')}</Text>
            <Pressable onPress={() => setShowProfile(true)} style={({ pressed }) => [{ borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6, opacity: pressed ? 0.75 : 1 }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{t('s.trackAdjust')}</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
            {goalLabel} · {activityLabel[profileReady.activity]}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 }}>{kcalGoal}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t('common.kcal')} {t('s.perDay')}</Text>
            <View style={{ flex: 1 }} />
            {streak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5 }}>
                <CalendarCheck2 size={13} color={colors.accent} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>{streak}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <MacroChip label="P" value={`${proteinGoal}g`} color={colors.success} bg={colors.successBg} />
            <MacroChip label="C" value={`${carbsGoal}g`} color={colors.cyan} bg={colors.cyanBg} />
            <MacroChip label="F" value={`${fatGoal}g`} color={colors.amber} bg={colors.mediumBg} />
            <Text style={{ fontSize: 10, color: colors.textSecondary, alignSelf: 'center' }}>BMR {targets.bmr} · TDEE {targets.tdee}</Text>
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.trackRemaining')}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: remaining < 150 && todayCal > 0 ? colors.rose : colors.success, marginTop: 2 }}>
                {remaining} kcal
              </Text>
            </View>
            {todayCal > 0 ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.trackEaten', { n: todayCal })}</Text> : null}
          </View>
          <View style={{ marginTop: 10, gap: 8 }}>
            <GoalBar label={`kcal · ${todayCal} / ${kcalGoal}`} pct={calPct} color={colors.accent} />
            <GoalBar label={`protein · ${todayProtein}g / ${proteinGoal}g`} pct={proteinPct} color={colors.success} />
            <GoalBar label={`carbs · ${todayCarbs}g / ${carbsGoal}g`} pct={carbsPct} color={colors.cyan} />
            <GoalBar label={`fat · ${todayFat}g / ${fatGoal}g`} pct={fatPct} color={colors.amber} />
          </View>
        </GlassCard>

        <MacroEnergyCard kcal={kcalGoal} p={proteinGoal} c={carbsGoal} f={fatGoal} tp={todayProtein} tc={todayCarbs} tf={todayFat} />

        {/* 2.1.1: opens as a popup instead of appearing further down the page. */}
        <Modal visible={showProfile} transparent animationType="slide" onRequestClose={() => setShowProfile(false)} statusBarTranslucent>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlayStrong }}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowProfile(false)} />
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%' }}>
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>{t('s.trackProfile')}</Text>
                  <Pressable onPress={() => setShowProfile(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                    <X size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>{t('s.trackProfileSub')}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>{t('s.trackFormula')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextField label={t('s.trackAge')} value={ageT} onChangeText={(v) => { setAgeT(v); const n = Number(v); if (Number.isFinite(n) && n > 0 && n < 150) updateProfile({ age: Math.round(n) }); }} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('s.trackHeight')} value={heightT} onChangeText={(v) => { setHeightT(v); const n = Number(v); if (Number.isFinite(n) && n > 0 && n < 250) updateProfile({ height: Math.round(n) }); }} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('s.trackWeightKg')} value={weightT} onChangeText={(v) => { setWeightT(v); const n = Number(v.replace(',', '.')); if (Number.isFinite(n) && n > 0 && n < 300) updateProfile({ weight: Math.round(n * 10) / 10 }); }} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={tinyLabel}>Sex</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['male', 'female'] as Sex[]).map((s) => (
                <Pressable key={s} onPress={() => updateProfile({ sex: s })} style={({ pressed }) => [{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: profileReady.sex === s ? colors.accent : colors.cardBorder, backgroundColor: profileReady.sex === s ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 13, fontWeight: profileReady.sex === s ? '800' : '600', color: profileReady.sex === s ? colors.accent : colors.textPrimary }}>{s === 'male' ? 'Male' : 'Female'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={tinyLabel}>{t('s.trackActivity')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {([1, 2, 3, 4] as Activity[]).map((a) => (
                <Pressable key={a} onPress={() => updateProfile({ activity: a })} style={({ pressed }) => [{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: profileReady.activity === a ? colors.accent : colors.cardBorder, backgroundColor: profileReady.activity === a ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 12, fontWeight: profileReady.activity === a ? '800' : '600', color: profileReady.activity === a ? colors.accent : colors.textPrimary }}>{activityLabel[a]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={tinyLabel}>{t('s.trackGoal')}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['cut', 'maintain', 'bulk'] as GoalTag[]).map((g) => (
                <Pressable key={g} onPress={() => updateProfile({ goal: g })} style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: profileReady.goal === g ? colors.accent : colors.cardBorder, backgroundColor: profileReady.goal === g ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: profileReady.goal === g ? '800' : '600', color: profileReady.goal === g ? colors.accent : colors.textPrimary }}>
                    {g === 'cut' ? 'Cut (-500)' : g === 'bulk' ? 'Bulk (+350)' : 'Maintain'}
                  </Text>
                </Pressable>
              ))}
            </View>
                <AppButton label={t('common.done')} variant="dark" style={{ marginTop: 16 }} onPress={() => setShowProfile(false)} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Week chart */}
        <GlassCard pad={16} radius={22} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={15} color={colors.accent} strokeWidth={2.2} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.trackLast7')}</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 11, color: colors.textSecondary }}>{t('common.kcal')} {t('s.perDay')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96 }}>
            {week.map((w) => {
              const isToday = startOfDay(w.day) === startOfDay(Date.now());
              const h = w.cals > 0 ? Math.max(10, Math.round((w.cals / weekMax) * 80)) : 4;
              const d = new Date(w.day);
              const label = d.toLocaleDateString([], { weekday: 'narrow' });
              return (
                <View key={w.day} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, color: isToday ? colors.accent : colors.textSecondary, marginBottom: 3, fontWeight: isToday ? '800' : '600' }}>
                    {w.cals > 0 ? Math.round(w.cals / 10) / 100 + 'k' : ''}
                  </Text>
                  <View style={{ height: 80, justifyContent: 'flex-end' }}>
                    <View style={{ width: 16, borderRadius: 5, backgroundColor: isToday ? colors.accent : w.cals > 0 ? colors.accentSoft : colors.surfaceMuted, height: h }} />
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 10, fontWeight: isToday ? '800' : '500', color: isToday ? colors.accent : colors.textSecondary }}>{label}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Weekly report + streak badges (2.0.0) */}
        {(() => {
          const logged = week.filter((w) => w.cals > 0);
          const avg = logged.length ? Math.round(logged.reduce((s, w) => s + w.cals, 0) / logged.length) : 0;
          const onTarget = logged.filter((w) => w.cals <= kcalGoal && w.cals >= kcalGoal * 0.7).length;
          const bestDay = logged.length ? logged.reduce((best, w) => (w.cals > best.cals ? w : best), logged[0]) : null;
          const badges: { days: number; label: string }[] = [
            { days: 3, label: '3-day streak' },
            { days: 7, label: '1 week' },
            { days: 14, label: '2 weeks' },
            { days: 30, label: '1 month' },
          ];
          return (
            <GlassCard pad={16} radius={22} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Sparkles size={15} color={colors.accent} strokeWidth={2.2} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.trackWeekly')}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surfaceMuted, padding: 10 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.trackAvg')}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>{avg || '—'}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surfaceMuted, padding: 10 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.trackDays')}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>{logged.length}/7</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surfaceMuted, padding: 10 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.trackOnTarget')}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.success, marginTop: 2 }}>{onTarget}</Text>
                </View>
              </View>

              {bestDay ? (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 10 }}>
                  {t('s.trackBestDay', { day: new Date(bestDay.day).toLocaleDateString([], { weekday: 'long' }), kcal: Math.round(bestDay.cals) })}
                </Text>
              ) : (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 10 }}>
                  {t('s.trackLogToday')}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {badges.map((b) => {
                  const earned = streak >= b.days;
                  return (
                    <View
                      key={b.days}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: earned ? colors.accent : colors.cardBorder,
                        backgroundColor: earned ? colors.accentSoft : colors.surfaceMuted,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{earned ? '🏅' : '·'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: earned ? colors.accent : colors.textSecondary }}>{b.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 8 }}>
                {t('s.trackStreak', { n: streak })}
              </Text>
            </GlassCard>
          );
        })()}

        {/* 2.1.1: logging a meal is a popup now. */}
        <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)} statusBarTranslucent>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlayStrong }}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowForm(false)} />
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%' }}>
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>{t('tracker.logMealManual')}</Text>
                  <Pressable onPress={() => setShowForm(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                    <X size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
            <TextField label={t('tracker.mealName')} value={name} onChangeText={setName} placeholder={t('s.trackExample')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><TextField label={t('common.kcal')} value={kcal} onChangeText={setKcal} keyboardType="number-pad" placeholder="650" /></View>
              <View style={{ flex: 1 }}><TextField label={`${t('common.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="number-pad" placeholder="28" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><TextField label={`${t('common.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="number-pad" placeholder="55" /></View>
              <View style={{ flex: 1 }}><TextField label={`${t('common.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="number-pad" placeholder="18" /></View>
            </View>
            {error ? <Text style={{ color: colors.rose, fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
            <AppButton label={t('tracker.logMeal')} variant="dark" onPress={submit} busy={busy} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Text style={tinyLabel}>{t('tracker.today')}</Text>
        {today.length === 0 ? (
          <EmptyState
            icon={<Flame size={24} color={colors.accent} strokeWidth={2} />}
            title={t('tracker.noMeals')}
            body={t('s.trackEmptyBody')}
            action={<AppButton label={t('tracker.logFirst')} variant="dark" icon={<Plus size={16} color={colors.darkButtonText} />} onPress={() => setShowForm(true)} />}
          />
        ) : (
          today.map((item: any) => (
            <View key={item._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {new Date(item.eatenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {item.protein != null ? ` · P ${roundN(item.protein)}g` : ''}
                  {item.carbs != null ? ` · C ${roundN(item.carbs)}g` : ''}
                  {item.fat != null ? ` · F ${roundN(item.fat)}g` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: colors.accent, fontWeight: '800', marginRight: 12 }}>{item.calories ?? 0} kcal</Text>
              <Pressable onPress={() => del(item._id)} hitSlop={8}>
                <Trash2 size={16} color={colors.rose} strokeWidth={2} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Page>
  );
}

function GoalBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: 11, color, fontWeight: '700' }}>{pct}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${pct}%`, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MacroChip({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 4 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
        <Text style={{ color: readableText(color), fontSize: 9, fontWeight: '800' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

function MacroEnergyCard({ kcal, p, c, f, tp, tc, tf }: { kcal: number; p: number; c: number; f: number; tp: number; tc: number; tf: number }) {
  const kcalSafe = kcal > 0 ? kcal : 1;
  const pct = (g: number) => Math.max(0, Math.min(100, Math.round(((g * 4) / kcalSafe) * 100)));
  const rows = [
    { label: 'Protein', target: p, eaten: tp, pct: pct(p), color: colors.success },
    { label: 'Carbs', target: c, eaten: tc, pct: pct(c), color: colors.cyan },
    { label: 'Fat', target: f, eaten: tf, pct: pct(f), color: colors.amber },
  ];
  return (
    <GlassCard pad={14} radius={20} style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.trackMacro')}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 5, borderColor: r.color, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: r.color }}>{r.pct}%</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>{r.label}</Text>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>
              {r.eaten}/{r.target} g
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

/* 2.0.0 theme fix: rebuilt on every theme change. */
function buildTinyLabel() {
  return {
    fontSize: 11, fontWeight: '700' as const, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    marginTop: 16, marginBottom: 6,
  };
}
let tinyLabel = buildTinyLabel();
subscribeTheme(() => { tinyLabel = buildTinyLabel(); });

