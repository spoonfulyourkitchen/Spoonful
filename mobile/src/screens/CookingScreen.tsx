import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Maximize2,
  Minus,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  ShoppingCart,
  Square,
  Timer,
  Volume2,
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
import { addTimer, clearTimers, pauseTimer, removeTimer, resumeTimer, timerRemaining, useKitchenTimers } from '../lib/kitchenTimers';
import { recipeLines } from '../lib/recipe';
import { translateLines } from '../lib/recipe-translate';
import { loadStepGuides, type StepGuide } from '../lib/step-guides';
import { speakText, speechAvailable, stopSpeaking } from '../lib/speech';
import { showNotice } from '../components/AppNotice';
import { useAction, useQuery } from '../lib/convex-auth';
import { extractStepMinutes } from '../lib/step-meta';
import { loadExtras, saveExtras, type StepExtras } from '../lib/cooking-extras';
import { pickStepPhoto, takeStepPhoto } from '../lib/photo';
import { editPhotoCrop } from '../lib/photo-crop';
import { CroppedImage } from '../components/CroppedImage';

const BASE_SERVINGS = 2;

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

/** Long steps get a slightly smaller size so the whole instruction fits. */
function stepType(step: string) {
  const length = step.length;
  if (length > 220) return { fontSize: 17.5, lineHeight: 25 } as const;
  if (length > 160) return { fontSize: 19, lineHeight: 27 } as const;
  if (length > 110) return { fontSize: 21, lineHeight: 29 } as const;
  return { fontSize: 24, lineHeight: 32 } as const;
}

function extractMinutes(step: string): number | null {
  return extractStepMinutes(step);
}

function cleanIngredientForShop(line: string): string {
  const t = line.trim();
  const m = t.match(/^(?:[\d\s./,-]+)?(?:(?:cup|tbsp|tsp|g|kg|ml|cl|oz|lb|pinch|clove|cloves|handful|bunch|can|jar)\s+)?(.+)$/i);
  const name = (m ? m[1].trim() : t).toLowerCase();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : line;
}

function StepGuideBlock({
  coach,
  look,
  placeholder,
  coachLabel,
  lookLabel,
}: {
  coach: string | null;
  look: string | null;
  placeholder: string;
  coachLabel: string;
  lookLabel: string;
}) {
  if (!coach && !look) {
    return <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>{placeholder}</Text>;
  }
  return (
    <>
      {coach ? (
        <View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>{coachLabel}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 }}>{coach}</Text>
        </View>
      ) : null}
      {look ? (
        <View style={{ marginTop: coach ? 12 : 0 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>{lookLabel}</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.amber, marginTop: 3, fontWeight: '600' }}>{look}</Text>
        </View>
      ) : null}
    </>
  );
}

import { markReviewAction } from '../lib/review';
import { readIntroAnswers } from '../lib/intro-answers';

