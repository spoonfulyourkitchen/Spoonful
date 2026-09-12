import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Droplets, Minus, Plus, ScanLine, Search, TrendingDown, TrendingUp } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { GlassCard, SectionLabel } from './ui';
import { useTranslation } from '../lib/i18n';
import { searchFoods, productByBarcode, scaleToPortion, type FoodHit } from '../lib/foodFacts';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { FoodPortionSheet } from './FoodPortionSheet';
import { Popup } from './Popup';
import { tutorialAction, useTutorialTarget } from '../lib/tutorial';
import { BARCODE_L10N, TRACKER_L10N, pick } from '../lib/l10n';

/**
 * Tracker extras (2.0.0, rebuilt in 2.1.1):
 *  - the food card (search + barcode photo scan) sits at the very top,
 *  - water intake with a goal derived from the body weight,
 *  - weight card: quick logging, trend and an automatic goal suggestion,
 *  - every result of an action is a popup, nothing "appears" further down the
 *    page where the user would have to scroll to find it.
 */
const PROFILE_KEY = 'spoonful:nutrition-profile';

export function TrackerExtras() {
  const { t, lang } = useTranslation();
  const water = useQuery(api.tracker.waterToday) as any;
  const addWater = useMutation(api.tracker.addWater);
  const removeWater = useMutation(api.tracker.removeWater);
  const addWeight = useMutation(api.tracker.addWeight);
  const weights = useQuery(api.tracker.weights) as any[] | undefined;
  const logManual = useMutation(api.calorieEntries.logManual);

  const [bodyWeight, setBodyWeight] = useState(75);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  /** Product waiting for the portion choice (2.1.0). */
  const [pending, setPending] = useState<FoodHit | null>(null);
  /** 2.1.1: one popup for every message (goal, weight, product lookup). */
  const [popup, setPopup] = useState<{ title: string; body?: string } | null>(null);
  const [kgInput, setKgInput] = useState('');
  const [kgBusy, setKgBusy] = useState(false);
  /* Tutorial target: the barcode row (scan a photo / type the number). */
  const barcodeTarget = useTutorialTarget('tut-barcode');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PROFILE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const p = JSON.parse(raw);
        if (p && typeof p.weight === 'number') setBodyWeight(p.weight);
        if (p && (p.goal === 'lose' || p.goal === 'maintain' || p.goal === 'gain')) setGoal(p.goal);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const waterGoalMl = Math.round((bodyWeight * 35) / 100) * 100;
  const totalMl = Number(water?.totalMl ?? 0);
  const waterPct = waterGoalMl ? Math.min(100, Math.round((totalMl / waterGoalMl) * 100)) : 0;

  /** Trend: weight logs of the last weeks, oldest to newest. */
  const trend = useMemo(() => {
    const rows = (weights ?? [])
      .map((w: any) => ({ kg: Number(w.weightKg), at: Number(w.loggedAt ?? 0) }))
      .filter((w) => Number.isFinite(w.kg))
      .sort((a, b) => a.at - b.at);
    if (rows.length < 2) return null;
    const cutoff = Date.now() - 14 * 86400000;
    const recent = rows.filter((r) => r.at >= cutoff);
    const base = recent[0] ?? rows[0];
    const last = rows[rows.length - 1];
    const delta = Math.round((last.kg - base.kg) * 10) / 10;
    const weeks = Math.max(1, Math.round((Date.now() - base.at) / (7 * 86400000)));
    return { last: last.kg, delta, weeks, points: rows.slice(-14) };
  }, [weights]);

  const suggestion = useMemo(() => {
    if (!trend) return null;
    const perWeek = trend.delta / Math.max(1, trend.weeks);
    if (goal === 'lose' && perWeek > -0.15) return 'lose';
    if (goal === 'gain' && perWeek < 0.15) return 'gain';
    if (goal === 'maintain' && Math.abs(perWeek) > 0.5) return perWeek > 0 ? 'lose' : 'gain';
    if (goal === 'lose' && perWeek < -1.2) return 'maintain';
    return null;
  }, [trend, goal]);

  const goalWord = (g: string) => t(g === 'lose' ? 'onb.lose' : g === 'gain' ? 'onb.gain' : 'onb.keep');

  /** 2.1.1: confirmation opens as a popup instead of a line below the button. */
  const applySuggestion = async () => {
    if (!suggestion) return;
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      const p = raw ? JSON.parse(raw) : {};
      const next = { ...p, goal: suggestion, weight: trend?.last ?? p.weight ?? bodyWeight };
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      setGoal(next.goal);
      setBodyWeight(next.weight ?? bodyWeight);
      setPopup({
        title: pick(lang, TRACKER_L10N.goalAdjustedTitle),
        body: `${pick(lang, TRACKER_L10N.goalHint)}: ${goalWord(next.goal)}`,
      });
    } catch {
      /* ignore */
    }
  };

  /** 2.1.1: weight logging lives in this panel now (the old emoji card is gone). */
  const saveWeight = async () => {
    const kg = Number(kgInput.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      setPopup({ title: pick(lang, TRACKER_L10N.weightTitle), body: pick(lang, TRACKER_L10N.weightInvalid) });
      return;
    }
    setKgBusy(true);
    try {
      await addWeight({ weightKg: Math.round(kg * 10) / 10, at: Date.now() });
      setKgInput('');
      setPopup({ title: pick(lang, TRACKER_L10N.weightTitle), body: pick(lang, TRACKER_L10N.weightSaved) });
    } catch (e) {
      setPopup({ title: pick(lang, TRACKER_L10N.weightTitle), body: e instanceof Error ? e.message : pick(lang, TRACKER_L10N.weightInvalid) });
    } finally {
      setKgBusy(false);
    }
  };

  const runSearch = async () => {
    setSearching(true);
    try {
      setHits(await searchFoods(query));
    } finally {
      setSearching(false);
    }
  };

  const runBarcode = async () => {
    setSearching(true);
    try {
      const hit = await productByBarcode(barcode);
      setHits(hit ? [hit] : []);
      if (hit?.name) setQuery(hit.name);
      if (!hit) setPopup({ title: pick(lang, BARCODE_L10N.noCodeTitle), body: pick(lang, BARCODE_L10N.notInDatabase) });
      // 2.1.0: ask how much was eaten before logging.
      if (hit) setPending(hit);
    } finally {
      setSearching(false);
    }
  };

  /** 2.1.0: a barcode that the photo scanner read from the picture. */
  const onScanned = async (code: string) => {
    setBarcode(code);
    setSearching(true);
    try {
      const hit = await productByBarcode(code);
      if (!hit) {
        setPopup({ title: pick(lang, BARCODE_L10N.noCodeTitle), body: pick(lang, BARCODE_L10N.notInDatabase) });
        return;
      }
      setHits([hit]);
      if (hit.name) setQuery(hit.name);
      setPending(hit);
    } finally {
      setSearching(false);
    }
  };

  /** 2.1.0: write the tracker entry with the portion the user picked. */
  const confirmPortion = async (hit: FoodHit, grams: number) => {
    const scaled = scaleToPortion(hit, grams);
    try {
      await logManual({
        title: `${hit.brand ? `${hit.name} (${hit.brand})` : hit.name} · ${grams} g`,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
      });
      setPending(null);
      setHits([]);
      setQuery('');
      setBarcode('');
    } catch {
      /* reactive refresh handles it */
    }
  };

  return (
    <>
      {/* 2.1.1: the food card (scan + search) is the first thing on the tracker */}
      <SectionLabel>{pick(lang, TRACKER_L10N.scanCardTitle)}</SectionLabel>
      <GlassCard pad={16} radius={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10 }}>
            <Search size={15} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('x.searchHint')}
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 9, color: colors.textPrimary }}
            />
          </View>
          <Pressable
            onPress={() => void runSearch()}
            style={{ height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.darkButton, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 12 }}>{t('common.search')}</Text>
          </Pressable>
        </View>

        <View ref={barcodeTarget.ref as any} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10 }}>
            <ScanLine size={15} color={colors.textSecondary} />
            <TextInput
              value={barcode}
              onChangeText={setBarcode}
              keyboardType="number-pad"
              placeholder={t('x.barcode')}
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 9, color: colors.textPrimary }}
            />
          </View>
          {/* 2.1.1: the camera opens the (popup) scanner */}
          <Pressable
            onPress={() => {
              // Tapping the camera/scan row completes the tour step, otherwise
              // the scanner popup would hide the coach mark while it is open.
              tutorialAction('tut-barcode');
              setScannerOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={pick(lang, BARCODE_L10N.scanTitle)}
            style={({ pressed }) => [{ height: 38, width: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Camera size={17} color={colors.accentText} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={() => {
              tutorialAction('tut-barcode');
              void runBarcode();
            }}
            style={{ height: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{t('x.barcode')}</Text>
          </Pressable>
        </View>

        {searching ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} /> : null}

        {!searching && hits.length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {hits.slice(0, 6).map((hit) => (
              <View
                key={`${hit.code}-${hit.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '700', color: colors.textPrimary }}>
                    {hit.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                    {hit.kcal ?? '-'} kcal · {hit.protein ?? '-'}P {hit.carbs ?? '-'}C {hit.fat ?? '-'}F · {t('x.per100g')}
                  </Text>
                </View>
                <Pressable onPress={() => setPending(hit)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.accentSoft }}>
                  <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>{t('x.logIt')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {!searching && !hits.length && (query.length > 2 || barcode.length > 5) ? (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>{t('x.noResults')}</Text>
        ) : null}
      </GlassCard>

      {/* water */}
      <SectionLabel>{t('x.water')}</SectionLabel>
      <GlassCard pad={16} radius={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Droplets size={20} color={colors.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>
              {(totalMl / 1000).toFixed(2)} L · {waterPct}%
            </Text>
            <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
              {t('x.waterGoal')}: {(waterGoalMl / 1000).toFixed(1)} L
            </Text>
          </View>
          <Pressable
            onPress={() => void removeWater({})}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
          >
            <Minus size={15} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => void addWater({ ml: 250 })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.darkButton }}
          >
            <Plus size={14} color={colors.darkButtonText} />
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 12 }}>250 ml</Text>
          </Pressable>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginTop: 12, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${waterPct}%`, backgroundColor: colors.cyan, borderRadius: 4 }} />
        </View>
      </GlassCard>

      {/* weight: quick logging + trend + automatic goal suggestion */}
      <SectionLabel>{pick(lang, TRACKER_L10N.weightTitle)}</SectionLabel>
      <GlassCard pad={16} radius={20}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10 }}>
            <TextInput
              value={kgInput}
              onChangeText={setKgInput}
              keyboardType="decimal-pad"
              placeholder={pick(lang, TRACKER_L10N.weightPlaceholder)}
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 9, color: colors.textPrimary }}
            />
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>kg</Text>
          </View>
          <Pressable
            onPress={() => void saveWeight()}
            disabled={kgBusy}
            accessibilityRole="button"
            accessibilityLabel={pick(lang, TRACKER_L10N.save)}
            style={({ pressed }) => [{ borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkButton, opacity: kgBusy ? 0.6 : pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 13 }}>
              {kgBusy ? '…' : pick(lang, TRACKER_L10N.save)}
            </Text>
          </Pressable>
        </View>

        {!trend ? (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>{pick(lang, TRACKER_L10N.weightHint)}</Text>
        ) : (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {trend.delta <= 0 ? <TrendingDown size={18} color={colors.success} /> : <TrendingUp size={18} color={colors.accent} />}
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>
                {trend.last} kg · {trend.delta > 0 ? '+' : ''}
                {trend.delta} kg
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>({trend.weeks}w)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 46, marginTop: 10 }}>
              {trend.points.map((p: any, i: number) => {
                const values = trend.points.map((x: any) => x.kg);
                const min = Math.min(...values);
                const span = Math.max(0.5, Math.max(...values) - min);
                const h = 8 + ((p.kg - min) / span) * 34;
                return <View key={i} style={{ flex: 1, height: h, borderRadius: 3, backgroundColor: colors.accentSoft }} />;
              })}
            </View>
            {suggestion ? (
              <Pressable
                onPress={() => void applySuggestion()}
                style={({ pressed }) => [{ marginTop: 12, borderRadius: 13, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 13 }}>
                  {t('x.adjustGoal')} · {goalWord(suggestion)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </GlassCard>

      {/* 2.1.0/2.1.1: scanner popup + portion popup + message popup */}
      <BarcodeScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onCode={(code) => void onScanned(code)} />
      <FoodPortionSheet
        hit={pending}
        visible={!!pending}
        onClose={() => setPending(null)}
        onConfirm={(grams) => {
          if (pending) void confirmPortion(pending, grams);
        }}
      />
      <Popup
        visible={!!popup}
        onClose={() => setPopup(null)}
        closeLabel={pick(lang, TRACKER_L10N.ok)}
        icon={<ScanLine size={20} color={colors.accent} />}
        title={popup?.title ?? ''}
        body={popup?.body}
        actions={[{ label: pick(lang, TRACKER_L10N.ok), onPress: () => setPopup(null) }]}
      />
    </>
  );
}

export default TrackerExtras;
