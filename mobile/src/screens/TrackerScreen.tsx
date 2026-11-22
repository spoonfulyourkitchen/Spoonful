import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';

import { useIsFocused } from '@react-navigation/native';
import { Alert } from '../lib/alert';
import { Flame, Plus, Trash2, X } from 'lucide-react-native';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { AppButton, EmptyState, GlassCard, PageHeader, TextField } from '../components/ui';
import { TrackerExtras as TrackerPanel } from '../components/TrackerExtras';
import { useCachedList, addPendingOp, flushPendingOps, getConnNow } from '../lib/offline';
import { addWeightLocal } from '../lib/tracker-local';
import {
  computeTargets,
  setNutritionProfile,
  useNutritionProfile,
  type Activity,
  type GoalTag,
  type NutritionProfile,
  type Sex,
} from '../lib/nutrition-profile';
import { useTranslation } from '../lib/i18n';

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function parseNum(v: string): number | undefined {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}
function roundN(v: number) {
  return Math.round(v * 10) / 10;
}

function pctOf(value: number, goal: number): number {
  const v = Number(value);
  const g = Number(goal);
  if (!Number.isFinite(v) || !Number.isFinite(g) || g <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((v / g) * 100)));
}

export function TrackerScreen() {
  const entriesLive = useQuery(api.calorieEntries.list);
  const { data: entries, apply } = useCachedList('tracker', entriesLive);
  const logManual = useMutation(api.calorieEntries.logManual);
  const removeEntry = useMutation(api.calorieEntries.remove);
  const { t, lang } = useTranslation();
  const isFocused = useIsFocused();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formTab, setFormTab] = useState<'recipes' | 'manual'>('manual');
  const [pickedRecipe, setPickedRecipe] = useState<any>(null);
  const [portions, setPortions] = useState(1);
  const savedLive = useQuery(api.savedRecipes.list) as any[] | undefined;
  const mineLive = useQuery(api.recipes.list) as any[] | undefined;
  const { data: savedCache } = useCachedList<any>('saved', savedLive);
  const { data: mineCache } = useCachedList<any>('mine', mineLive);
  const recipeOptions = useMemo(() => {
    const seen = new Set<string>();
    const all = [...(savedCache ?? []), ...(mineCache ?? [])];
    return all
      .filter((r) => {
        const key = String(r?.title ?? '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 60);
  }, [savedCache, mineCache]);
  const openForm = () => {
    setPickedRecipe(null);
    setPortions(1);
    setFormTab(recipeOptions.length ? 'recipes' : 'manual');
    setShowForm(true);
  };

  const profile = useNutritionProfile();
  const [showProfile, setShowProfile] = useState(false);
  const [ageT, setAgeT] = useState('');
  const [heightT, setHeightT] = useState('');
  const [weightT, setWeightT] = useState('');

  useEffect(() => {
    if (showProfile) {
      setAgeT(String(profile.age));
      setHeightT(String(profile.height));
      setWeightT(String(profile.weight));
    }
  }, [showProfile, profile.age, profile.height, profile.weight]);

  const updateProfile = (patch: Partial<NutritionProfile>) => {
    setNutritionProfile(patch);
    if (patch.weight !== undefined) {
      addWeightLocal(patch.weight);
      void addPendingOp('tracker.weight.add', { kg: patch.weight, at: Date.now() });
      if (getConnNow() !== 'offline') void flushPendingOps();
    }
  };

  const targets = computeTargets(profile);
  const kcalGoal = targets.budget;
  const proteinGoal = targets.protein;
  const carbsGoal = targets.carbs;
  const fatGoal = targets.fat;
  const goalLabel = profile.goal === 'cut' ? t('onb.lose') : profile.goal === 'bulk' ? t('onb.gain') : t('onb.keep');
  const activityLabel: Record<Activity, string> = { 1: t('ob.act1'), 2: t('ob.act2'), 3: t('ob.act3'), 4: t('ob.act4') };

  const all = (entries ?? []) as any[];
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

    apply((prev: any[]) => [{ _id: `tmp-${Date.now()}`, ...payload, eatenAt: Date.now() }, ...prev]);
    setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat(''); setShowForm(false);
    void (async () => {
      if (getConnNow() === 'offline') {
        await addPendingOp('tracker.log', payload);
        return;
      }
      try {
        await logManual({ title: payload.title, calories, protein: gramsP, carbs: gramsC, fat: gramsF });
      } catch {
        await addPendingOp('tracker.log', payload);
      }
    })();
  };

  const logRecipe = async (recipe: any, count: number) => {
    const scale = (value: any) => Math.round((Number(value) || 0) * count);
    const payload = {
      title: `${recipe.title} · ${count} ${lang === 'de' ? (count === 1 ? 'Portion' : 'Portionen') : count === 1 ? 'portion' : 'portions'}`,
      calories: scale(recipe.calories),
      protein: scale(recipe.protein),
      carbs: scale(recipe.carbs),
      fat: scale(recipe.fat),
    };
    apply((prev: any[]) => [{ _id: `tmp-${Date.now()}`, ...payload, eatenAt: Date.now() }, ...prev]);
    setShowForm(false);
    setPickedRecipe(null);
    setPortions(1);
    if (getConnNow() === 'offline') {
      await addPendingOp('tracker.log', payload);
      return;
    }
    try {
      await logManual({
        title: payload.title,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
      });
    } catch {
      await addPendingOp('tracker.log', payload);
    }
  };

  const del = (id: any) => {
    if (String(id).startsWith('tmp-')) {
      apply((prev: any[]) => prev.filter((e: any) => e._id !== id));
      return;
    }
    Alert.alert(t('s.trackRemoveT'), t('s.trackRemoveB'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('s.trackRemove'),
        style: 'destructive',
        onPress: () => {
          apply((prev: any[]) => prev.filter((e: any) => e._id !== id));
          void (async () => {
            if (getConnNow() === 'offline') {
              await addPendingOp('tracker.remove', { id });
              return;
            }
            try {
              await removeEntry({ id });
            } catch {
              await addPendingOp('tracker.remove', { id });
            }
          })();
        },
      },
    ]);
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PageHeader eyebrow={t('s.trackEyebrow')} title={t('tracker.title')} />
          </View>
          <Pressable onPress={openForm} style={({ pressed }) => [{ marginBottom: 16, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>
              {t('tracker.logMeal')}
            </Text>
          </Pressable>
        </View>

        <GlassCard pad={18} radius={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textSecondary }}>
              {t('s.trackRemaining')}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setShowProfile(true)} style={({ pressed }) => [{ borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 11, paddingVertical: 5, opacity: pressed ? 0.75 : 1 }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.trackAdjust')}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 4 }}>
            <Text style={{ fontSize: 46, fontWeight: '900', letterSpacing: -1.6, color: remaining < 150 && todayCal > 0 ? colors.rose : colors.textPrimary, fontVariant: ['tabular-nums'] }}>
              {remaining}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary, paddingBottom: 9 }}>{t('common.kcal')}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
            {t('s.trackEaten', { n: todayCal })} · {kcalGoal} {t('common.kcal')} {t('s.perDay')}
          </Text>

          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted, marginTop: 14, overflow: 'hidden' }}>
            <View style={{ height: 10, width: `${calPct}%`, borderRadius: 5, backgroundColor: colors.accent }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <MacroStat label={t('common.protein')} value={todayProtein} goal={proteinGoal} pct={proteinPct} color={colors.success} />
            <MacroStat label={t('common.carbs')} value={todayCarbs} goal={carbsGoal} pct={carbsPct} color={colors.cyan} />
            <MacroStat label={t('common.fat')} value={todayFat} goal={fatGoal} pct={fatPct} color={colors.amber} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.textSecondary }}>
              {goalLabel}
              {profile.targetWeight ? ` · ${lang === 'de' ? 'Ziel' : 'Target'} ${profile.targetWeight} ${t('ob.kg')}` : ''}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.trackPlan')}</Text>
          </View>
        </GlassCard>

        <Text style={tinyLabel}>{t('tracker.today')}</Text>
        {today.length === 0 ? (
          <EmptyState
            icon={<Flame size={24} color={colors.accent} strokeWidth={2} />}
            title={t('tracker.noMeals')}
            body={t('s.trackEmptyBody')}
            action={<AppButton label={t('tracker.logFirst')} variant="dark" icon={<Plus size={16} color={colors.darkButtonText} />} onPress={openForm} />}
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

        <TrackerPanel
          onLocalLog={(payload: any) => apply((prev: any[]) => [{ _id: `tmp-${Date.now()}`, ...payload, eatenAt: Date.now() }, ...prev])}
        />

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
                <TextField label={t('s.trackAge')} value={ageT} onChangeText={(v) => { setAgeT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 150) updateProfile({ age: n }); }} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('s.trackHeight')} value={heightT} onChangeText={(v) => { setHeightT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 250) updateProfile({ height: n }); }} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('s.trackWeightKg')} value={weightT} onChangeText={(v) => { setWeightT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 300) updateProfile({ weight: n }); }} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={tinyLabel}>{t('ob.sexTitle')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['male', 'female'] as Sex[]).map((s) => (
                <Pressable key={s} onPress={() => updateProfile({ sex: s })} style={({ pressed }) => [{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: profile.sex === s ? colors.accent : colors.cardBorder, backgroundColor: profile.sex === s ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 13, fontWeight: profile.sex === s ? '800' : '600', color: profile.sex === s ? colors.accent : colors.textPrimary }}>{s === 'male' ? t('s.trackMale') : t('s.trackFemale')}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={tinyLabel}>{t('s.trackActivity')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {([1, 2, 3, 4] as Activity[]).map((a) => (
                <Pressable key={a} onPress={() => updateProfile({ activity: a })} style={({ pressed }) => [{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: profile.activity === a ? colors.accent : colors.cardBorder, backgroundColor: profile.activity === a ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 12, fontWeight: profile.activity === a ? '800' : '600', color: profile.activity === a ? colors.accent : colors.textPrimary }}>{activityLabel[a]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={tinyLabel}>{t('s.trackGoal')}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['cut', 'maintain', 'bulk'] as GoalTag[]).map((g) => (
                <Pressable key={g} onPress={() => updateProfile({ goal: g })} style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: profile.goal === g ? colors.accent : colors.cardBorder, backgroundColor: profile.goal === g ? colors.accentSoft : colors.card, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 12.5, fontWeight: profile.goal === g ? '800' : '600', color: profile.goal === g ? colors.accent : colors.textPrimary }}>
                    {g === 'cut' ? t('onb.lose') : g === 'bulk' ? t('onb.gain') : t('onb.keep')}
                  </Text>
                </Pressable>
              ))}
            </View>
                <AppButton label={t('common.done')} variant="dark" style={{ marginTop: 16 }} onPress={() => setShowProfile(false)} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showForm && isFocused}
          transparent
          animationType="fade"
          onRequestClose={() => setShowForm(false)}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.overlayStrong }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
          >
            <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', paddingHorizontal: 20 }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowForm(false)} />
              <View style={{ backgroundColor: colors.bg, borderRadius: 24, maxHeight: '85%', width: '100%' }}>
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' }}>{t('tracker.logMeal')}</Text>
                  <Pressable onPress={() => setShowForm(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                    <X size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {[
                    { key: 'recipes' as const, label: lang === 'de' ? 'Aus Rezepten' : 'From recipes' },
                    { key: 'manual' as const, label: lang === 'de' ? 'Manuell' : 'Manual' },
                  ].map((tab) => {
                    const active = formTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => { setPickedRecipe(null); setFormTab(tab.key); }}
                        style={({ pressed }) => [{
                          flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center',
                          borderWidth: 1, borderColor: active ? colors.accent : colors.cardBorder,
                          backgroundColor: active ? colors.accentSoft : colors.card, opacity: pressed ? 0.85 : 1,
                        }]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: active ? colors.accent : colors.textPrimary }}>{tab.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {formTab === 'recipes' ? (
                  pickedRecipe ? (
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{pickedRecipe.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                        {Math.round(Number(pickedRecipe.calories) || 0)} kcal {lang === 'de' ? 'pro Portion' : 'per portion'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
                        <Pressable onPress={() => setPortions((v) => Math.max(1, v - 1))} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>-</Text>
                        </Pressable>
                        <Text style={{ minWidth: 90, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>
                          {portions} {lang === 'de' ? (portions === 1 ? 'Portion' : 'Portionen') : portions === 1 ? 'portion' : 'portions'}
                        </Text>
                        <Pressable onPress={() => setPortions((v) => Math.min(12, v + 1))} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>+</Text>
                        </Pressable>
                        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.accent }}>
                          {Math.round((Number(pickedRecipe.calories) || 0) * portions)} kcal
                        </Text>
                      </View>
                      <AppButton label={lang === 'de' ? 'Eintragen' : 'Add to tracker'} variant="dark" onPress={() => void logRecipe(pickedRecipe, portions)} style={{ marginTop: 16 }} />
                    </View>
                  ) : (
                    <View>
                      {recipeOptions.length ? recipeOptions.map((recipe: any, i: number) => (
                        <Pressable
                          key={`${recipe.title}-${i}`}
                          onPress={() => { setPickedRecipe(recipe); setPortions(1); }}
                          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{recipe.title}</Text>
                            <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                              {Math.round(Number(recipe.calories) || 0)} kcal {lang === 'de' ? 'pro Portion' : 'per portion'}
                            </Text>
                          </View>
                          <Plus size={16} color={colors.accent} />
                        </Pressable>
                      )) : (
                        <Text style={{ fontSize: 13, color: colors.textSecondary, paddingVertical: 8 }}>
                          {lang === 'de' ? 'Noch keine gespeicherten Rezepte. Nutze Manuell.' : 'No saved recipes yet. Use Manual.'}
                        </Text>
                      )}
                    </View>
                  )
                ) : (
                  <>
                    <TextField label={t('tracker.mealName')} value={name} onChangeText={setName} placeholder={t('s.trackExample')} />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <View style={{ flex: 1 }}><TextField label={t('common.kcal')} value={kcal} onChangeText={setKcal} keyboardType="number-pad" placeholder="650" /></View>
                      <View style={{ flex: 1 }}><TextField label={`${t('common.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="number-pad" placeholder="28" /></View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={{ flex: 1 }}><TextField label={`${t('common.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="number-pad" placeholder="55" /></View>
                      <View style={{ flex: 1 }}><TextField label={`${t('common.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="number-pad" placeholder="18" /></View>
                    </View>
                    {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 10, marginBottom: 6 }}>{error}</Text> : null}
                    <AppButton label={t('tracker.logMeal')} variant="dark" onPress={submit} style={{ marginTop: 8 }} />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </ScrollView>
    </Page>
  );
}

function MacroStat({ label, value, goal, pct, color }: { label: string; value: number; goal: number; pct: number; color: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.textPrimary, marginTop: 3 }}>
        {Math.round(value)}
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.textSecondary }}> / {goal} g</Text>
      </Text>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.card, marginTop: 7, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${pct}%`, borderRadius: 2, backgroundColor: color }} />
      </View>
    </View>
  );
}

function buildTinyLabel() {
  return {
    fontSize: 11, fontWeight: '700' as const, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    marginTop: 16, marginBottom: 6,
  };
}
let tinyLabel = buildTinyLabel();
subscribeTheme(() => { tinyLabel = buildTinyLabel(); });