export function CookingScreen({ route }: any) {
  useEffect(() => { markReviewAction('cooking'); }, []);
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const p = route.params ?? {};
  const origTitle: string = p.title ?? 'Recipe';
  

  const origSteps: string[] = recipeLines(p.steps).length ? recipeLines(p.steps) : ['Prepare your ingredients and enjoy.'];
  const origIngredients: string[] = recipeLines(p.ingredients);
  const recipeKey: string = String(p.recipeKey ?? origTitle);

  

  const inlineTr = useMemo(
    () =>
      p.translatedSteps && recipeLines(p.translatedSteps).length
        ? {
            title: String(p.translatedTitle ?? origTitle),
            steps: recipeLines(p.translatedSteps),
            ingredients: p.translatedIngredients ? recipeLines(p.translatedIngredients) : [],
          }
        : null,
    [p.translatedTitle, p.translatedSteps, p.translatedIngredients, origTitle],
  );
  const [autoTr, setAutoTr] = useState<{ lang: string; title: string; steps: string[]; ingredients: string[] } | null>(
    inlineTr ? { lang, ...inlineTr } : null,
  );
  const translateRecipeAction = useAction(api.translate.translateRecipe);
  const sourceRef = useRef({ title: origTitle, steps: origSteps, ingredients: origIngredients });
  sourceRef.current = { title: origTitle, steps: origSteps, ingredients: origIngredients };
  const entryLangRef = useRef(lang);

  useEffect(() => {
    let alive = true;
    if (lang === 'en') {
      setAutoTr(null);
      return () => {
        alive = false;
      };
    }
    if (inlineTr && inlineTr.steps.length && entryLangRef.current === lang) {
      setAutoTr({ lang, ...inlineTr });
      return () => {
        alive = false;
      };
    }
    const source = sourceRef.current;
    void translateRecipeAction({
      recipeKey,
      title: source.title,
      description: String(p.description ?? ''),
      ingredients: source.ingredients,
      steps: source.steps,
      targetLanguage: lang,
    } as any)
      .then((res: any) => {
        const trSteps = recipeLines(res?.steps);
        if (!alive || !trSteps.length) return;
        const trIngredients = recipeLines(res?.ingredients);
        setAutoTr({
          lang,
          title: String(res?.title || source.title),
          steps: trSteps,
          ingredients: trIngredients.length ? trIngredients : source.ingredients,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lang, recipeKey, inlineTr, translateRecipeAction, p.description]);

  const tr = autoTr && autoTr.lang === lang ? autoTr : null;
  const view = tr;
  const title: string = view?.title || origTitle;
  const steps: string[] = view?.steps?.length ? view.steps : origSteps;
  const ingredients: string[] = view?.ingredients?.length ? view.ingredients : origIngredients;

  
  const [extras, setExtras] = useState<StepExtras>({ notes: {}, skipped: [], photos: {} });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [photoOpen, setPhotoOpen] = useState(false);
  const [timersOpen, setTimersOpen] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const myProfile = useQuery(api.users.currentUser) as any;

  const profileReady = myProfile !== undefined;
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
  const servingsTouched = useRef(false);

  useEffect(() => {
    if (servingsTouched.current) return;
    let alive = true;
    void readIntroAnswers().then((stored) => {
      if (!alive || servingsTouched.current) return;
      const size = Number(stored?.householdSize ?? 0);
      if (size > 0) setServings(Math.max(1, Math.min(12, size)));
    });
    return () => {
      alive = false;
    };
  }, []);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [checkedIng, setCheckedIng] = useState<Set<number>>(new Set());
  const timers = useKitchenTimers();

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
  

  const [guides, setGuides] = useState<StepGuide[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadStepGuides(recipeKey).then((rows) => {
      if (alive) setGuides(rows);
    });
    return () => {
      alive = false;
    };
  }, [recipeKey]);
  const passedGuides: StepGuide[] | null = Array.isArray(p.guides) ? p.guides : null;
  const guideFor = (i: number) => passedGuides?.find((g) => g.index === i) ?? guides?.find((g) => g.index === i) ?? null;

  

  const [guideText, setGuideText] = useState<{ coach: string | null; look: string | null } | null>(null);
  const rawGuide = guideFor(index);
  useEffect(() => {
    let alive = true;
    const coach = rawGuide?.coach ?? null;
    const look = rawGuide?.look ?? null;
    if (!coach && !look) {
      setGuideText(null);
      return () => {
        alive = false;
      };
    }
    if (lang === 'en') {
      setGuideText({ coach, look });
      return () => {
        alive = false;
      };
    }
    setGuideText({ coach, look });
    void translateLines([coach ?? '', look ?? ''], lang)
      .then(([coachTr, lookTr]) => {
        if (!alive) return;
        setGuideText({ coach: coach ? coachTr : null, look: look ? lookTr : null });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [rawGuide?.coach, rawGuide?.look, lang]);

  
  const [speechOk, setSpeechOk] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void speechAvailable().then((ok) => {
      if (alive) setSpeechOk(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  
  useEffect(() => () => { void stopSpeaking(); }, []);

  const readAloud = async (text: string) => {
    const body = String(text ?? '').trim();
    if (!body) return;
    setSpeaking(true);
    const ok = await speakText(body, lang);
    if (!ok) setSpeaking(false);
  };

  const stopReadAloud = async () => {
    await stopSpeaking();
    setSpeaking(false);
  };

  const toggleSpeak = async () => {
    if (speaking) {
      await stopReadAloud();
      return;
    }
    await readAloud(currentStep);
  };

  
  const openPopup = () => {
    setPopupOpen(true);
    if (speaking) void stopReadAloud();
  };


  useEffect(() => {
    if (!profileReady) return;
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


  const saveStepPhoto = async (source: 'camera' | 'gallery') => {
    try {
      const photo = source === 'camera' ? await takeStepPhoto() : await pickStepPhoto();
      if (!photo) return;
      const mime = photo.type ?? 'image/jpeg';
      const uri = photo.base64 ? `data:${mime};base64,${photo.base64}` : photo.uri;
      if (!uri) return;
      setPhotoOpen(false);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 220));
      await editPhotoCrop(uri);
      setPhotoVersion((v) => v + 1);
      const next = { ...extras, photos: { [String(index)]: uri } };
      setExtras(next);
      void saveExtras(myProfile?.id, recipeKey, next);
    } catch {
      showNotice({ title: t('s.cookPhotoFail'), tone: 'error' });
    }
  };

  const recropStepPhoto = async () => {
    const uri = extras.photos[String(index)];
    if (!uri) return;
    await editPhotoCrop(uri);
    setPhotoVersion((v) => v + 1);
  };

  const removeStepPhoto = () => {
    const photos = { ...extras.photos };
    delete photos[String(index)];
    const next = { ...extras, photos };
    setExtras(next);
    void saveExtras(myProfile?.id, recipeKey, next);
    setPhotoOpen(false);
  };

  
  const markDoneAndNext = () => {
    const d = new Set(doneSteps);
    d.add(index);
    setDoneSteps(d);
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    setPhase('done');
    void finishAndLog();
  };

  

  const sessionKey = `spoonful:cooking:${recipeKey}`;
  

  const [_resumedAt, setResumedAt] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(sessionKey)
      .then((raw) => {
        if (!alive || !raw) return;
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return;
        if (typeof s.index === 'number') {
          const next = Math.max(0, Math.min(total - 1, s.index));
          setIndex(next);
          if (next > 0) setResumedAt(next + 1);
        }
        if (s.phase === 'prep' || s.phase === 'cook' || s.phase === 'done') setPhase(s.phase);
        if (Array.isArray(s.doneSteps)) setDoneSteps(new Set(s.doneSteps.filter((n: unknown) => typeof n === 'number')));
        if (Array.isArray(s.checkedIng)) setCheckedIng(new Set(s.checkedIng.filter((n: unknown) => typeof n === 'number')));
        if (typeof s.servings === 'number' && s.servings > 0) {
          servingsTouched.current = true;
          setServings(s.servings);
        }
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
    void addTimer(mins, label ?? `${title} · ${t('cooking.step')} ${index + 1}`);
  };

  const begin = () => {
    setPhase('cook');
  };

  
  const restartCooking = () => {
    setPhase('prep');
    setIndex(0);
    setDoneSteps(new Set());
    setCheckedIng(new Set());
    void clearTimers();
  };

  const goNext = () => {
    setDoneSteps((d) => new Set(d).add(index));
    if (isLast) {
      setPhase('done');
      void finishAndLog();
      return;
    }
    setIndex(index + 1);
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex((i) => i - 1);
  };

  const markIngredient = (i: number) =>
    setCheckedIng((cur) => { const n = new Set(cur); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const sendToShopping = async () => {
    const names = ingredients.map(cleanIngredientForShop).filter(Boolean);
    if (!names.length) return;
    if (connNow === 'offline') {
      for (const n of names) await addPendingOp('shopping.add', { name: n });
      return;
    }
    try {
      await addManyShop({ items: names.map((n) => ({ name: n, recipeTitle: title })) });
    } catch {
      showNotice({ title: t('s.xCouldNotAdd'), body: t('common.tryAgain'), tone: 'error' });
    }
  };

  const finishAndLog = async () => {
    

    const cals = scaledNutrition.calories;
    const prot = scaledNutrition.protein;
    const carbs = scaledNutrition.carbs;
    const fat = scaledNutrition.fat;
    if (connNow === 'offline') {
      if (cals != null) await addPendingOp('tracker.log', { title, calories: cals, protein: prot ?? null, carbs: carbs ?? null, fat: fat ?? null });
      return;
    }
    if (cals != null) {
      try {
        await logMeal({ title, calories: cals, protein: prot ?? undefined, carbs: carbs ?? undefined, fat: fat ?? undefined, servings });
      } catch {  }
    }
  };

  

  const panAction = useRef({ phase, index, next: markDoneAndNext, prev: goPrev });
  panAction.current = { phase, index, next: markDoneAndNext, prev: goPrev };
  
  const popupAction = useRef({ next: markDoneAndNext, prev: goPrev });
  popupAction.current = { next: markDoneAndNext, prev: goPrev };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderRelease: (_e, g) => {
      const a = panAction.current;
      if (a.phase !== 'cook') return;
      if (g.dx < -24) a.next();
      else if (g.dx > 24 && a.index > 0) a.prev();
    },
  })).current;

  

  const popupPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
      onPanResponderRelease: (_e, g) => {
        const a = popupAction.current;
        if (g.dx < -16) a.next();
        else if (g.dx > 16) a.prev();
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View
        style={{
          backgroundColor: colors.darkButton,
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomLeftRadius: 36,
          borderBottomRightRadius: 36,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', color: rgbaHelper(colors.darkButtonText, 0.62) }}
          >
            {t('s.cookHeader')}
          </Text>
          <Pressable
            onPress={() => goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: rgbaHelper(colors.darkButtonText, 0.22) }}
          >
            <X size={17} color={colors.darkButtonText} />
          </Pressable>
        </View>

        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontWeight: '900', color: colors.darkButtonText, marginTop: 8 }}
        >
          {title}
        </Text>

        {phase === 'cook' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 34, fontWeight: '900', color: colors.darkButtonText, letterSpacing: -1 }}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: rgbaHelper(colors.darkButtonText, 0.72) }}>
                  {t('s.cookStepOf', { n: index + 1, total })}
                </Text>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: rgbaHelper(colors.darkButtonText, 0.26), marginTop: 5, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${progress}%`, borderRadius: 3, backgroundColor: colors.darkButtonText }} />
                </View>
              </View>
            </View>

            {(stepMinutes && stepMinutes > 0) || timers.length ? (
              <Pressable
                onPress={() => {
                  if (timers.length) setTimersOpen(true);
                  else if (stepMinutes && stepMinutes > 0) startTimer(stepMinutes);
                }}
                style={({ pressed }) => [
                  {
                    marginTop: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: rgbaHelper(colors.darkButtonText, 0.35),
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    backgroundColor: rgbaHelper(colors.darkButtonText, timers.length ? 0.3 : 0.18),
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Timer size={15} color={colors.darkButtonText} />
                <Text style={{ flex: 1, color: colors.darkButtonText, fontWeight: '800', fontSize: 13 }}>
                  {timers.length
                    ? mm(Math.ceil(timerRemaining(timers[0]) / 1000))
                    : `${t('cooking.startTimer')} · ${stepMinutes} ${t('common.min')}`}
                </Text>
                {timers.length ? (
                  <>
                    <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 11.5 }}>
                      {t('cooking.timerCount', { n: timers.length })}
                    </Text>
                    <ChevronRight size={14} color={colors.darkButtonText} />
                  </>
                ) : null}
              </Pressable>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {speechOk ? (
                <CookIcon
                  tone="dark"
                  icon={<Volume2 size={18} color={speaking ? colors.darkButton : colors.darkButtonText} />}
                  label={speaking ? t('s.cookListenStop') : t('s.cookListen')}
                  active={speaking}
                  onPress={() => void toggleSpeak()}
                />
              ) : null}
              <CookIcon
                tone="dark"
                icon={<NotebookPen size={18} color={extras.notes[String(index)] ? colors.darkButton : colors.darkButtonText} />}
                label={t('s.cookNote')}
                active={!!extras.notes[String(index)]}
                onPress={() => {
                  setNoteDraft(extras.notes[String(index)] ?? '');
                  setNoteOpen(true);
                }}
              />
              <CookIcon
                tone="dark"
                icon={<Camera size={18} color={extras.photos[String(index)] ? colors.darkButton : colors.darkButtonText} />}
                label={t('s.cookPhoto')}
                active={!!extras.photos[String(index)]}
                onPress={() => setPhotoOpen(true)}
              />
              <CookIcon
                tone="dark"
                icon={<Maximize2 size={18} color={colors.darkButtonText} />}
                label={t('s.cookStepPopup')}
                active={false}
                onPress={openPopup}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={goPrev}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel={t('s.xBack')}
                style={({ pressed }) => [
                  {
                    width: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: rgbaHelper(colors.darkButtonText, 0.2),
                    opacity: index === 0 ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <ChevronLeft size={19} color={colors.darkButtonText} />
              </Pressable>
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 14,
                    paddingVertical: 13,
                    backgroundColor: colors.darkButtonText,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {doneSteps.has(index) ? <Check size={17} color={colors.darkButton} /> : <CircleCheck size={17} color={colors.darkButton} />}
                <Text numberOfLines={1} style={{ color: colors.darkButton, fontWeight: '800', fontSize: 14.5 }}>
                  {doneSteps.has(index)
                    ? isLast
                      ? t('cooking.readyToServe')
                      : t('cooking.nextStep')
                    : t('cooking.nowDoThis')}
                </Text>
                {!isLast ? <ChevronRight size={17} color={colors.darkButton} /> : null}
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10, justifyContent: 'center' }}>
              {steps.map((_step, i) => (
                <Pressable
                  key={i}
                  onPress={() => setIndex(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('cooking.step')} ${i + 1}`}
                  style={{
                    width: doneSteps.has(i) || i === index ? 22 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === index ? colors.darkButtonText : doneSteps.has(i) ? rgbaHelper(colors.darkButtonText, 0.65) : rgbaHelper(colors.darkButtonText, 0.3),
                  }}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'prep' ? (
          <>
            <Text style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>{total} {t('cooking.step')} · ~{totalTime || '?'} min</Text>

            <View style={{ marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 4 }}>{t('s.cookGetReady')}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 }}>{t('s.cookReadyToCook')}</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>
                Start by scaling the recipe, then tick off every ingredient you have ready. The coach guides you through each step as you go.
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{t('s.cookServings')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => { servingsTouched.current = true; setServings((s) => Math.max(1, s - 1)); }} disabled={servings <= 1} style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed || servings <= 1 ? 0.5 : 1 }]}>
                    <Minus size={15} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={{ minWidth: 30, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{servings}</Text>
                  <Pressable onPress={() => { servingsTouched.current = true; setServings((s) => Math.min(20, s + 1)); }} style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.5 : 1 }]}>
                    <Plus size={15} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
              {hasNutrition ? (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  kcal {scaledNutrition.calories ?? '-'} · P {scaledNutrition.protein ?? '-'}g · C {scaledNutrition.carbs ?? '-'}g · F {scaledNutrition.fat ?? '-'}g
                </Text>
              ) : null}
            </View>

            {ingredients.length > 0 ? (
              <View style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.cookYourIngredients')}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.cookReadyCount', { n: checkedIng.size, m: ingredients.length })}</Text>
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
              <AppButton label={t('dialog.startCooking')} variant="dark" icon={<Play size={18} color={colors.darkButtonText} />} onPress={begin} />
            </View>
          </>
        ) : phase === 'done' ? (
          <View style={{ alignItems: 'center', paddingVertical: 46 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={34} color={colors.success} strokeWidth={3} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 18, textAlign: 'center' }}>{t('s.xYouMadeIt')}</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>{t('s.xReadyToServe', { title })}</Text>
            {hasNutrition ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, alignSelf: 'stretch' }}>
                {scaledNutrition.calories !== null ? <NutChip label="kcal" value={String(scaledNutrition.calories)} /> : null}
                {scaledNutrition.protein !== null ? <NutChip label={t('common.protein')} value={`${scaledNutrition.protein}g`} /> : null}
                {scaledNutrition.carbs !== null ? <NutChip label={t('common.carbs')} value={`${scaledNutrition.carbs}g`} /> : null}
                {scaledNutrition.fat !== null ? <NutChip label="fat" value={`${scaledNutrition.fat}g`} /> : null}
              </View>
            ) : null}

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
          <View {...pan.panHandlers} style={{ flexGrow: 1, paddingTop: 4, justifyContent: currentStep.length > 130 ? 'flex-start' : 'center' }}>
            <Text
              style={[{ fontFamily: fonts.display, color: colors.textPrimary, fontWeight: '700' }, stepType(currentStep)]}
            >
              {currentStep}
            </Text>

            {guideText && guideText.coach ? (
              <View style={{ marginTop: 14, borderRadius: 16, backgroundColor: colors.accentSoft, paddingHorizontal: 14, paddingVertical: 11 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.accent }}>
                  {t('s.cookGuideCoach')}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 18.5, color: colors.textPrimary, marginTop: 3 }}>
                  {guideText.coach}
                </Text>
              </View>
            ) : null}

            {guideText && guideText.look ? (
              <View
                style={{
                  marginTop: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: rgbaHelper(colors.amber, 0.35),
                  backgroundColor: rgbaHelper(colors.amber, 0.08),
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.amber }}>
                  {t('s.cookGuideLook')}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 18.5, color: colors.amber, fontWeight: '600', marginTop: 3 }}>
                  {guideText.look}
                </Text>
              </View>
            ) : null}

            {extras.photos[String(index)] ? (
              <Pressable
                onLongPress={() => setPhotoOpen(true)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={t('s.cropLongPress')}
              >
                <CroppedImage
                  uri={extras.photos[String(index)]}
                  cropVersion={photoVersion}
                  style={{ marginTop: 10, width: '100%', height: 96, borderRadius: 14 }}
                />
              </Pressable>
            ) : null}

            {extras.notes[String(index)] ? (
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <NotebookPen size={12} color={colors.textSecondary} style={{ marginTop: 3 }} />
                <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary, fontStyle: 'italic' }}>
                  {extras.notes[String(index)]}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={() => setNoteOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, padding: 16, justifyContent: 'center' }}>
          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>
              {`${t('s.cookNote')} · ${index + 1}`}
            </Text>
            <TextInput
              autoFocus
              multiline
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder={t('s.cookNote')}
              placeholderTextColor={colors.textSecondary}
              style={{
                marginTop: 12,
                minHeight: 110,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <AppButton label={t('common.cancel')} variant="ghost" onPress={() => setNoteOpen(false)} style={{ flex: 1 }} />
              <AppButton label={t('s.cookNoteSave')} onPress={saveNote} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, padding: 16, justifyContent: 'center' }}>
          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>
                {`${t('s.cookPhoto')} · ${index + 1}`}
              </Text>
              <Pressable onPress={() => setPhotoOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <X size={19} color={colors.textSecondary} />
              </Pressable>
            </View>
            {extras.photos[String(index)] ? (
              <CroppedImage
                uri={extras.photos[String(index)]}
                cropVersion={photoVersion}
                style={{ marginTop: 12, width: '100%', height: 220, borderRadius: 14 }}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <AppButton label={t('s.cookCamera')} variant="ghost" onPress={() => void saveStepPhoto('camera')} style={{ flex: 1 }} />
              <AppButton label={t('s.formGallery')} variant="ghost" onPress={() => void saveStepPhoto('gallery')} style={{ flex: 1 }} />
            </View>
            {extras.photos[String(index)] ? (
              <AppButton label={t('s.cropEdit')} variant="ghost" onPress={() => void recropStepPhoto()} style={{ marginTop: 8 }} />
            ) : null}
            {extras.photos[String(index)] ? (
              <AppButton label={t('common.remove')} variant="danger" onPress={removeStepPhoto} style={{ marginTop: 8 }} />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={timersOpen} transparent animationType="fade" onRequestClose={() => setTimersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, padding: 16, justifyContent: 'center' }}>
          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{t('cooking.kitchenTimer')}</Text>
              <Pressable onPress={() => setTimersOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <X size={19} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>{t('cooking.timersHint')}</Text>
            {timers.length ? (
              <View style={{ marginTop: 10 }}>
                {timers.map((timer) => (
                  <View key={timer.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '600', color: colors.textSecondary }}>{timer.label}</Text>
                      <Text style={{ marginTop: 2, fontSize: 20, fontWeight: '800', color: timer.running ? colors.textPrimary : colors.textSecondary }}>
                        {mm(Math.ceil(timerRemaining(timer) / 1000))}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => { void (timer.running ? pauseTimer(timer.id) : resumeTimer(timer.id)); }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={timer.running ? t('cooking.pauseTimer') : t('cooking.resumeTimer')}
                      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}
                    >
                      {timer.running ? <Square size={14} color={colors.textPrimary} /> : <Play size={15} color={colors.textPrimary} />}
                    </Pressable>
                    <Pressable
                      onPress={() => void removeTimer(timer.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.remove')}
                      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}
                    >
                      <X size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>{t('cooking.noTimers')}</Text>
            )}
            {stepMinutes && stepMinutes > 0 ? (
              <AppButton
                label={`${t('cooking.addTimer')} · ${stepMinutes} ${t('common.min')}`}
                onPress={() => startTimer(stepMinutes)}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={popupOpen} transparent animationType="fade" onRequestClose={() => { void stopReadAloud(); setPopupOpen(false); }} statusBarTranslucent>
        <View {...popupPan.panHandlers} style={{ flex: 1, backgroundColor: colors.overlayStrong, padding: 16, justifyContent: 'center' }}>
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.accent }}>
                {t('cooking.step')} {index + 1} {t('cooking.of')} {total}
              </Text>
              <Pressable onPress={() => { void stopReadAloud(); setPopupOpen(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 33, color: colors.textPrimary, fontWeight: '700', marginTop: 12 }}>
              {currentStep}
            </Text>

            <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {speechOk ? (
                <Pressable
                  onPress={() => void toggleSpeak()}
                  accessibilityRole="button"
                  accessibilityLabel={speaking ? t('s.cookListenStop') : t('s.cookListen')}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: speaking ? colors.accent : colors.cardBorder, backgroundColor: speaking ? colors.accentSoft : colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }]}
                >
                  {speaking ? <Square size={13} color={colors.accent} /> : <Volume2 size={14} color={colors.accent} />}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>{speaking ? t('s.cookListenStop') : t('s.cookListen')}</Text>
                </Pressable>
              ) : null}
            </View>

            {(() => {
              const g = guideText;
              if (!g || (!g.coach && !g.look)) {
                return (
                  <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>{t('s.cookGuideSoon')}</Text>
                );
              }
              return (
                <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 12 }}>
                  <StepGuideBlock
                    coach={g.coach}
                    look={g.look}
                    placeholder={t('s.cookGuideSoon')}
                    coachLabel={t('s.cookGuideCoach')}
                    lookLabel={t('s.cookGuideLook')}
                  />
                </View>
              );
            })()}

            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={goPrev}
                disabled={index === 0}
                style={({ pressed }) => [{ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 13, backgroundColor: colors.surfaceMuted, opacity: index === 0 ? 0.45 : pressed ? 0.7 : 1 }]}
              >
                <ChevronLeft size={19} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 13, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
              >
                {doneSteps.has(index) ? <Check size={17} color={colors.darkButtonText} /> : <CircleCheck size={17} color={colors.darkButtonText} />}
                <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 14.5 }}>
                  {doneSteps.has(index) ? (isLast ? t('cooking.readyToServe') : t('cooking.nextStep')) : t('cooking.nowDoThis')}
                </Text>
                {!isLast ? <ChevronRight size={17} color={colors.darkButtonText} /> : null}
              </Pressable>
            </View>

            <Text style={{ marginTop: 10, fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>{t('s.cookPopupHint')}</Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function NutChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', borderRadius: 14, backgroundColor: colors.surfaceMuted, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 9.5, letterSpacing: 0.3, color: colors.textSecondary, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}


function CookIcon({
  icon,
  label,
  active,
  onPress,
  tone = 'light',
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          gap: 3,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: dark
            ? active
              ? colors.darkButtonText
              : rgbaHelper(colors.darkButtonText, 0.3)
            : active
              ? colors.accent
              : colors.cardBorder,
          backgroundColor: dark
            ? active
              ? colors.darkButtonText
              : rgbaHelper(colors.darkButtonText, 0.16)
            : active
              ? colors.accentSoft
              : colors.surfaceMuted,
          paddingVertical: 8,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9.5,
          fontWeight: '800',
          color: dark
            ? active
              ? colors.darkButton
              : colors.darkButtonText
            : active
              ? colors.accent
              : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
