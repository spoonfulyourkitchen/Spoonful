import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Minus, Play, Plus, Send, Sparkles, Trash2, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAction, useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { AppButton, Chip, GlassCard, PageHeader, TextField } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { asRecipeFromDoc } from '../lib/recipe';
import { setAiRunning, setAiDone, setAiError } from '../lib/aiTask';
import { notifyAiReady, notifyRecipeAdded } from '../lib/notifications';
import { useConnectivity, retryConnectivity } from '../lib/offline';
import { OfflineTv } from '../components/OfflineTv';
import { useTranslation } from '../lib/i18n';

const QUICK = ['eggs', 'tomato', 'cheese', 'pasta', 'rice', 'chicken', 'onion', 'garlic', 'spinach', 'potato'];
const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb', 'high-protein', 'nut-free', 'keto'];

export function AssistantScreen() {
  const generate = useAction(api.ai.generateRecipe);
  const createRecipe = useMutation(api.recipes.create);
  // Onboarding profile: diet/allergies/goal/experience steer the AI Chef.
  const profile = useQuery(api.users.currentUser) as any;
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [prefs, setPrefs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [mode, setMode] = useState<'ingredients' | 'describe'>('ingredients');
  const [freeText, setFreeText] = useState('');
  // 2.0.0: chef options (servings, cuisine, time budget, difficulty, spice, …)
  const [servings, setServings] = useState(4);
  const [cuisinePick, setCuisinePick] = useState('');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [difficultyPick, setDifficultyPick] = useState('');
  const [spice, setSpice] = useState('');
  const [lighter, setLighter] = useState(false);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);

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
  // Two real pages side by side: 0 = ingredients, 1 = describe.
  // pageX is the container offset (-page * width), so the content always
  // follows the finger and simply settles on release.
  const pageX = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(0);

  const settle = (index: number) => {
    const clamped = index < 0 ? 0 : index > 1 ? 1 : index;
    pageRef.current = clamped;
    setMode(clamped === 1 ? 'describe' : 'ingredients');
    Animated.spring(pageX, {
      toValue: -clamped * AW,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
      overshootClamping: true,
    }).start();
  };

  const pageHint = { fontSize: 12, color: colors.textSecondary, marginBottom: 10 } as const;

  // Keep the pager aligned when the window size changes (rotation, split view).
  useEffect(() => {
    pageX.setValue(-pageRef.current * AW);
  }, [AW, pageX]);

  /** Page indicator — also tappable, so people can switch without swiping. */
  const pageDots = (active: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Pressable onPress={() => settle(0)} hitSlop={10} style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: active === 0 ? colors.accent : colors.surfaceMuted }} />
      </Pressable>
      <Pressable onPress={() => settle(1)} hitSlop={10} style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: active === 1 ? colors.accent : colors.surfaceMuted }} />
      </Pressable>
    </View>
  );

  const pan = useRef(
    PanResponder.create({
      // Only claim clearly horizontal drags, so vertical scrolling still works.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const base = -pageRef.current * AW;
        let next = base + g.dx;
        // soft rubber band at both outer edges instead of a hard stop
        if (next > 0) next *= 0.35;
        else if (next < -AW) next = -AW + (next + AW) * 0.35;
        pageX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = -pageRef.current * AW;
        const next = base + g.dx;
        const flung = Math.abs(g.vx) > 0.45;
        // finger goes left -> next page slides in from the right, and vice versa
        if ((flung && g.vx < 0) || (!flung && next < -AW * 0.35)) settle(pageRef.current + 1);
        else if ((flung && g.vx > 0) || (!flung && next > AW * 0.35)) settle(pageRef.current - 1);
        else settle(pageRef.current); // already there: just springs back, no re-animation
      },
      onPanResponderTerminate: () => settle(pageRef.current),
    }),
  ).current;

  const AI_HISTORY_KEY = 'spoonful:ai-history';

  // Restore previously generated recipes across app restarts.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(AI_HISTORY_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch { /* ignore corrupted */ }
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
  const { t } = useTranslation();
  if (conn === 'offline') {
    return (
      <OfflineTv
        title="AI Chef"
        message="The AI Chef needs the internet to craft new recipes. Everything you saved before still works offline."
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

  const [reroll, setReroll] = useState(false);
  const run = async () => {
    const describing = mode === 'describe';
    if (describing && !freeText.trim()) { setError('Describe what you feel like cooking.'); return; }
    if (!describing && !ingredients.length) { setError('Add a few ingredients you have on hand first.'); return; }
    setError(null);
    setBusy(true);
    setResult(null);
    setSaved(false);
    setAiRunning();
    try {
      const r = await generate(
        {
          ...(describing
            ? { prompt: freeText.trim() }
            : { availableIngredients: ingredients.join(', ') }),
          dietaryPreferences: prefs.join(', '),
          experience: profile?.cookingExperience ?? '',
          goal: profile?.goal ?? '',
          diet: profile?.diet ?? '',
          allergies: profile?.allergies ?? [],
          // 2.0.0 chef options
          servings,
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
      setPreview(true);
      pushHistory(r);
      setAiDone(r?.title ?? 'Recipe ready');
      void notifyAiReady(r?.title ?? 'Recipe');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The kitchen is busy right now. Try again in a moment.');
      setAiError();
    } finally {
      setBusy(false);
    }
  };

  const saveToMine = async () => {
    if (!result || saved) return;
    try {
      await createRecipe({
        title: result.title ?? 'AI recipe',
        ingredients: result.ingredients ?? [],
        steps: result.steps ?? [],
        prepTime: result.prepTime ?? 0,
        cookTime: result.cookTime ?? 0,
        cuisine: result.cuisine ?? 'Other',
        dietaryRestrictions: result.dietaryRestrictions ?? [],
        difficulty: result.difficulty ?? 'medium',
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
      });
      setSaved(true);
      void notifyRecipeAdded(result.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the recipe.');
    }
  };

  const openResult = () => {
    if (!result) return;
    navigate('RecipeDetail', {
      recipeId: 'assistant', title: result.title ?? 'AI recipe', source: 'assistant',
      recipe: asRecipeFromDoc(result, 'assistant'),
    });
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" directionalLockEnabled nestedScrollEnabled>
        <PageHeader eyebrow="Spoonful · AI Chef" title={t('assistant.title')} subtitle={t('assistant.desc')} /> 
          

        {/* two pages that always follow the finger */}

        <View style={{ overflow: 'hidden', marginHorizontal: -18 }} {...pan.panHandlers}>
        <Animated.View style={{ width: AW * 2, flexDirection: 'row', transform: [{ translateX: pageX }] }}>

        {/* page 0 — ingredients (default) */}
        <View style={{ width: AW, paddingHorizontal: 18 }}>
        {pageDots(pageRef.current)}
        <Text style={pageHint}>{'Swipe left to describe it in your own words ←'}</Text>
        <GlassCard pad={16} radius={22}>
          <Text style={fieldLabel}>Available ingredients</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {ingredients.map((ing) => (
              <Chip key={ing} label={ing} active onPress={() => removeIng(ing)} icon={<Text style={{ color: colors.accentText, fontWeight: '800' }}>×</Text>} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField value={draft} onChangeText={setDraft} placeholder="Type an ingredient…" onSubmitEditing={() => addIngredient(draft)} style={{ marginBottom: 0 }} />
            </View>
            <Pressable onPress={() => addIngredient(draft)} style={({ pressed }) => [{ marginBottom: 14, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
              <Send size={18} color={colors.accentText} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={[fieldLabel, { marginTop: 6 }]}>Quick suggestions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map((q) => (
              <Chip key={q} label={q} active={ingredients.includes(q)} onPress={() => addIngredient(q)} />
            ))}
          </View>
        </GlassCard>
        </View>

        {/* page 1 — describe anything */}
        <View style={{ width: AW, paddingHorizontal: 18 }}>
        {pageDots(pageRef.current)}
        <Text style={pageHint}>{'Swipe right to go back to your ingredients →'}</Text>
        <GlassCard pad={16} radius={22}>
          <Text style={fieldLabel}>Describe what you want</Text>
          <TextInput
            value={freeText}
            onChangeText={setFreeText}
            placeholder="e.g. a quick spicy Turkish dinner with chickpeas for 4"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, padding: 12, fontSize: 15 }}
          />
        </GlassCard>
        </View>

        </Animated.View>
        </View>

        <Text style={[fieldLabel, { marginTop: 16, paddingHorizontal: 2 }]}>Dietary preferences</Text>
        <GlassCard pad={14} radius={20}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {DIETS.map((p) => (
              <Chip key={p} label={p} active={prefs.includes(p)} tone={prefs.includes(p) ? 'green' : 'neutral'} onPress={() => togglePref(p)} />
            ))}
          </View>
        </GlassCard>

        <Text style={[fieldLabel, { marginTop: 16, paddingHorizontal: 2 }]}>Chef options</Text>
        <GlassCard pad={14} radius={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Pressable onPress={() => setServings((s) => Math.max(1, s - 1))} hitSlop={6}>
                <Minus size={14} color={colors.textPrimary} />
              </Pressable>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary, minWidth: 54, textAlign: 'center' }}>
                {servings} {t('common.servingsUnit')}
              </Text>
              <Pressable onPress={() => setServings((s) => Math.min(12, s + 1))} hitSlop={6}>
                <Plus size={14} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Chip label="lighter" active={lighter} tone={lighter ? 'green' : 'neutral'} onPress={() => setLighter((v) => !v)} />
            <Chip label="kid friendly" active={kidFriendly} tone={kidFriendly ? 'green' : 'neutral'} onPress={() => setKidFriendly((v) => !v)} />
            <Chip label={optionsOpen ? 'less options' : 'more options'} active={optionsOpen} onPress={() => setOptionsOpen((v) => !v)} />
          </View>

          {optionsOpen ? (
            <>
              <Text style={[fieldLabel, { marginTop: 10 }]}>Cuisine</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip label="any" active={cuisinePick === ''} tone="neutral" onPress={() => setCuisinePick('')} />
                {CUISINES.map((c) => (
                  <Chip key={c} label={c} active={cuisinePick === c} onPress={() => setCuisinePick(cuisinePick === c ? '' : c)} />
                ))}
              </View>

              <Text style={[fieldLabel, { marginTop: 10 }]}>Ready in</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip label="any" active={maxMinutes === null} tone="neutral" onPress={() => setMaxMinutes(null)} />
                {TIMES.map((m) => (
                  <Chip key={m} label={`${m} ${t('common.min')}`} active={maxMinutes === m} onPress={() => setMaxMinutes(maxMinutes === m ? null : m)} />
                ))}
              </View>

              <Text style={[fieldLabel, { marginTop: 10 }]}>Difficulty & heat</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip label="any" active={difficultyPick === ''} tone="neutral" onPress={() => setDifficultyPick('')} />
                {['easy', 'medium', 'hard'].map((d) => (
                  <Chip key={d} label={d} active={difficultyPick === d} onPress={() => setDifficultyPick(difficultyPick === d ? '' : d)} />
                ))}
                <Chip label="mild" active={spice === 'mild'} onPress={() => setSpice(spice === 'mild' ? '' : 'mild')} />
                <Chip label="medium" active={spice === 'medium'} onPress={() => setSpice(spice === 'medium' ? '' : 'medium')} />
                <Chip label="hot" active={spice === 'hot'} onPress={() => setSpice(spice === 'hot' ? '' : 'hot')} />
              </View>

              <Text style={[fieldLabel, { marginTop: 10 }]}>Tools</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {EQUIPMENT.map((e) => (
                  <Chip key={e.label} label={e.label} active={equipment === e.value} onPress={() => setEquipment(e.value)} />
                ))}
              </View>
            </>
          ) : null}
        </GlassCard>

        {error ? <Text style={{ color: colors.rose, fontSize: 13, marginTop: 10 }}>{error}</Text> : null}
        <AppButton label={busy ? t('assistant.generating') : t('assistant.generate')} variant="dark" style={{ marginTop: 14 }} busy={busy} icon={!busy ? <Sparkles size={18} color={colors.darkButtonText} /> : undefined} onPress={run} />

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
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>Reroll - something new</Text>
          </Pressable>
        ) : null}

        {result ? (
          <GlassCard pad={16} radius={22} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif' }}>{result.title}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
              {result.cuisine} · {result.calories ?? '?'} kcal · {result.prepTime ?? 0} min prep
              {result.servings ? ` · ${result.servings} ${t('common.servingsUnit')}` : ''}
            </Text>
            {result.note ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, borderRadius: 12, backgroundColor: colors.accentSoft, padding: 10 }}>
                <Sparkles size={15} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 }}>{result.note}</Text>
              </View>
            ) : null}
            {Array.isArray(result.tips) && result.tips.length ? (
              <View style={{ marginTop: 10 }}>
                {(result.tips as string[]).map((tip, i) => (
                  <Text key={i} style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 }}>
                    · {tip}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={[fieldLabel, { marginTop: 14 }]}>Ingredients</Text>
            {(result.ingredients ?? []).map((ing: string, i: number) => (
              <Text key={i} style={{ fontSize: 14.5, color: colors.textPrimary, paddingVertical: 2 }}>• {ing}</Text>
            ))}
            <Text style={[fieldLabel, { marginTop: 12 }]}>Steps</Text>
            {(result.steps ?? []).map((s: string, i: number) => (
              <Text key={i} style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 21, paddingVertical: 3 }}>
                {i + 1}. {s}
              </Text>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable onPress={openResult} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent }}>
                <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}><Play size={13} /> {t('assistant.cookThis')}</Text>
              </Pressable>
              <Pressable onPress={saveToMine} disabled={saved} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: saved ? colors.success : colors.darkButton }}>
                <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{saved ? `${t('assistant.saved')} ✓` : t('assistant.saveToRecipes')}</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {history.length > (result ? 1 : 0) ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={fieldLabel}>Recent generations</Text>
              <Pressable onPress={clearHistory} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Trash2 size={13} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Clear history</Text>
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

      {result && preview ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreview(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 }}>
            <View style={{ borderRadius: 26, backgroundColor: colors.card, overflow: 'hidden' }}>
              <RecipeImage uri={result.imageUrl} style={{ width: '100%', height: 210 }} />
              <Pressable onPress={() => setPreview(false)} hitSlop={8} style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#fff" />
              </Pressable>
              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif' }}>{result.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {result.cuisine || 'Home cooking'} · {result.calories ?? '?'} kcal · {result.prepTime ?? 0} min prep
                </Text>
                <View style={{ marginTop: 16, gap: 10 }}>
                  <AppButton label="View full recipe" variant="dark" icon={<Sparkles size={17} color={colors.darkButtonText} />} onPress={() => { setPreview(false); openResult(); }} />
                  <Pressable onPress={() => void saveToMine()} disabled={saved} style={({ pressed }) => [{ borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: saved ? colors.success : colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                    <Text style={{ color: saved ? readableText(colors.success) : colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{saved ? `${t('assistant.saved')} ✓` : t('assistant.saveToRecipes')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Page>
  );
}

/* 2.0.0 theme fix: rebuilt on every theme change, otherwise the label keeps the
   text colour of the theme the app was started with. */
function buildFieldLabel() {
  return {
    fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 6,
  };
}
let fieldLabel = buildFieldLabel();
subscribeTheme(() => { fieldLabel = buildFieldLabel(); });

