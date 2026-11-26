import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import { Minus, Plus, Send, SlidersHorizontal, Sparkles, Trash2, Video, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAction, useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { AppButton, Chip, GlassCard, PageHeader, TextField } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { CollectionModal } from '../components/CollectionModal';
import { asRecipeFromDoc } from '../lib/recipe';
import { setAiRunning, setAiDone, setAiError } from '../lib/aiTask';
import { notifyAiReady } from '../lib/notifications';
import { useConnectivity, retryConnectivity, addPendingOp, getConnNow } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { OfflineTv } from '../components/OfflineTv';
import { recipeFromVideo, type VideoRecipe } from '../lib/video-recipe';
import { takePendingVideoUrl, usePendingVideoUrl } from '../lib/share-target';
import { useTutorialTarget } from '../lib/tutorial';
import { markReviewAction } from '../lib/review';
import { readIntroAnswers } from '../lib/intro-answers';
import { computeTargets, useNutritionProfile } from '../lib/nutrition-profile';
import { saveLocalPrefs, useLocalPrefs } from '../lib/local-prefs';
import { experienceForAi, skillLevel } from '../lib/skill';

const QUICK = ['eggs', 'tomato', 'cheese', 'pasta', 'rice', 'chicken', 'onion', 'garlic', 'spinach', 'potato'];
const ONBOARDING_CUISINES: Record<string, string> = {
  cItalian: 'Italian', cAsian: 'Asian', cMexican: 'Mexican',
  cIndian: 'Indian', cMiddleEast: 'Middle Eastern', cFrench: 'French',
};
const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb', 'high-protein', 'nut-free', 'keto'];

export function AssistantScreen() {
  const generate = useAction(api.ai.generateRecipe);
  const createRecipe = useMutation(api.recipes.create);
  const profile = useQuery(api.users.currentUser) as any;
  const localPrefs = useLocalPrefs();
  const collections = useQuery(api.collections.list) as any[] | undefined;
  const saveRecipe = useMutation(api.savedRecipes.save);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [prefs, setPrefs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const saved = !!draftKey && savedKey === draftKey;
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [mode, setMode] = useState<'ingredients' | 'describe' | 'video'>('ingredients');
  const [freeText, setFreeText] = useState('');
  const [servings, setServings] = useState(4);
  const [cuisinePick, setCuisinePick] = useState('');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [difficultyPick, setDifficultyPick] = useState('');
  const [spice, setSpice] = useState('');
  const [lighter, setLighter] = useState(false);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);
  
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoRecipe, setVideoRecipe] = useState<VideoRecipe | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  

  const [reroll, setReroll] = useState(false);
  const aiTarget = useTutorialTarget('tut-ai-generate');
  const nutrition = useNutritionProfile();
  const targets = useMemo(() => computeTargets(nutrition), [nutrition]);

  useEffect(() => {
    void readIntroAnswers().then((stored) => {
      const fallback = Number(profile?.householdSize ?? localPrefs.householdSize ?? 0);
      if (stored?.householdSize) setServings(Math.max(1, Math.min(12, stored.householdSize)));
      else if (fallback > 0) setServings(Math.max(1, Math.min(12, fallback)));
      const minutes = Number(stored?.cookTime);
      if (Number.isFinite(minutes) && minutes > 0) setMaxMinutes(Math.min(120, Math.round(minutes)));
      const cuisines = (stored?.cuisines ?? []).map((key) => ONBOARDING_CUISINES[key]).filter(Boolean);
      if (cuisines.length) setFavoriteCuisines(cuisines);
    }).catch(() => {});
  }, [localPrefs.householdSize, profile?.householdSize]);

  useEffect(() => {
    if (!aiTarget.active || ingredients.length) return;
    setIngredients(['eggs', 'tomato', 'cheese']);
  }, [aiTarget.active, ingredients.length]);

  const grabVideoRecipe = async (override?: string) => {
    const link = String(override ?? videoUrl).trim();
    setVideoBusy(true);
    setVideoFailed(false);
    setVideoRecipe(null);
    try {
      const found = await recipeFromVideo(link, { languages: [lang, 'de', 'en'] });
      if (found) setVideoRecipe(found);
      else setVideoFailed(true);
    } catch {
      setVideoFailed(true);
    } finally {
      setVideoBusy(false);
    }
  };
  const saveVideoRecipe = async () => {
    if (!videoRecipe) return;
    try {
      await createRecipe({
        title: videoRecipe.title,
        description: videoRecipe.source,
        ingredients: videoRecipe.ingredients,
        steps: videoRecipe.steps,
      });
      setVideoRecipe(null);
      setVideoUrl('');
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    }
  };

  
  const sharedVideoUrl = usePendingVideoUrl();

  const CUISINES = ['italian', 'asian', 'thai', 'indian', 'mexican', 'turkish', 'mediterranean'];
  const TIMES = [15, 30, 45, 60];
  const EQUIPMENT = [
    { value: '', label: 'anything' },
    { value: 'stove and one pan', label: 'one pan' },
    { value: 'oven', label: 'oven' },
    { value: 'air fryer', label: 'air fryer' },
    { value: 'microwave', label: 'microwave' },
  ];
  const { width: AW } = useWindowDimensions();
  const pageX = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(0);

  const settle = (index: number) => {
    const clamped = index < 0 ? 0 : index > 2 ? 2 : index;
    pageRef.current = clamped;
    setMode(clamped === 2 ? 'video' : clamped === 1 ? 'describe' : 'ingredients');
    Animated.spring(pageX, {
      toValue: -clamped * AW,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
      overshootClamping: true,
    }).start();
  };

  

  const videoActions = useRef({ settle, grabVideoRecipe });
  videoActions.current = { settle, grabVideoRecipe };
  useEffect(() => {
    const url = sharedVideoUrl ?? takePendingVideoUrl();
    if (!url) return;
    setVideoUrl(url);
    videoActions.current.settle(2);
    void videoActions.current.grabVideoRecipe(url);
  }, [sharedVideoUrl]);

  const pageHint = { fontSize: 12, color: colors.textSecondary, marginBottom: 10 } as const;

  useEffect(() => {
    pageX.setValue(-pageRef.current * AW);
  }, [AW, pageX]);

  
  const pageDots = (active: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Pressable onPress={() => settle(0)} hitSlop={10} style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: active === 0 ? colors.accent : colors.surfaceMuted }} />
      </Pressable>
      <Pressable onPress={() => settle(1)} hitSlop={10} style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: active === 1 ? colors.accent : colors.surfaceMuted }} />
      </Pressable>
      <Pressable onPress={() => settle(2)} hitSlop={10} style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: active === 2 ? colors.accent : colors.surfaceMuted }} />
      </Pressable>
    </View>
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const base = -pageRef.current * AW;
        let next = base + g.dx;
        if (next > 0) next *= 0.35;
        else if (next < -2 * AW) next = -2 * AW + (next + 2 * AW) * 0.35;
        pageX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = -pageRef.current * AW;
        const next = base + g.dx;
        const flung = Math.abs(g.vx) > 0.45;
        if ((flung && g.vx < 0) || (!flung && next < -AW * 0.35)) settle(pageRef.current + 1);
        else if ((flung && g.vx > 0) || (!flung && next > AW * 0.35)) settle(pageRef.current - 1);
        else settle(pageRef.current);
      },
      onPanResponderTerminate: () => settle(pageRef.current),
    }),
  ).current;

  const AI_HISTORY_KEY = 'spoonful:ai-history';

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(AI_HISTORY_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch {  }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const pushHistory = (item: any) => {
    setHistory((cur) => {
      const next = [item, ...cur].slice(0, 24);
      void AsyncStorage.setItem(AI_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    void AsyncStorage.removeItem(AI_HISTORY_KEY).catch(() => {});
  };

  const conn = useConnectivity();
  const { t, lang } = useTranslation();
  if (conn === 'offline') {
    return (
      <OfflineTv
        title={t('nav.ai')}
        message={t('s.xOfflineAiBody')}
        onRetry={() => { void retryConnectivity(); }}
      />
    );
  }

  const addIngredient = (ing: string) => {
    const v = ing.trim().toLowerCase();
    if (!v) return;
    setDraft('');
    setIngredients((cur) => (cur.includes(v) ? cur : [...cur, v]));
  };
  const togglePref = (p: string) => setPrefs((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const removeIng = (ing: string) => setIngredients((cur) => cur.filter((x) => x !== ing));

  const run = async () => {
    const describing = mode === 'describe';
    if (describing && !freeText.trim()) { setError('Describe what you feel like cooking.'); return; }
    if (!describing && !ingredients.length) { setError('Add a few ingredients you have on hand first.'); return; }
    setError(null);
    setBusy(true);
    setResult(null);
    setDraftKey('');
    setSavedKey(null);
    setAiRunning();
    try {
      const r = await generate(
        {
          ...(describing
            ? { prompt: freeText.trim() }
            : { availableIngredients: ingredients.join(', ') }),
          dietaryPreferences: prefs.join(', '),
          experience: experienceForAi(skillLevel(profile?.cookingExperience || localPrefs.experience, localPrefs.startedAt)),
          goal: profile?.goal || localPrefs.goal || '',
          diet: profile?.diet || localPrefs.diet || '',
          allergies: (profile?.allergies?.length ? profile.allergies : localPrefs.allergies) ?? [],
          servings,
          targets,
          weight: nutrition.weight,
          targetWeight: nutrition.targetWeight,
          favoriteCuisines,
          cuisine: cuisinePick,
          maxMinutes: maxMinutes ?? undefined,
          difficulty: difficultyPick,
          spice,
          lighter,
          kidFriendly,
          equipment,
          avoidTitles: history.map((h: any) => String(h?.title ?? '')).filter(Boolean),
          explain: true,
          temperature: reroll ? 1.0 : 0.7,
        },
      );
      setResult(r);
      setDraftKey(`assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      setPreview(true);
      pushHistory(r);
      markReviewAction('ai');
      setAiDone(r?.title ?? 'Recipe ready');
      void notifyAiReady(r?.title ?? 'Recipe');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('s.errBody'));
      setAiError();
    } finally {
      setBusy(false);
    }
  };

  const filterCount =
    prefs.length +
    (cuisinePick ? 1 : 0) +
    (maxMinutes ? 1 : 0) +
    (difficultyPick ? 1 : 0) +
    (spice ? 1 : 0) +
    (equipment ? 1 : 0) +
    (lighter ? 1 : 0) +
    (kidFriendly ? 1 : 0);

  const resetFilters = () => {
    setPrefs([]);
    setCuisinePick('');
    setMaxMinutes(null);
    setDifficultyPick('');
    setSpice('');
    setEquipment('');
    setLighter(false);
    setKidFriendly(false);
  };

  const saveToMine = () => {
    if (!result || saved || !draftKey) return;
    setCollectionPickerOpen(true);
  };

  const saveGeneratedRecipe = async (collectionId: string | null) => {
    if (!result || saved || !draftKey) return;
    setCollectionPickerOpen(false);
    const payload = {
      recipeKey: draftKey,
      title: result.title ?? 'AI recipe',
      description: result.description ?? '',
      ingredients: result.ingredients ?? [],
      steps: result.steps ?? [],
      guides: result.guides ?? [],
      prepTime: result.prepTime ?? 0,
      cookTime: result.cookTime ?? 0,
      cuisine: result.cuisine ?? 'Other',
      dietaryRestrictions: result.dietaryRestrictions ?? [],
      imageUrl: result.imageUrl,
      difficulty: result.difficulty ?? 'medium',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      tips: result.tips ?? [],
      note: result.note,
      collectionIds: collectionId ? [collectionId] : [],
    };
    try {
      if (getConnNow() === 'offline') await addPendingOp('saved.save', payload);
      else await saveRecipe(payload);
      setSavedKey(draftKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the recipe.');
    }
  };

  const openResult = () => {
    if (!result) return;
    navigate('RecipeDetail', {
      recipeId: 'assistant', title: result.title ?? 'AI recipe', source: 'assistant',
      recipe: asRecipeFromDoc(result, 'assistant'),
      guides: result.guides ?? [],
    });
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" directionalLockEnabled nestedScrollEnabled>
        <PageHeader eyebrow="Spoonful · AI Chef" title={t('assistant.title')} />

        

          


        <View style={{ overflow: 'hidden', marginHorizontal: -18 }} {...pan.panHandlers}>
        <Animated.View style={{ width: AW * 3, flexDirection: 'row', transform: [{ translateX: pageX }] }}>

        <View style={{ width: AW, paddingHorizontal: 18 }}>
        {pageDots(pageRef.current)}
        <GlassCard pad={16} radius={22}>
          <Text style={fieldLabel}>{t('s.chefIngredientsAvail')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {ingredients.map((ing) => (
              <Chip key={ing} label={ing} active onPress={() => removeIng(ing)} icon={<Text style={{ color: colors.accentText, fontWeight: '800' }}>×</Text>} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField value={draft} onChangeText={setDraft} placeholder={t('s.chefIngredientPh')} onSubmitEditing={() => addIngredient(draft)} style={{ marginBottom: 0 }} />
            </View>
            <Pressable onPress={() => addIngredient(draft)} style={({ pressed }) => [{ marginBottom: 14, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
              <Send size={18} color={colors.accentText} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={[fieldLabel, { marginTop: 6 }]}>{t('s.chefSuggestions')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map((q) => (
              <Chip key={q} label={q} active={ingredients.includes(q)} onPress={() => addIngredient(q)} />
            ))}
          </View>
        </GlassCard>
        </View>

        <View style={{ width: AW, paddingHorizontal: 18 }}>
        {pageDots(pageRef.current)}
        <GlassCard pad={16} radius={22}>
          <Text style={fieldLabel}>{t('s.chefDescribe')}</Text>
          <TextInput
            value={freeText}
            onChangeText={setFreeText}
            placeholder={t('s.xPhDescribe')}
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, padding: 12, fontSize: 15 }}
          />
        </GlassCard>
        </View>
          <View style={{ width: AW, paddingHorizontal: 18 }}>
            {pageDots(pageRef.current)}
            <GlassCard pad={16} radius={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Video size={16} color={colors.accent} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{t('s.videoTitle')}</Text>
              </View>
              <TextField value={videoUrl} onChangeText={setVideoUrl} placeholder={t('s.videoUrlPh')} autoCapitalize="none" keyboardType="url" />
              <AppButton label={t('s.videoGet')} variant="dark" busy={videoBusy} onPress={() => void grabVideoRecipe()} />
              {videoFailed ? <Text style={[pageHint, { marginTop: 10 }]}>{t('s.videoNoRecipe')}</Text> : null}
              {videoRecipe ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{videoRecipe.title}</Text>
                  <Text style={pageHint}>{t('s.videoFound', { ing: videoRecipe.ingredients.length, steps: videoRecipe.steps.length })}</Text>
                  {videoRecipe.textSource === 'ai' ? (
                    <Text style={[pageHint, { color: colors.accent }]}>{t('s.videoFromAi')}</Text>
                  ) : null}
                  {videoRecipe.needsReview ? (
                    <Text style={[pageHint, { color: colors.accent }]}>{t('s.videoCheck')}</Text>
                  ) : null}
                  <Text style={[fieldLabel, { marginTop: 10 }]}>{t('recipe.ingredients')}</Text>
                  {videoRecipe.ingredients.map((line, i) => <Text key={'vi' + i} style={{ fontSize: 13, color: colors.textPrimary, marginTop: 3 }}>{'• '}{line}</Text>)}
                  <Text style={[fieldLabel, { marginTop: 10 }]}>{t('recipe.steps')}</Text>
                  {videoRecipe.steps.map((line, i) => <Text key={'vs' + i} style={{ fontSize: 13, color: colors.textPrimary, marginTop: 3 }}>{i + 1}. {line}</Text>)}
                  <AppButton label={t('s.videoSave')} variant="dark" style={{ marginTop: 14 }} onPress={() => void saveVideoRecipe()} />
                </View>
              ) : null}
            </GlassCard>
          </View>

        </Animated.View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Pressable onPress={() => { const next = Math.max(1, servings - 1); setServings(next); void saveLocalPrefs({ householdSize: next }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="minus">
              <Minus size={14} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary, minWidth: 62, textAlign: 'center' }}>
              {servings} {t('common.servingsUnit')}
            </Text>
            <Pressable onPress={() => { const next = Math.min(12, servings + 1); setServings(next); void saveLocalPrefs({ householdSize: next }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="plus">
              <Plus size={14} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
              borderWidth: 1, borderColor: filterCount ? colors.accent : colors.cardBorder,
              backgroundColor: filterCount ? colors.accentSoft : colors.card,
              paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.85 : 1,
            }]}
          >
            <SlidersHorizontal size={15} color={filterCount ? colors.accent : colors.textPrimary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: filterCount ? colors.accent : colors.textPrimary }}>
              {lang === 'de' ? 'Filter' : 'Filters'}
            </Text>
            {filterCount ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, paddingHorizontal: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accentText }}>{filterCount}</Text>
              </View>
            ) : null}
          </Pressable>

        </View>

        <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setFiltersOpen(false)} />
            <View style={{ maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16 }}>
                <Text style={{ flex: 1, fontSize: 19, fontWeight: '800', color: colors.textPrimary }}>
                  {lang === 'de' ? 'Filter' : 'Filters'}
                </Text>
                <Pressable onPress={() => setFiltersOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 16 }}>
                <Text style={[fieldLabel, { marginTop: 10 }]}>{t('s.chefDietary')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {DIETS.map((p) => (
                    <Chip key={p} label={p} active={prefs.includes(p)} tone={prefs.includes(p) ? 'green' : 'neutral'} onPress={() => togglePref(p)} />
                  ))}
                </View>

                <Text style={[fieldLabel, { marginTop: 14 }]}>{t('s.chefCuisine')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label={t('s.chefAny')} active={cuisinePick === ''} tone="neutral" onPress={() => setCuisinePick('')} />
                  {CUISINES.map((c) => (
                    <Chip key={c} label={c} active={cuisinePick === c} onPress={() => setCuisinePick(cuisinePick === c ? '' : c)} />
                  ))}
                </View>

                <Text style={[fieldLabel, { marginTop: 14 }]}>{t('s.chefReadyIn')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label={t('s.chefAny')} active={maxMinutes === null} tone="neutral" onPress={() => setMaxMinutes(null)} />
                  {TIMES.map((m) => (
                    <Chip key={m} label={`${m} ${t('common.min')}`} active={maxMinutes === m} onPress={() => setMaxMinutes(maxMinutes === m ? null : m)} />
                  ))}
                </View>

                <Text style={[fieldLabel, { marginTop: 14 }]}>{t('s.chefDiffHeat')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label={t('s.chefAny')} active={difficultyPick === '' && spice === ''} tone="neutral" onPress={() => { setDifficultyPick(''); setSpice(''); }} />
                  {['easy', 'medium', 'hard'].map((d) => (
                    <Chip key={d} label={d} active={difficultyPick === d} onPress={() => setDifficultyPick(difficultyPick === d ? '' : d)} />
                  ))}
                  <Chip label={t('s.chefMild')} active={spice === 'mild'} onPress={() => setSpice(spice === 'mild' ? '' : 'mild')} />
                  <Chip label={t('s.chefMedium')} active={spice === 'medium'} onPress={() => setSpice(spice === 'medium' ? '' : 'medium')} />
                  <Chip label="hot" active={spice === 'hot'} onPress={() => setSpice(spice === 'hot' ? '' : 'hot')} />
                </View>

                <Text style={[fieldLabel, { marginTop: 14 }]}>{t('s.chefTools')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {EQUIPMENT.map((e) => (
                    <Chip key={e.label} label={e.label} active={equipment === e.value} onPress={() => setEquipment(e.value)} />
                  ))}
                </View>

                <Text style={[fieldLabel, { marginTop: 14 }]}>{lang === 'de' ? 'Extras' : 'Extras'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip label={t('s.chefLighter')} active={lighter} tone={lighter ? 'green' : 'neutral'} onPress={() => setLighter((v) => !v)} />
                  <Chip label={t('s.chefKid')} active={kidFriendly} tone={kidFriendly ? 'green' : 'neutral'} onPress={() => setKidFriendly((v) => !v)} />
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 22, paddingTop: 6 }}>
                <Pressable onPress={resetFilters} accessibilityRole="button" style={({ pressed }) => [{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.textSecondary }}>{lang === 'de' ? 'Zurücksetzen' : 'Reset'}</Text>
                </Pressable>
                <Pressable onPress={() => setFiltersOpen(false)} accessibilityRole="button" style={({ pressed }) => [{ flex: 1, paddingVertical: 13, borderRadius: 999, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.darkButtonText }}>{t('common.done')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 10 }}>{error}</Text> : null}
        <AppButton label={busy ? t('assistant.generating') : t('assistant.generate')} variant="dark" style={{ marginTop: 14 }} busy={busy} icon={!busy ? <Sparkles size={18} color={colors.darkButtonText} /> : undefined} onPress={() => { aiTarget.onPress(); void run(); }} />

        {result ? (
          <Pressable
            onPress={() => {
              setReroll(true);
              void run().finally(() => setReroll(false));
            }}
            style={({ pressed }) => [
              { marginTop: 8, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 11, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>{t('s.chefReroll')} - something new</Text>
          </Pressable>
        ) : null}

        {history.length > (result ? 1 : 0) ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={fieldLabel}>{t('s.chefRecents')}</Text>
              <Pressable onPress={clearHistory} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Trash2 size={13} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('s.chefClearHistory')}</Text>
              </Pressable>
            </View>
            {history.slice(result ? 1 : 0, (result ? 1 : 0) + 6).map((h: any, i: number) => (
              <Pressable key={i} onPress={() => { setResult(h); setPreview(true); }} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                <Text style={{ fontSize: 14.5, color: colors.textPrimary, fontWeight: '600' }}>{h.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{h.cuisine} · {h.calories ?? '?'} kcal</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <CollectionModal
        visible={collectionPickerOpen}
        collections={collections ?? []}
        mode="pick"
        onChoose={(collectionId) => { void saveGeneratedRecipe(collectionId); }}
        onClose={() => setCollectionPickerOpen(false)}
      />

      {result && preview ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreview(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 }}>
              <View style={{ borderRadius: 26, backgroundColor: colors.card, overflow: 'hidden' }}>
                <RecipeImage uri={result.imageUrl} style={{ width: '100%', height: 210 }} />
                <Pressable onPress={() => setPreview(false)} hitSlop={8} style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color="#fff" />
                </Pressable>
                <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ padding: 18 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif' }}>{result.title}</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                    {result.cuisine || 'Home cooking'} · {result.calories ?? '?'} kcal · {result.prepTime ?? 0} min prep
                  </Text>
                  <View style={{ marginTop: 16, gap: 10 }}>
                    <AppButton label={t('s.chefViewRecipe')} variant="dark" icon={<Sparkles size={17} color={colors.darkButtonText} />} onPress={() => { setPreview(false); openResult(); }} />
                    <Pressable onPress={() => void saveToMine()} disabled={saved} style={({ pressed }) => [{ borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: saved ? colors.success : colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                      <Text style={{ color: saved ? readableText(colors.success) : colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{saved ? `${t('assistant.saved')} ✓` : t('assistant.saveToRecipes')}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </View>
        
        </KeyboardAvoidingView></Modal>
      ) : null}
    </Page>
  );
}

function buildFieldLabel() {
  return {
    fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 6,
  };
}
let fieldLabel = buildFieldLabel();
subscribeTheme(() => { fieldLabel = buildFieldLabel(); });

