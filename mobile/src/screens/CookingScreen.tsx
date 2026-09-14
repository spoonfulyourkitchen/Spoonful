import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Gauge,
  Languages,
  ListChecks,
  Minus,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShoppingCart,
  SkipForward,
  Timer,
  UsersRound,
  Utensils,
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
import { coachText, detectPhase, type CoachPhase } from '../lib/coach-tips';
import { isTranslatableLanguage } from '../lib/recipe-translate';
import { useAction, useQuery } from '../lib/convex-auth';
import {
  estimateStepMinutes,
  splitSubSteps,
  stepAction,
  stepDependency,
  stepDifficulty,
  stepGroup,
  stepShortText,
  type StepDifficulty,
} from '../lib/step-meta';
import {
  lastActiveAt,
  loadExtras,
  loadSecondRecipe,
  markLastActive,
  saveExtras,
  saveSecondRecipe,
  type SecondRecipe,
  type StepExtras,
} from '../lib/cooking-extras';
import { pickStepPhoto, takeStepPhoto } from '../lib/photo';
import { editPhotoCrop } from '../lib/photo-crop';
import { useCookingAdvanced } from '../lib/app-prefs';
import { CroppedImage } from '../components/CroppedImage';

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

/** Farben + Beschriftung je Coach-Phase (Texte kommen aus coach-tips.ts). */
const PHASE_COLORS: Record<CoachPhase, string> = {
  start: colors.cyan,
  prep: colors.easy,
  combine: colors.cyan,
  cook: colors.accent,
  finish: colors.success,
  next: colors.cyan,
};

