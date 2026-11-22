import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Droplets, Minus, Plus, ScanLine, Search, TrendingDown, TrendingUp } from 'lucide-react-native';
import { markReviewAction } from '../lib/review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '../lib/convex-auth';
import { api, runOp } from '../lib/api';
import { colors } from '../theme';
import { GlassCard } from './ui';
import { Collapsible } from './Collapsible';
import { useTranslation } from '../lib/i18n';
import { searchFoods, productByBarcode, scaleToPortion, type FoodHit } from '../lib/foodFacts';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { subscribePendingBarcode, takePendingBarcode } from '../lib/scan-bus';
import { FoodPortionSheet } from './FoodPortionSheet';
import { Popup } from './Popup';
import { tutorialAction, useTutorialTarget } from '../lib/tutorial';
import { BARCODE_L10N, TRACKER_L10N, pick } from '../lib/l10n';
import { addPendingOp, getConnNow } from '../lib/offline';
import {
  addWaterLocal,
  addWeightLocal,
  getWaterLocal,
  getWeightsLocal,
  hydrateTrackerLocal,
  subscribeTrackerLocal,
  undoWaterLocal,
  waterMarkSynced,
  waterServerTotal,
  weightMarkSynced,
  weightsServerList,
} from '../lib/tracker-local';

const PROFILE_KEY = 'spoonful:nutrition-profile';

export function TrackerExtras({ onLocalLog }: { onLocalLog?: (payload: any) => void } = {}) {
  const { t, lang } = useTranslation();
  const logManual = useMutation(api.calorieEntries.logManual);
  

  const addWaterServer = useMutation(api.tracker.addWater);
  const removeWaterServer = useMutation(api.tracker.removeWater);
  const addWeightServer = useMutation(api.tracker.addWeight);
  const waterLocal = useSyncExternalStore(subscribeTrackerLocal, getWaterLocal, getWaterLocal);
  const weightLocal = useSyncExternalStore(subscribeTrackerLocal, getWeightsLocal, getWeightsLocal);

  useEffect(() => {
    void hydrateTrackerLocal();
    void (async () => {
      try {
        const res: any = await runOp(api.tracker.waterToday, 'query', null, {});
        waterServerTotal(Number(res?.totalMl ?? 0));
      } catch {}
      try {
        const rows: any = await runOp(api.tracker.weights, 'query', null, {});
        if (Array.isArray(rows)) weightsServerList(rows);
      } catch {}
    })();
  }, []);

  

  const onScannedRef = useRef<((code: string) => void) | null>(null);
  useEffect(() => {
    const code = takePendingBarcode();
    if (code) onScannedRef.current?.(code);
    return subscribePendingBarcode((next) => onScannedRef.current?.(next));
  }, []);

  
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ food: false, water: false, weight: false });
  const toggleSection = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const [bodyWeight, setBodyWeight] = useState(75);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  
  const [pending, setPending] = useState<FoodHit | null>(null);
  
  const [popup, setPopup] = useState<{ title: string; body?: string } | null>(null);
  const [kgInput, setKgInput] = useState('');
  const [kgBusy, setKgBusy] = useState(false);
  
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
  const totalMl = waterLocal.totalMl;
  const waterPct = waterGoalMl ? Math.min(100, Math.round((totalMl / waterGoalMl) * 100)) : 0;

  
  const addWater = (ml: number) => {
    addWaterLocal(ml);
    void (async () => {
      if (getConnNow() === 'offline') {
        await addPendingOp('tracker.water.add', { ml });
        return;
      }
      try {
        await addWaterServer({ ml });
        waterMarkSynced(1, 0);
      } catch {
        await addPendingOp('tracker.water.add', { ml });
      }
    })();
  };

  
  const undoWater = () => {
    const mode = undoWaterLocal();
    if (mode !== 'server') return;
    void (async () => {
      if (getConnNow() === 'offline') {
        await addPendingOp('tracker.water.undo', {});
        return;
      }
      try {
        await removeWaterServer({});
        waterMarkSynced(0, 1);
      } catch {
        await addPendingOp('tracker.water.undo', {});
      }
    })();
  };

  
  const trend = useMemo(() => {
    const rows = weightLocal
      .map((w) => ({ kg: Number(w.kg), at: Number(w.at ?? 0) }))
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
  }, [weightLocal]);

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
    } catch {}
  };

  

  const saveWeight = async () => {
    const kg = Number(kgInput.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      setPopup({ title: pick(lang, TRACKER_L10N.weightTitle), body: pick(lang, TRACKER_L10N.weightInvalid) });
      return;
    }
    const entry = addWeightLocal(kg);
    setKgInput('');
    setPopup({ title: pick(lang, TRACKER_L10N.weightTitle), body: pick(lang, TRACKER_L10N.weightSaved) });
    if (getConnNow() === 'offline') {
      await addPendingOp('tracker.weight.add', { kg: entry.kg, at: entry.at });
      return;
    }
    setKgBusy(true);
    try {
      await addWeightServer({ weightKg: entry.kg, at: entry.at });
      weightMarkSynced(entry.id);
    } catch {
      await addPendingOp('tracker.weight.add', { kg: entry.kg, at: entry.at });
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
      if (hit) { setPending(hit); markReviewAction('barcode'); }
    } finally {
      setSearching(false);
    }
  };

  
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
      markReviewAction('barcode');
    } finally {
      setSearching(false);
    }
  };
  
  onScannedRef.current = onScanned;

  

  const confirmPortion = async (hit: FoodHit, grams: number) => {
    const scaled = scaleToPortion(hit, grams);
    const payload = {
      title: `${hit.brand ? `${hit.name} (${hit.brand})` : hit.name} · ${grams} g`,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
    };
    onLocalLog?.(payload);
    setPending(null);
    setHits([]);
    setQuery('');
    setBarcode('');
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

  return (
    <>
      <Collapsible bare title={pick(lang, TRACKER_L10N.scanCardTitle)} open={openSections.food} onToggle={() => toggleSection('food')} />
      <GlassCard visible={openSections.food} pad={16} radius={20}>
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
          <Pressable
            onPress={() => {
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

      <Collapsible bare title={t('x.water')} open={openSections.water} onToggle={() => toggleSection('water')} />
      <GlassCard visible={openSections.water} pad={16} radius={20}>
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
            onPress={undoWater}
            accessibilityRole="button"
            accessibilityLabel={t('x.water')}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
          >
            <Minus size={15} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => addWater(250)}
            accessibilityRole="button"
            accessibilityLabel="250 ml"
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

      {
}
      <Collapsible bare title={pick(lang, TRACKER_L10N.weightTitle)} open={openSections.weight} onToggle={() => toggleSection('weight')} />
      <GlassCard visible={openSections.weight} pad={16} radius={20}>
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
