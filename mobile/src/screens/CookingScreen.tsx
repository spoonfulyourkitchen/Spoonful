import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ListChecks,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShoppingCart,
  Timer,
  X,
} from 'lucide-react-native';
import { useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { addPendingOp, useConnectivity } from '../lib/offline';
import { colors, fonts, rgbaHelper } from '../theme';
import { goBack } from '../navigation/rootRef';
import { AppButton } from '../components/ui';
import { useTranslation } from '../lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTimer,
  clearTimers,
  extendTimer,
  pauseTimer,
  removeTimer,
  resumeTimer,
  timerRemaining,
  useKitchenTimers,
} from '../lib/kitchenTimers';
import { recipeLines } from '../lib/recipe';

const BASE_SERVINGS = 2;
const PRESETS = [3, 5, 10, 15, 20, 30];

function parseAmount(v: string): number | null {
  if (v.includes('/')) {
    const [n, d] = v.split('/').map(Number);
    if (d && Number.isFinite(n) && Number.isFinite(d)) return n / d;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function formatAmount(v: number): string {
  const r = Math.round(v * 100) / 100;
  const fracs: [number, string][] = [[0.25, '1/4'], [0.33, '1/3'], [0.5, '1/2'], [0.67, '2/3'], [0.75, '3/4']];
  for (const [val, s] of fracs) if (Math.abs(r - val) < 0.03) return s;
  return Number.isInteger(r) ? String(r) : String(r).replace(/0+$/, '').replace(/\.$/, '');
}
function scaleLine(ing: string, servings: number): string {
  const m = ing.match(/^(\d+(?:\.\d+)?|\d+\/\d+)(\s+)(.*)$/);
  if (!m) return ing;
  const amount = parseAmount(m[1]);
  if (amount === null) return ing;
  return `${formatAmount(amount * (servings / BASE_SERVINGS))}${m[2]}${m[3]}`;
}
const mm = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Pulls "8 minutes" / "3 min" style hints out of a step. */
function extractMinutes(step: string): number | null {
  const m = step.match(/(\d+)\s*(?:minutes?|min)\b/i);
  if (!m) return null;
  const mins = Number(m[1]);
  return Number.isFinite(mins) && mins > 0 && mins <= 240 ? mins : null;
}

function cleanIngredientForShop(line: string): string {
  const t = line.trim();
  const m = t.match(/^(?:[\d\s./,-]+)?(?:(?:cup|tbsp|tsp|g|kg|ml|cl|oz|lb|pinch|clove|cloves|handful|bunch|can|jar)\s+)?(.+)$/i);
  const name = (m ? m[1].trim() : t).toLowerCase();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : line;
}

type PhaseInfo = { phase: string; color: string; tip: string; look: string };

function coachFor(step: string, index: number, total: number, diff: number | null): PhaseInfo {
  const text = step.toLowerCase();
  const isLast = index === total - 1;
  if (isLast || /(serve|plate|garnish|finish|top with|enjoy|rest before serving)/.test(text)) {
    return { phase: 'Finish', color: colors.success, tip: 'Plating is the final step - a quick taste check helps before serving.', look: 'Looks as good as it smells? Time to serve.' };
  }
  if (/(bake|oven|roast|broil|boil|simmer|fry|saut|grill|heat|reduce|caramel|braise|stew)/.test(text)) {
    return { phase: 'Cook', color: colors.accent, tip: `Let the heat do the work${diff ? ` and keep the ${diff}-minute timer handy` : ''} - peek only when needed.`, look: 'Check for the colour and texture described before moving on.' };
  }
  if (/(mix|stir|combine|whisk|fold|pour|add|season|marinate|toss|blend)/.test(text)) {
    return { phase: 'Combine', color: colors.cyan, tip: 'Combine gently but thoroughly so every bite tastes the same.', look: 'Everything should look evenly distributed.' };
  }
  if (/(prep|wash|rinse|peel|chop|dice|slice|mince|grate|trim|cut|measure|soak|drain|gather|separate)/.test(text)) {
    return { phase: 'Prep', color: colors.easy, tip: 'Take your time here - good prep makes the next steps easy.', look: 'All pieces ready to go.' };
  }
  if (index === 0) return { phase: 'Start', color: colors.cyan, tip: 'This is the first step of the recipe - read it once before you begin.', look: 'Ready when you are.' };
  return { phase: 'Next', color: colors.cyan, tip: 'Follow this step carefully, then move on when it looks right.', look: 'Matches the description? Keep going.' };
}

export function CookingScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const p = route.params ?? {};
  const title: string = p.title ?? 'Recipe';
  /* 2.0.0: recipes written by other tools may store steps/ingredients as
     objects - coerce everything to strings so scaling and timers cannot crash. */
  const steps: string[] = recipeLines(p.steps).length ? recipeLines(p.steps) : ['Prepare your ingredients and enjoy.'];
  const ingredients: string[] = recipeLines(p.ingredients);
  const totalTime: number = p.totalTime ?? 0;
  const nutrition = {
    calories: p.calories as number | undefined,
    protein: p.protein as number | undefined,
    carbs: p.carbs as number | undefined,
    fat: p.fat as number | undefined,
  };

  const connNow = useConnectivity();
  const logMeal = useMutation(api.calorieEntries.logManual);
  const addManyShop = useMutation(api.shoppingList.addMany);

  const [phase, setPhase] = useState<'prep' | 'cook' | 'done'>('prep');
  const [index, setIndex] = useState(0);
  const [servings, setServings] = useState(BASE_SERVINGS);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [checkedIng, setCheckedIng] = useState<Set<number>>(new Set());
  const [suggested, setSuggested] = useState<number | null>(null);
  // 2.0.0: several kitchen timers at once, ringing in the background.
  const timers = useKitchenTimers();
  const runningCount = timers.filter((t) => t.running).length;

  const total = steps.length;
  const progress = phase === 'done' ? 100 : total ? (doneSteps.size / total) * 100 : 0;
  const isLast = index === total - 1;

  const scaledIngredients = useMemo(() => ingredients.map((i) => scaleLine(i, servings)), [ingredients, servings]);
  const scale = servings / BASE_SERVINGS;
  const scaledNutrition = {
    calories: nutrition.calories == null ? null : Math.round(nutrition.calories * scale),
    protein: nutrition.protein == null ? null : Math.round(nutrition.protein * scale * 10) / 10,
    carbs: nutrition.carbs == null ? null : Math.round(nutrition.carbs * scale * 10) / 10,
    fat: nutrition.fat == null ? null : Math.round(nutrition.fat * scale * 10) / 10,
  };
  const hasNutrition = scaledNutrition.calories !== null || scaledNutrition.protein !== null || scaledNutrition.carbs !== null || scaledNutrition.fat !== null;

  const currentStep = steps[index] ?? '';
  const stepMinutes = useMemo(() => (phase === 'cook' ? extractMinutes(currentStep) : null), [phase, currentStep]);
  const coach = useMemo(() => coachFor(currentStep, index, total, stepMinutes), [currentStep, index, total, stepMinutes]);

  const stepIngredients = useMemo(() => {
    if (!currentStep) return [];
    const words = currentStep.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return scaledIngredients.filter((ing) => {
      const iw = ing.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      return iw.some((w) => words.includes(w));
    }).slice(0, 5);
  }, [currentStep, scaledIngredients]);

  /**
   * 2.0.0: the cooking session survives leaving the screen or restarting the
   * app - step, progress, servings and which ingredients were ticked off.
   */
  const sessionKey = `spoonful:cooking:${title}`;
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(sessionKey)
      .then((raw) => {
        if (!alive || !raw) return;
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return;
        if (typeof s.index === 'number') setIndex(Math.max(0, Math.min(total - 1, s.index)));
        if (s.phase === 'prep' || s.phase === 'cook' || s.phase === 'done') setPhase(s.phase);
        if (Array.isArray(s.doneSteps)) setDoneSteps(new Set(s.doneSteps.filter((n: unknown) => typeof n === 'number')));
        if (Array.isArray(s.checkedIng)) setCheckedIng(new Set(s.checkedIng.filter((n: unknown) => typeof n === 'number')));
        if (typeof s.servings === 'number' && s.servings > 0) setServings(s.servings);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionKey, total]);

  useEffect(() => {
    const payload = JSON.stringify({
      index,
      phase,
      doneSteps: [...doneSteps],
      checkedIng: [...checkedIng],
      servings,
      at: Date.now(),
    });
    AsyncStorage.setItem(sessionKey, payload).catch(() => {});
  }, [sessionKey, index, phase, doneSteps, checkedIng, servings]);

  const startTimer = (mins: number, label?: string) => {
    setSuggested(mins);
    void addTimer(mins, label ?? `${title} · ${t('cooking.step')} ${index + 1}`);
  };

  const begin = () => {
    setPhase('cook');
    const mins = extractMinutes(steps[0] ?? '');
    if (mins) setSuggested(mins);
  };

  const goNext = () => {
    setDoneSteps((d) => new Set(d).add(index));
    if (isLast) {
      setPhase('done');
      void finishAndLog();
      return;
    }
    const nextIdx = index + 1;
    setIndex(nextIdx);
    const mins = extractMinutes(steps[nextIdx] ?? '');
    setSuggested(mins);
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex((i) => i - 1);
    const mins = extractMinutes(steps[index - 1] ?? '');
    setSuggested(mins);
  };

  const markIngredient = (i: number) =>
    setCheckedIng((cur) => { const n = new Set(cur); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const sendToShopping = async () => {
    const names = ingredients.map(cleanIngredientForShop).filter(Boolean);
    if (!names.length) { Alert.alert('Nothing to add', 'This recipe has no listed ingredients.'); return; }
    if (connNow === 'offline') {
      for (const n of names) await addPendingOp('shopping.add', { name: n });
      Alert.alert('Saved offline', `${names.length} ingredients queued for your shopping list.`);
      return;
    }
    try {
      const res = await addManyShop({ items: names.map((n) => ({ name: n, recipeTitle: title })) });
      Alert.alert('Added to shopping list', `Added ${(res as any)?.added ?? names.length} ingredients from "${title}".`);
    } catch { Alert.alert('Could not add', 'Try again in a moment.'); }
  };

  const finishAndLog = async () => {
    const cals = scaledNutrition.calories;
    const prot = scaledNutrition.protein;
    const carbs = scaledNutrition.carbs;
    const fat = scaledNutrition.fat;
    const restart = () => { setPhase('prep'); setIndex(0); setDoneSteps(new Set()); setCheckedIng(new Set()); void clearTimers(); setSuggested(null); };
    if (connNow === 'offline') {
      if (cals != null) await addPendingOp('tracker.log', { title, calories: cals, protein: prot ?? null, carbs: carbs ?? null, fat: fat ?? null });
      Alert.alert('You made it!', `${title} is ready to serve.${cals != null ? ' It was saved offline and will sync to your tracker.' : ''} Enjoy!`, [
        { text: 'Done', onPress: () => goBack() },
        { text: 'Cook again', style: 'cancel', onPress: restart },
      ]);
      return;
    }
    if (cals != null) {
      try {
        await logMeal({ title, calories: cals, protein: prot ?? undefined, carbs: carbs ?? undefined, fat: fat ?? undefined, servings });
      } catch { /* best-effort */ }
    }
    Alert.alert('You made it!', `${title} is ready and ${cals != null ? `was added to your tracker (${cals} kcal).` : 'ready to serve.'} Enjoy!`, [
      { text: 'Done', onPress: () => goBack() },
      { text: 'Cook again', style: 'cancel', onPress: restart },
    ]);
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderRelease: (_e, g) => { if (phase !== 'cook') return; if (g.dx < -24) goNext(); else if (g.dx > 24 && index > 0) goPrev(); },
  })).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent }}>Cooking coach</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
        </View>
        {timers.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: runningCount ? colors.accentSoft : colors.surfaceMuted }}>
            <Timer size={14} color={runningCount ? colors.accent : colors.textSecondary} />
            <Text style={{ color: runningCount ? colors.accent : colors.textSecondary, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {mm(Math.ceil(timerRemaining(timers[0]) / 1000))}
              {timers.length > 1 ? ` +${timers.length - 1}` : ''}
            </Text>
          </View>
        ) : null}
        <Pressable onPress={() => goBack()} hitSlop={8}>
          <X size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {phase === 'prep' ? (
          <>
            {/* progress preview */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ height: 6, width: '0%', borderRadius: 3, backgroundColor: colors.accent }} />
            </View>
            <Text style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>{total} steps · ~{totalTime || '?'} min</Text>

            <View style={{ marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 4 }}>Get ready</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 }}>Ready to cook</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>
                Start by scaling the recipe, then tick off every ingredient you have ready. The coach guides you through each step as you go.
              </Text>

              {/* servings */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Servings</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => setServings((s) => Math.max(1, s - 1))} disabled={servings <= 1} style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed || servings <= 1 ? 0.5 : 1 }]}>
                    <Minus size={15} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={{ minWidth: 30, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{servings}</Text>
                  <Pressable onPress={() => setServings((s) => Math.min(20, s + 1))} style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.5 : 1 }]}>
                    <Plus size={15} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
              {hasNutrition ? (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  kcal {scaledNutrition.calories ?? '—'} · P {scaledNutrition.protein ?? '—'}g · C {scaledNutrition.carbs ?? '—'}g · F {scaledNutrition.fat ?? '—'}g
                </Text>
              ) : null}
            </View>

            {/* ingredients checklist */}
            {ingredients.length > 0 ? (
              <View style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>Your ingredients</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{checkedIng.size}/{ingredients.length} ready</Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  {scaledIngredients.map((ing, i) => {
                    const c = checkedIng.has(i);
                    return (
                      <Pressable key={`${ing}-${i}`} onPress={() => markIngredient(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: c ? colors.success : colors.textSecondary, alignItems: 'center', justifyContent: 'center', backgroundColor: c ? colors.success : 'transparent' }}>
                          {c ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
                        </View>
                        <Text style={[{ fontSize: 14.5, color: colors.textPrimary, flex: 1 }, c && { textDecorationLine: 'line-through', color: colors.textSecondary }]}>{ing}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={() => void sendToShopping()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingVertical: 10, backgroundColor: colors.surfaceMuted, marginTop: 6, opacity: pressed ? 0.7 : 1 }]}>
                  <ShoppingCart size={15} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Add all to shopping list</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ marginTop: 18 }}>
              <AppButton label={checkedIng.size === scaledIngredients.length && scaledIngredients.length > 0 ? 'Start cooking' : `Start cooking (${checkedIng.size}/${scaledIngredients.length} ready)`} variant="dark" icon={<Play size={18} color={colors.darkButtonText} />} onPress={begin} />
            </View>
          </>
        ) : phase === 'done' ? (
          <View style={{ alignItems: 'center', paddingVertical: 46 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={34} color={colors.success} strokeWidth={3} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 18, textAlign: 'center' }}>You made it!</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>{title} is ready to serve.</Text>
            {hasNutrition ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                {scaledNutrition.calories !== null ? <NutChip label="kcal" value={String(scaledNutrition.calories)} /> : null}
                {scaledNutrition.protein !== null ? <NutChip label="protein" value={`${scaledNutrition.protein}g`} /> : null}
                {scaledNutrition.carbs !== null ? <NutChip label="carbs" value={`${scaledNutrition.carbs}g`} /> : null}
                {scaledNutrition.fat !== null ? <NutChip label="fat" value={`${scaledNutrition.fat}g`} /> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {/* progress */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${progress}%`, borderRadius: 3, backgroundColor: colors.accent }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Step {index + 1} of {total} · {doneSteps.size} done</Text>
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '800' }}>{Math.round(progress)}%</Text>
            </View>

            {/* step chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {steps.map((_: string, i: number) => (
                <Pressable key={i} onPress={() => { setIndex(i); const mins = extractMinutes(steps[i] ?? ''); setSuggested(mins); }} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: i === index ? colors.accent : doneSteps.has(i) ? colors.successBg : colors.surfaceMuted }}>
                  {doneSteps.has(i) ? <Check size={15} color={colors.success} strokeWidth={3} /> : <Text style={{ fontSize: 12, fontWeight: '800', color: i === index ? colors.accentText : colors.textSecondary }}>{i + 1}</Text>}
                </Pressable>
              ))}
            </View>

            {/* coach + step card */}
            <View {...pan.panHandlers} style={{ marginTop: 14 }}>
              <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: coach.color }}>{coach.phase}</Text>
                  <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.surfaceMuted }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{stepMinutes ? `~${stepMinutes} min` : 'Quick step'}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 25, lineHeight: 34, color: colors.textPrimary, fontWeight: '700', marginTop: 14 }}>
                  {currentStep}
                </Text>

                {stepIngredients.length > 0 ? (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <ListChecks size={14} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>For this step</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                      {stepIngredients.map((ing, i) => (
                        <View key={i} style={{ borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }}>{ing}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={{ marginTop: 16, borderRadius: 14, backgroundColor: colors.dark ? rgbaHelper('#ffffff', 0.05) : rgbaHelper('#ffffff', 0.7), padding: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>Coach tip</Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 }}>{coach.tip}</Text>
                  <Text style={{ fontSize: 12.5, lineHeight: 18, color: coach.color, marginTop: 8, fontWeight: '600' }}>Look for: {coach.look}</Text>
                </View>

                {/* suggested timer for this step */}
                {stepMinutes && stepMinutes > 0 ? (
                  <Pressable
                    onPress={() => startTimer(stepMinutes)}
                    style={({ pressed }) => [{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingVertical: 12, backgroundColor: colors.cyanBg, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Timer size={17} color={colors.cyan} />
                    <Text style={{ color: colors.cyan, fontWeight: '800', fontSize: 14 }}>
                      {`${t('cooking.startTimer')} · ${stepMinutes} ${t('common.min')}`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* 2.0.0: timer controls - several timers run in parallel */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              {PRESETS.map((m) => (
                <Pressable key={m} onPress={() => startTimer(m)} style={({ pressed }) => [{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{m}m</Text>
                </Pressable>
              ))}
              {timers.length ? (
                <Pressable onPress={() => void clearTimers()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
                  <RotateCcw size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{t('cooking.resetTimer')}</Text>
                </Pressable>
              ) : null}
            </View>

            {timers.length ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {timers.map((timer) => {
                  const left = Math.max(0, Math.ceil(timerRemaining(timer) / 1000));
                  const done = left === 0;
                  return (
                    <View
                      key={timer.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: done ? colors.success : colors.cardBorder,
                        backgroundColor: done ? colors.successBg : colors.card,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                          {timer.label}
                        </Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: done ? colors.success : colors.accent, fontVariant: ['tabular-nums'] }}>
                          {mm(left)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => (timer.running ? void pauseTimer(timer.id) : void resumeTimer(timer.id))}
                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
                      >
                        {timer.running ? <Pause size={15} color={colors.textPrimary} /> : <Play size={15} color={colors.textPrimary} />}
                      </Pressable>
                      <Pressable
                        onPress={() => void extendTimer(timer.id, 1)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 9, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted }}
                      >
                        <Plus size={13} color={colors.textPrimary} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary }}>1m</Text>
                      </Pressable>
                      <Pressable onPress={() => void removeTimer(timer.id)} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} color={colors.rose} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* bottom actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable onPress={goPrev} disabled={index === 0} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, opacity: index === 0 ? 0.5 : pressed ? 0.8 : 1 }]}>
                <ChevronLeft size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Back</Text>
              </Pressable>
              <Pressable onPress={goNext} style={({ pressed }) => [{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                {doneSteps.has(index) ? <Check size={18} color={colors.darkButtonText} /> : <CircleCheck size={18} color={colors.darkButtonText} />}
                <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 15 }}>
                  {doneSteps.has(index) ? (isLast ? 'Finish' : 'Next step') : 'Done — next step'}
                </Text>
                {!isLast ? <ChevronRight size={18} color={colors.darkButtonText} /> : null}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function NutChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, paddingVertical: 8, alignItems: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}