export function CookingScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const p = route.params ?? {};
  const origTitle: string = p.title ?? 'Recipe';
  /* 2.0.0: recipes written by other tools may store steps/ingredients as
     objects - coerce everything to strings so scaling and timers cannot crash. */
  const origSteps: string[] = recipeLines(p.steps).length ? recipeLines(p.steps) : ['Prepare your ingredients and enjoy.'];
  const origIngredients: string[] = recipeLines(p.ingredients);
  const recipeKey: string = String(p.recipeKey ?? origTitle);

  /**
   * Übersetzung (2.1.5): kommt der Kochmodus aus der Rezept-Detailseite, die
   * gerade übersetzt angezeigt wird, wird die Übersetzung mitgegeben. Sonst
   * kann man sie hier direkt einschalten - beim Umschalten bleibt alles erhalten
   * (gleiche Schrittzahl, gleiche Portionen), damit Timer und Fortschritt passen.
   */
  const inlineTr = p.translatedSteps && recipeLines(p.translatedSteps).length
    ? {
        title: String(p.translatedTitle ?? origTitle),
        steps: recipeLines(p.translatedSteps),
        ingredients: p.translatedIngredients ? recipeLines(p.translatedIngredients) : [],
      }
    : null;
  const [tr, setTr] = useState<typeof inlineTr>(inlineTr);
  const [showTr, setShowTr] = useState(!!inlineTr);
  const [busyTranslate, setBusyTranslate] = useState(false);
  const translateRecipeAction = useAction(api.translate.translateRecipe);

  const view = showTr && tr ? tr : null;
  const title: string = view?.title || origTitle;
  const steps: string[] = view?.steps?.length ? view.steps : origSteps;
  const ingredients: string[] = view?.ingredients?.length ? view.ingredients : origIngredients;

  /* ── 3.0.0: Kochmodus-Extras ────────────────────────────────────────────── */
  const [extras, setExtras] = useState<StepExtras>({ notes: {}, skipped: [], photos: {} });
  const [showSub, setShowSub] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [second, setSecond] = useState<SecondRecipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [awayFor, setAwayFor] = useState(0);
  const householdCooking = useQuery(api.householdCooking.state) as any[] | undefined;
  const publishCooking = useMutation(api.householdCooking.set);
  const stopCooking = useMutation(api.householdCooking.stop);
  const savedRecipes = useQuery(api.savedRecipes.list) as any[] | undefined;
  const myProfile = useQuery(api.users.currentUser) as any;
  /** true, sobald die Konto-ID bekannt ist (Notizen/Fotos sind pro Konto). */
  const profileReady = myProfile !== undefined;
  /* 3.1.0: Kochmodus advanced (Einstellungen) — aus = klassischer Modus */
  const [cookingAdvanced] = useCookingAdvanced();
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
  /* Coach: Phase + Tipp, der sich nicht wiederholt (siehe lib/coach-tips.ts). */
  const coach = useMemo(() => {
    const ph = detectPhase(currentStep, index, total);
    const txt = coachText(ph, lang, `${index}:${currentStep.slice(0, 48)}`);
    return { phaseKey: ph, phase: t(`s.cookPhase_${ph}`), color: PHASE_COLORS[ph], tip: txt.tip, look: txt.look };
  }, [currentStep, index, total, lang, t]);

  /* ── 3.0.0: Meta je Schritt (Titel, Dauer, Schwierigkeit, Teilschritte) ── */
  const stepMeta = useMemo(
    () =>
      steps.map((s, i) => ({
        action: stepAction(s),
        difficulty: stepDifficulty(s) as StepDifficulty,
        minutes: estimateStepMinutes(s, i, total),
        group: stepGroup(s, i, total),
        dependency: stepDependency(s),
        sub: splitSubSteps(s),
        title: stepShortText(s),
      })),
    [steps, total],
  );
  const currentMeta = stepMeta[index] ?? stepMeta[0];
  const skippedSet = useMemo(() => new Set(extras.skipped), [extras.skipped]);
  const remainingMinutes = useMemo(
    () => stepMeta.reduce((sum, m, i) => (doneSteps.has(i) || skippedSet.has(i) ? sum : sum + m.minutes), 0),
    [stepMeta, doneSteps, skippedSet],
  );
  const elapsedMinutes = extras.startedAt ? Math.max(0, Math.round((Date.now() - extras.startedAt) / 60000)) : 0;
  const groupLabel = (g: string) =>
    g === 'cook' ? t('s.cookGroupCook') : g === 'finish' ? t('s.cookGroupFinish') : t('s.cookGroupPrep');
  const difficultyLabel = (d: StepDifficulty) =>
    d === 'hard' ? t('s.cookDiffHard') : d === 'medium' ? t('s.cookDiffMedium') : t('s.cookDiffEasy');
  const groupColor = (g: string) => (g === 'cook' ? colors.accent : g === 'finish' ? colors.success : colors.textSecondary);
  const difficultyColor = (d: StepDifficulty) => (d === 'hard' ? colors.rose : d === 'medium' ? colors.accent : colors.success);
  const others = (householdCooking ?? []).filter((h) => h.userId !== myProfile?.id && Date.now() - h.at < 12 * 3600 * 1000);
  /** erster noch offener Schritt – Ziel für "Wo war ich?" (Nr. 10) */
  const resumeIndex = stepMeta.findIndex((_m, i) => !doneSteps.has(i) && !skippedSet.has(i));

  /* Extras laden (Notizen, übersprungene Schritte, Fotos, Startzeit) */
  useEffect(() => {
    if (!profileReady) return; // erst laden, wenn die Konto-ID feststeht
    let alive = true;
    loadExtras(myProfile?.id, recipeKey).then((data) => {
      if (!alive) return;
      const next = { ...data, startedAt: data.startedAt ?? Date.now() };
      setExtras(next);
      void saveExtras(myProfile?.id, recipeKey, next);
    });
    return () => {
      alive = false;
    };
  }, [recipeKey, profileReady, myProfile?.id]);

  /* "Wo war ich?" – war die App länger weg? (Nr. 10) */
  useEffect(() => {
    if (!profileReady) return;
    let alive = true;
    lastActiveAt(myProfile?.id, recipeKey).then((ts) => {
      if (!alive || !ts) return;
      const gap = Date.now() - ts;
      if (gap > 5 * 60 * 1000) setAwayFor(gap);
    });
    void markLastActive(myProfile?.id, recipeKey);
    return () => {
      alive = false;
    };
  }, [recipeKey, index, phase, profileReady, myProfile?.id]);

  /* zweites Gericht im Parallel-Modus (Nr. 12) */
  useEffect(() => {
    if (!profileReady) return;
    loadSecondRecipe(myProfile?.id)
      .then(setSecond)
      .catch(() => {});
  }, [profileReady, myProfile?.id]);

  /* Fortschritt im Haushalt veröffentlichen (Nr. 26) */
  useEffect(() => {
    if (phase === 'prep' || !cookingAdvanced) return;
    const timer = setTimeout(() => {
      void publishCooking({ recipeKey, title, step: index, total, done: doneSteps.size }).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [recipeKey, title, index, total, doneSteps, phase, publishCooking, cookingAdvanced]);

  /* beim Verlassen die Koch-Session zurückziehen */
  useEffect(() => () => { void stopCooking().catch(() => {}); }, [stopCooking]);

  /* ── Aktionen (Nr. 4, 16, 17, 8, 12) ───────────────────────────────────── */
  const toggleSkip = (i: number) => {
    const has = extras.skipped.includes(i);
    const next = { ...extras, skipped: has ? extras.skipped.filter((n) => n !== i) : [...extras.skipped, i] };
    setExtras(next);
    void saveExtras(myProfile?.id, recipeKey, next);
    if (!has) {
      const d = new Set(doneSteps);
      d.delete(i);
      setDoneSteps(d);
    }
  };

  const saveNote = () => {
    const key = String(index);
    const notes = { ...extras.notes };
    if (noteDraft.trim()) notes[key] = noteDraft.trim();
    else delete notes[key];
    const next = { ...extras, notes };
    setExtras(next);
    void saveExtras(myProfile?.id, recipeKey, next);
    setNoteOpen(false);
  };

  const attachStepPhoto = () =>
    Alert.alert(t('s.cookPhoto'), undefined, [
      { text: t('s.cookCamera'), onPress: () => void saveStepPhoto('camera') },
      { text: t('s.formGallery'), onPress: () => void saveStepPhoto('gallery') },
      { text: t('common.close'), style: 'cancel' },
    ]);

  /**
   * Schritt-Foto (Nr. 17): bleibt beim **eigenen Konto** - das Bild wird nur
   * lokal als data-URL gespeichert, nie in den Haushalt oder in die Cloud
   * hochgeladen. Andere Haushaltsmitglieder sehen es also nie.
   */
  const saveStepPhoto = async (source: 'camera' | 'gallery') => {
    try {
      const photo = source === 'camera' ? await takeStepPhoto() : await pickStepPhoto();
      if (!photo) return;
      const mime = photo.type ?? 'image/jpeg';
      const uri = photo.base64 ? `data:${mime};base64,${photo.base64}` : photo.uri;
      if (!uri) return;
      // 3.1.0: erst den Ausschnitt festlegen (Popup), dann speichern
      await editPhotoCrop(uri);
      const next = { ...extras, photos: { ...extras.photos, [String(index)]: uri } };
      setExtras(next);
      void saveExtras(myProfile?.id, recipeKey, next);
    } catch {
      Alert.alert(t('s.cookPhotoFail'));
    }
  };

  /** Schritt abhaken und weiter (auch per Wischgeste, Nr. 8). */
  const markDoneAndNext = () => {
    const d = new Set(doneSteps);
    d.add(index);
    setDoneSteps(d);
    setShowSub(false);
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setSuggested(extractMinutes(steps[nextIdx] ?? ''));
      return;
    }
    setPhase('done');
    void finishAndLog();
  };

  const startSecond = (r: any) => {
    const stepsB = recipeLines(r?.steps);
    if (!stepsB.length) return;
    const next: SecondRecipe = {
      recipeKey: String(r?._id ?? r?.recipeKey ?? r?.title ?? 'second'),
      title: String(r?.title ?? t('s.cookSecond')),
      steps: stepsB,
      index: 0,
      done: [],
    };
    setSecond(next);
    void saveSecondRecipe(myProfile?.id, next);
    setPickerOpen(false);
  };

  const advanceSecond = (delta: number) => {
    if (!second) return;
    const nextIndex = Math.max(0, Math.min(second.steps.length - 1, second.index + delta));
    const done = delta > 0 ? [...new Set([...second.done, second.index])] : second.done.filter((n) => n < nextIndex);
    const nextAt = { ...second, index: nextIndex, done };
    setSecond(nextAt);
    void saveSecondRecipe(myProfile?.id, nextAt);
  };

  const dropSecond = () => {
    setSecond(null);
    void saveSecondRecipe(myProfile?.id, null);
  };

  /** Übersetzung ein-/ausschalten (Kochmodus in der App-Sprache). */
  const toggleTranslation = async () => {
    if (showTr) {
      setShowTr(false);
      return;
    }
    if (tr) {
      setShowTr(true);
      return;
    }
    if (!isTranslatableLanguage(lang) || busyTranslate) return;
    setBusyTranslate(true);
    try {
      const res: any = await translateRecipeAction({
        recipeKey,
        title: origTitle,
        description: '',
        ingredients: origIngredients,
        steps: origSteps,
        targetLanguage: lang,
      } as any);
      const stepsNew = recipeLines(res?.steps);
      if (stepsNew.length) {
        setTr({ title: String(res?.title || origTitle), steps: stepsNew, ingredients: recipeLines(res?.ingredients) });
        setShowTr(true);
      } else {
        Alert.alert(t('s.cookTranslateFail'));
      }
    } catch (e) {
      Alert.alert(t('s.cookTranslateFail'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusyTranslate(false);
    }
  };
  const canTranslate = isTranslatableLanguage(lang);

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
  const sessionKey = `spoonful:cooking:${recipeKey}`;
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

  /** 3.1.0: nochmal kochen (Knopf auf dem Endbildschirm). */
  const restartCooking = () => {
    setPhase('prep');
    setIndex(0);
    setDoneSteps(new Set());
    setCheckedIng(new Set());
    setShowSub(false);
    setSuggested(null);
    void clearTimers();
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

  /* Wischgesten: nach links = Schritt fertig (Nr. 8), nach rechts = zurück.
     Die Handler liegen in einem Ref, damit der Responder nicht veraltet. */
  const panAction = useRef({ phase, index, next: markDoneAndNext, prev: goPrev });
  panAction.current = { phase, index, next: markDoneAndNext, prev: goPrev };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderRelease: (_e, g) => {
      const a = panAction.current;
      if (a.phase !== 'cook') return;
      if (g.dx < -24) a.next();
      else if (g.dx > 24 && a.index > 0) a.prev();
    },
  })).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent }}>{t('s.cookHeader')}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
        </View>
        {canTranslate ? (
          <Pressable
            onPress={() => void toggleTranslation()}
            disabled={busyTranslate}
            accessibilityRole="button"
            accessibilityLabel={showTr ? t('s.cookOriginal') : t('s.cookTranslate')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: showTr ? colors.accentSoft : colors.surfaceMuted, opacity: busyTranslate ? 0.6 : 1 }}
          >
            <Languages size={13} color={showTr ? colors.accent : colors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: showTr ? colors.accent : colors.textSecondary }}>
              {busyTranslate ? t('s.cookTranslating') : showTr ? t('s.cookOriginal') : t('s.cookTranslate')}
            </Text>
          </Pressable>
        ) : null}
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
            <Text style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>{total} {t('cooking.step')} · ~{totalTime || '?'} min</Text>

            <View style={{ marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 4 }}>{t('s.cookGetReady')}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 }}>{t('s.cookReadyToCook')}</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>
                Start by scaling the recipe, then tick off every ingredient you have ready. The coach guides you through each step as you go.
              </Text>

              {/* servings */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{t('s.cookServings')}</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.cookYourIngredients')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{checkedIng.size}/{ingredients.length} {t('s.cookReadyCount', { n: checkedIng.size, m: ingredients.length })}</Text>
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
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{t('s.cookAddAllShop')}</Text>
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
                {scaledNutrition.protein !== null ? <NutChip label={t('common.protein')} value={`${scaledNutrition.protein}g`} /> : null}
                {scaledNutrition.carbs !== null ? <NutChip label={t('common.carbs')} value={`${scaledNutrition.carbs}g`} /> : null}
                {scaledNutrition.fat !== null ? <NutChip label="fat" value={`${scaledNutrition.fat}g`} /> : null}
              </View>
            ) : null}

            {/* 3.1.0: nochmal kochen direkt vom Endbildschirm aus */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' }}>
              <AppButton
                label={t('s.cookAgain')}
                variant="dark"
                icon={<RotateCcw size={17} color={colors.darkButtonText} />}
                onPress={restartCooking}
                style={{ flex: 1 }}
              />
              <AppButton label={t('s.cookFinishBtn')} variant="ghost" onPress={() => goBack()} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <>
            {/* Fortschritt: Rezept (groß) + aktueller Schritt (fein) — Nr. 2 (2/2 advanced) */}
            {cookingAdvanced ? (
              <>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${progress}%`, borderRadius: 3, backgroundColor: colors.accent }} />
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 4 }}>
              <View style={{ height: 4, width: `${total ? ((index + 1) / total) * 100 : 0}%`, borderRadius: 2, backgroundColor: colors.cyan }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.cookStepOf', { n: index + 1, total })} · {doneSteps.size}/{total}</Text>
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '800' }}>{Math.round(progress)}%</Text>
            </View>

            {/* Schritt-Überschrift + Zeiten (Nr. 1, 11, 25) */}
            <Text numberOfLines={2} style={{ marginTop: 8, fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
              {groupLabel(currentMeta?.group ?? 'prep')} · {currentMeta?.title}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Gauge size={11} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{difficultyLabel(currentMeta?.difficulty ?? 'easy')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Timer size={11} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{t('s.cookRemaining', { min: remainingMinutes })}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Play size={11} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{t('s.cookElapsed', { min: elapsedMinutes })}</Text>
              </View>
            </View>

            {/* Haushalt: wer ist bei welchem Schritt? (Nr. 26) */}
            {others.length ? (
              <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: rgbaHelper(colors.accent, 0.35), backgroundColor: colors.accentSoft, padding: 10, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <UsersRound size={14} color={colors.accent} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>{t('s.cookHousehold')}</Text>
                </View>
                {others.slice(0, 3).map((h) => (
                  <Pressable
                    key={h.userId}
                    onPress={() => { if (h.recipeKey === recipeKey && h.total === total) setIndex(Math.max(0, Math.min(total - 1, h.step))); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>
                      {t('s.cookHouseholdAt', { name: h.name || '—', n: h.step + 1, total: h.total })}
                    </Text>
                    {h.recipeKey === recipeKey && h.total === total ? (
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.accent }}>{t('s.cookHouseholdJump')}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* "Wo war ich?" nach längerer Pause (Nr. 10) */}
            {awayFor > 0 ? (
              <Pressable
                onPress={() => { if (resumeIndex >= 0) setIndex(resumeIndex); setAwayFor(0); }}
                style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: rgbaHelper(colors.cyan, 0.35), backgroundColor: colors.cyanBg, padding: 10 }}
              >
                <RotateCcw size={15} color={colors.cyan} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.cyan }}>
                    {t('s.cookWhereWasI', { n: (resumeIndex >= 0 ? resumeIndex : index) + 1 })}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{t('s.cookWhereWasIDesc')}</Text>
                </View>
              </Pressable>
            ) : null}
              </>
            ) : (
              /* klassischer Kochmodus: nur Fortschritt + Schritt-Zähler */
              <>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${progress}%`, borderRadius: 3, backgroundColor: colors.accent }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.cookStepOf', { n: index + 1, total })} · {doneSteps.size}/{total}</Text>
                  <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '800' }}>{Math.round(progress)}%</Text>
                </View>
              </>
            )}

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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: coach.color }}>{coach.phase}</Text>
                  {cookingAdvanced ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {/* Gruppierung Vorbereitung / Kochen / Finish (Nr. 3) */}
                    <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: rgbaHelper(groupColor(currentMeta?.group ?? 'prep'), 0.16) }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: groupColor(currentMeta?.group ?? 'prep') }}>{groupLabel(currentMeta?.group ?? 'prep')}</Text>
                    </View>
                    {/* Schwierigkeit des Schritts (Nr. 28) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.surfaceMuted }}>
                      <Gauge size={11} color={difficultyColor(currentMeta?.difficulty ?? 'easy')} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{difficultyLabel(currentMeta?.difficulty ?? 'easy')}</Text>
                    </View>
                    {/* Dauer dieses Schritts (Nr. 11) */}
                    <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.surfaceMuted }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{`~${currentMeta?.minutes ?? 0} min`}</Text>
                    </View>
                  </View>
                  ) : (
                    /* klassisch: nur die Zeit-Schätzung des Schritts */
                    <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.surfaceMuted }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{stepMinutes ? `~${stepMinutes} min` : t('s.cookQuickStep')}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 25, lineHeight: 34, color: colors.textPrimary, fontWeight: '700', marginTop: 14 }}>
                  {currentStep}
                </Text>

                {/* Abhängigkeiten + Teilschritte + Notiz/Foto/Skip (nur advanced) */}
                {cookingAdvanced ? (
                  <>
                {/* Abhängigkeiten: "läuft parallel" / "warten bis gar" (Nr. 14) */}
                {currentMeta?.dependency ? (
                  <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.cyanBg }}>
                    <Timer size={12} color={colors.cyan} />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.cyan }}>
                      {currentMeta.dependency === 'meanwhile' ? t('s.cookDependMeanwhile') : t('s.cookDependWait')}
                    </Text>
                  </View>
                ) : null}

                {/* Teilschritte aufklappen (Nr. 6) */}
                {currentMeta?.sub && currentMeta.sub.length > 1 ? (
                  <View style={{ marginTop: 12 }}>
                    <Pressable onPress={() => setShowSub((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{t('s.cookSubSteps')} ({currentMeta.sub.length})</Text>
                      {showSub ? <ChevronUp size={14} color={colors.accent} /> : <ChevronDown size={14} color={colors.accent} />}
                    </Pressable>
                    {showSub ? (
                      <View style={{ marginTop: 8, gap: 6 }}>
                        {currentMeta.sub.map((part, i) => (
                          <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textSecondary }}>{i + 1}.</Text>
                            <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.textPrimary }}>{part}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {stepIngredients.length > 0 ? (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <ListChecks size={14} color={colors.textSecondary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('s.cookForStep')}</Text>
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

                {/* Notiz (Nr. 16), Foto (Nr. 17), Schritt überspringen (Nr. 4) */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <Pressable
                    onPress={() => { setNoteDraft(extras.notes[String(index)] ?? ''); setNoteOpen((v) => !v); }}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: extras.notes[String(index)] ? colors.accentSoft : colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <NotebookPen size={14} color={extras.notes[String(index)] ? colors.accent : colors.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: extras.notes[String(index)] ? colors.accent : colors.textSecondary }}>{t('s.cookNote')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void attachStepPhoto()}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: extras.photos[String(index)] ? colors.accentSoft : colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Camera size={14} color={extras.photos[String(index)] ? colors.accent : colors.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: extras.photos[String(index)] ? colors.accent : colors.textSecondary }}>{t('s.cookPhoto')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSkip(index)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: skippedSet.has(index) ? rgbaHelper(colors.rose, 0.14) : colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <SkipForward size={14} color={skippedSet.has(index) ? colors.rose : colors.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: skippedSet.has(index) ? colors.rose : colors.textSecondary }}>
                      {skippedSet.has(index) ? t('s.cookSkipped') : t('s.cookSkip')}
                    </Text>
                  </Pressable>
                </View>

                {noteOpen ? (
                  <View style={{ marginTop: 10 }}>
                    <TextInput
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      placeholder={t('s.cookNote')}
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, minHeight: 62, textAlignVertical: 'top' }}
                    />
                    <Pressable onPress={saveNote} style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 8, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                      <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13 }}>{t('s.cookNoteSave')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {!noteOpen && extras.notes[String(index)] ? (
                  <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.textSecondary, fontStyle: 'italic' }}>{extras.notes[String(index)]}</Text>
                ) : null}
                {extras.photos[String(index)] ? (
                  <CroppedImage uri={extras.photos[String(index)]} style={{ marginTop: 10, width: '100%', height: 150, borderRadius: 14 }} />
                ) : null}
                  </>
                ) : null}

                <View style={{ marginTop: 16, borderRadius: 14, backgroundColor: colors.dark ? rgbaHelper('#ffffff', 0.05) : rgbaHelper('#ffffff', 0.7), padding: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>{t('s.cookCoachTip')}</Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 }}>{coach.tip}</Text>
                  <Text style={{ fontSize: 12.5, lineHeight: 18, color: coach.color, marginTop: 8, fontWeight: '600' }}>{t('s.cookLookFor')} {coach.look}</Text>
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

            {/* Zweites Gericht parallel kochen (Nr. 12) — nur advanced */}
            {cookingAdvanced ? (
              <>
            {second ? (
              <View style={{ marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Utensils size={14} color={colors.accent} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{second.title}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                    {t('s.cookStepOf', { n: second.index + 1, total: second.steps.length })}
                  </Text>
                  <Pressable onPress={dropSecond} hitSlop={8} style={{ marginLeft: 4 }}>
                    <X size={15} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 8 }}>
                  <View style={{ height: 4, width: `${second.steps.length ? (second.done.length / second.steps.length) * 100 : 0}%`, borderRadius: 2, backgroundColor: colors.accent }} />
                </View>
                <Text numberOfLines={4} style={{ marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary }}>
                  {second.steps[second.index]}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => advanceSecond(-1)}
                    disabled={second.index === 0}
                    style={({ pressed }) => [{ width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, backgroundColor: colors.surfaceMuted, opacity: second.index === 0 ? 0.45 : pressed ? 0.7 : 1 }]}
                  >
                    <ChevronLeft size={17} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable
                    onPress={() => advanceSecond(1)}
                    style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Check size={16} color={colors.darkButtonText} />
                    <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13.5 }}>
                      {t('s.cookStepOf', { n: Math.min(second.steps.length, second.index + 2), total: second.steps.length })}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 12, opacity: pressed ? 0.75 : 1 }]}
              >
                <Plus size={15} color={colors.accent} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{t('s.cookSecondAdd')}</Text>
              </Pressable>
            )}
              </>
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

      {/* zweites Gericht wählen (Nr. 12) */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.5), justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 26, maxHeight: '72%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{t('s.cookSecondPick')}</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(savedRecipes ?? []).slice(0, 50).map((r, i) => {
                const count = recipeLines(r?.steps).length;
                return (
                  <Pressable
                    key={String(r?.recipeKey ?? r?._id ?? i)}
                    onPress={() => startSecond(r)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Utensils size={15} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary }}>{String(r?.title ?? '')}</Text>
                    <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{count}</Text>
                  </Pressable>
                );
              })}
              {(savedRecipes ?? []).length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, paddingVertical: 8 }}>{t('s.cookSecondAdd')}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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


