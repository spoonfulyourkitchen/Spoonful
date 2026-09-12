import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Bookmark, Check, Clock3, Flame, Globe, Play, Share2,
  ShoppingCart, Trash2, Pencil, UsersRound, Zap,
} from 'lucide-react-native';
import { useAction, useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, difficultyColor, rgbaHelper, subscribeTheme } from '../theme';
import { navigate, goBack } from '../navigation/rootRef';
import { AppButton, GlassCard, InfoBox, SectionLabel } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { ReportPhotoButton } from '../components/ReportPhotoButton';
import { useTranslation } from '../lib/i18n';
import { LibraryRecipe, difficultyLabel, formatCuisine, recipeLines, totalMinutes } from '../lib/recipe';
import { TutorialTarget } from '../components/TutorialTarget';
import { tutorialAction, useTutorialTarget } from '../lib/tutorial';

export function RecipeDetailScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const { recipeId, source = 'library', recipe: inlineRecipe } = route.params ?? {};
  const detailSource = source as string;
  const recipe: LibraryRecipe | undefined = inlineRecipe;
  const recipeKey = inlineRecipe?.id ?? recipeId ?? inlineRecipe?.recipeKey ?? '';

  const savedList = useQuery(api.savedRecipes.list);
  const myShares = useQuery((api.sharing as any).myShares) as any[] | undefined;
  const saveRecipe = useMutation(api.savedRecipes.save);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const addToShopping = useMutation(api.shoppingList.addMany);
  const shoppingLive = useQuery(api.shoppingList.list) as any[] | undefined;
  const logMeal = useMutation(api.calorieEntries.log);
  const shareRecipe = useMutation(api.sharing.create);
  const removeShare = useMutation(api.sharing.removeShare);
  const removeRecipe = useMutation(api.recipes.remove);
  const translateRecipe = useAction(api.translate.translateRecipe);
  const reportCorrection = useMutation(api.translate.reportCorrection);
  const [translated, setTranslated] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  // 2.0.0 (102): report a better wording for the automatic translation.
  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const savedDoc = savedList?.find((s: any) => s.recipeKey === recipeKey);
  const isSaved = !!savedDoc && detailSource !== 'mine';

  /**
   * 2.0.0 (39): kept for the "have at home" heuristic of the shopping list.
   * The separate "missing" button was removed on request - the icon row only
   * adds all ingredients now.
   */
  const pantryNames = useMemo(
    () =>
      (shoppingLive ?? [])
        .filter((i: any) => i.have || i.checked)
        .map((i: any) => String(i.name ?? '').toLowerCase().trim())
        .filter((n: string) => n.length > 2),
    [shoppingLive],
  );
  const missingIngredients = useMemo(() => {
    const all = (recipe?.ingredients ?? []).map((x: string) => String(x).trim()).filter(Boolean);
    return all.filter((line) => !pantryNames.some((p) => line.toLowerCase().includes(p)));
  }, [recipe, pantryNames]);

  /* Tutorial targets (tour): back arrow, bookmark and the ingredients card. */
  const backTarget = useTutorialTarget('tut-detail-back', { onPress: () => goBack() });
  const saveTarget = useTutorialTarget('tut-detail-save', { onPress: () => void toggleSave() });

  /** 33 + 113: share the recipe as text - in the translated version if active. */
  const shareAsText = async () => {
    if (!recipe) return;
    const body = [
      view.title,
      view.description ?? '',
      '',
      `${t('recipe.ingredients')}:`,
      ...recipeLines(view.ingredients).map((x: string) => `- ${x}`),
      '',
      `${t('recipe.steps')}:`,
      ...recipeLines(view.steps).map((s: string, i: number) => `${i + 1}. ${s}`),
      '',
      `${t('recipe.nutrition')}: ${recipe.calories ?? '-'} kcal · ${recipe.protein ?? '-'} ${t('common.protein')} · ${recipe.carbs ?? '-'} ${t('common.carbs')} · ${recipe.fat ?? '-'} ${t('common.fat')}`,
    ].join('\n');
    try {
      await Share.share({ title: view.title, message: body });
    } catch {
      /* ignored */
    }
  };

  const startCooking = () => {
    if (!recipe) return;
    navigate('Cooking', {
      title: recipe.title,
      steps: recipe.steps.length ? recipe.steps : ['Prepare your ingredients and enjoy.'],
      totalTime: totalMinutes(recipe),
      ingredients: recipe.ingredients ?? [],
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
    });
  };

  const toggleSave = async () => {
    if (!recipe || busy) return;
    setBusy(true);
    try {
      if (isSaved && savedDoc) {
        await removeSaved({ id: savedDoc._id });
        flash('Removed from Saved');
      } else {
        await saveRecipe({
          recipeKey: recipeKey || recipe.title,
          title: recipe.title,
          description: recipe.description ?? '',
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          prepTime: recipe.prepTime ?? 0,
          cookTime: recipe.cookTime ?? 0,
          cuisine: recipe.cuisine ?? 'Other',
          dietaryRestrictions: recipe.dietaryRestrictions ?? [],
          imageUrl: recipe.imageUrl,
          difficulty: recipe.difficulty ?? 'medium',
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
        });
        flash('Saved to your collection');
      }
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const addIngredientsToList = async () => {
    if (!recipe || busy) return;
    const names = recipeLines(recipe.ingredients);
    if (names.length === 0) {
      Alert.alert('Nothing to add', 'This recipe has no listed ingredients.');
      return;
    }
    setBusy(true);
    try {
      await addToShopping({ items: names.map((name) => ({ name, recipeKey, recipeTitle: recipe.title })) });
      flash('Ingredients added to your shopping list');
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const logThisMeal = async () => {
    if (!recipe || busy) return;
    setBusy(true);
    try {
      await logMeal({
        title: recipe.title,
        calories: recipe.calories ?? 0,
        protein: recipe.protein ?? 0,
        carbs: recipe.carbs ?? 0,
        fat: recipe.fat ?? 0,
        eatenAt: Date.now(),
      });
      flash('Logged to your tracker');
    } catch (e) {
      Alert.alert('Could not log', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onTranslate = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (!recipe || translating) return;
    setTranslating(true);
    try {
      const res = await translateRecipe({
        recipeKey: recipeKey || recipe.title,
        targetLanguage: lang,
        title: recipe.title,
        description: recipe.description ?? '',
        ingredients: recipe.ingredients ?? [],
        steps: recipe.steps ?? [],
      });
      if (res) {
        setTranslated(res);
        setShowTranslation(true);
      } else {
        flash('Translation is not available for this language yet');
      }
    } catch (e) {
      Alert.alert('Could not translate', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const shareDoc = (myShares ?? []).find((s: any) => s.sourceRecipeId === recipeId);
  const shareStatus: 'none' | 'pending' | 'approved' | 'rejected' = shareDoc?.status ?? 'none';

  // Client-side cooldown after a rejection so the same recipe cannot be
  // re-submitted over and over (server-side rate limiting still recommended).
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const shareRetryKey = `spoonful:share-retry:${recipeId ?? ''}`;
  useEffect(() => {
    if (shareStatus !== 'rejected') return;
    let alive = true;
    AsyncStorage.getItem(shareRetryKey)
      .then((raw) => {
        if (!alive) return;
        const t = raw ? Number(raw) : NaN;
        if (Number.isFinite(t) && t > Date.now()) { setRetryAt(t); return; }
        if (Number.isFinite(t)) { void AsyncStorage.removeItem(shareRetryKey).catch(() => {}); setRetryAt(null); return; }
        const until = Date.now() + COOLDOWN_MS;
        setRetryAt(until);
        void AsyncStorage.setItem(shareRetryKey, String(until)).catch(() => {});
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [shareStatus, shareRetryKey]);

  const submitShare = async () => {
    setBusy(true);
    try {
      await shareRecipe({ recipeId });
      flash('Sent for review — an admin will approve it before it goes live.');
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareThisRecipe = async () => {
    if (!recipe || busy) return;
    if (detailSource !== 'mine') {
      flash('Share is available for your own recipes');
      return;
    }
    if (shareStatus === 'pending') {
      flash('Already sent — waiting for the admin review.');
      return;
    }
    if (shareStatus === 'rejected') {
      const reasonLabel = shareDoc.rejectionReason === 'no_photo' ? 'No photo'
        : shareDoc.rejectionReason === 'harmless' ? 'Harmless / too plain' : 'Other';
      const waitMs = (retryAt ?? 0) - Date.now();
      if (waitMs > 0) {
        const days = Math.max(1, Math.ceil(waitMs / 86400000));
        Alert.alert('Please wait before trying again', `${reasonLabel}.${shareDoc.rejectionNote ? `\n\n${shareDoc.rejectionNote}` : ''}\n\nYou can submit this recipe again in about ${days} day${days > 1 ? 's' : ''}, so we can keep the community tidy.`, [{ text: 'OK' }]);
        return;
      }
      Alert.alert('Not approved yet', `${reasonLabel}.${shareDoc.rejectionNote ? `\n\n${shareDoc.rejectionNote}` : ''}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send again', onPress: () => void submitShare() },
      ]);
      return;
    }
    await submitShare();
  };

  const withdrawShare = async () => {
    if (!shareDoc || busy) return;
    Alert.alert('Remove from Community?', 'This unpublishes the approved recipe so nobody can find it in Community anymore.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove from community',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await removeShare({ id: shareDoc._id });
              flash('Removed from the community.');
            } catch (e) {
              Alert.alert('Could not remove', e instanceof Error ? e.message : 'Please try again.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const deleteOwn = () => {
    Alert.alert(t('recipe.deleteConfirm'), t('recipe.deleteDesc'), [
      { text: t('recipe.keepRecipe'), style: 'cancel' },
      {
        text: t('recipe.deleteRecipe'),
        style: 'destructive',
        onPress: () => {
          try {
            removeRecipe({ id: recipeId });
            goBack();
          } catch { /* reactive */ }
        },
      },
    ]);
  };

  if (!recipe) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textSecondary }}>Recipe not found</Text>
      </View>
    );
  }

  const diff = difficultyColor(recipe.difficulty);
  const hasNutrition = recipe.calories != null || recipe.protein != null || recipe.carbs != null || recipe.fat != null;
  const retryInDays = retryAt && retryAt > Date.now() ? Math.max(1, Math.ceil((retryAt - Date.now()) / 86400000)) : null;
  const showingTr = showTranslation && !!translated;
  const view = showingTr
    ? {
        title: translated.title || recipe.title,
        description: (translated.description ?? recipe.description) as string | undefined,
        ingredients: translated.ingredients ?? recipe.ingredients ?? [],
        steps: translated.steps ?? recipe.steps ?? [],
      }
    : recipe;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={() => tutorialAction('tut-detail-ingredients')}
        scrollEventThrottle={16}
      >
        <View>
          <RecipeImage uri={recipe.imageUrl} style={{ width: '100%', height: 250 }} />
          <View style={{ position: 'absolute', top: insets.top + 10, left: 12, flexDirection: 'row', gap: 8 }}>
            <Pressable ref={backTarget.ref as any} collapsable={false} onPress={backTarget.onPress} style={roundBtn}>
              <ArrowLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
            {detailSource !== 'mine' && recipe.imageUrl ? (
              <ReportPhotoButton recipeKey={recipeKey} recipeTitle={recipe.title} imageUrl={recipe.imageUrl} />
            ) : null}
          </View>
          <View style={{ position: 'absolute', right: 14, bottom: -20 }}>
            <Pressable onPress={startCooking} style={{ width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bg }}>
              <Play size={24} color={colors.accentText} fill={colors.accentText} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, marginTop: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.accent }}>
            {formatCuisine(recipe.cuisine)}
            {recipe.dietaryRestrictions?.length ? ` · ${recipe.dietaryRestrictions.join(' · ')}` : ''}
          </Text>
          <Text style={{ fontSize: 27, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif', letterSpacing: -0.4, marginTop: 5, lineHeight: 34 }}>
            {view.title}
          </Text>
          {view.description ? (
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 8 }}>{view.description}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <MetaPill icon={<Clock3 size={13} color={colors.accent} />} text={`${Number(recipe.prepTime) || 0} min prep`} />
            {recipe.cookTime ? <MetaPill icon={<Clock3 size={13} color={colors.accent} />} text={`${recipe.cookTime} min cook`} /> : null}
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: diff.bg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: diff.fg }}>{difficultyLabel(recipe.difficulty)}</Text>
            </View>
          </View>

          {hasNutrition ? (
            <GlassCard pad={10} radius={20} style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row' }}>
                <InfoBox label="kcal" value={recipe.calories != null ? `${recipe.calories}` : '—'} accent />
                <InfoBox label="protein" value={recipe.protein != null ? `${recipe.protein}g` : '—'} />
                <InfoBox label="carbs" value={recipe.carbs != null ? `${recipe.carbs}g` : '—'} />
                <InfoBox label="fat" value={recipe.fat != null ? `${recipe.fat}g` : '—'} />
              </View>
            </GlassCard>
          ) : null}

          {lang && lang !== 'en' ? (
            <Pressable
              onPress={() => void onTranslate()}
              disabled={translating}
              style={({ pressed }) => [
                {
                  marginTop: 16,
                  borderRadius: 999,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderWidth: 1,
                  borderColor: showingTr ? colors.success : colors.accent,
                  backgroundColor: showingTr ? colors.successBg : colors.accentSoft,
                },
                (pressed || translating) && { opacity: 0.75 },
              ]}
            >
              {translating ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Globe size={14} color={showingTr ? colors.success : colors.accent} />
              )}
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: showingTr ? colors.success : colors.accent }}>
                {translating ? 'Translating…' : showingTr ? 'Show original' : `Translate to ${String(lang).toUpperCase()}`}
              </Text>
            </Pressable>
          ) : null}

          <SectionLabel style={{ marginTop: 20 }}>{t('recipe.ingredients')}</SectionLabel>
          <TutorialTarget id="tut-detail-ingredients">
            <GlassCard pad={16} radius={20} variant="solid">
            {recipeLines(view.ingredients).map((ing: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7, marginRight: 10 }} />
                <Text style={{ fontSize: 15, color: colors.textPrimary, flex: 1 }}>{ing}</Text>
              </View>
            ))}
            {!recipeLines(view.ingredients).length ? <Text style={{ color: colors.textSecondary }}>No ingredients listed.</Text> : null}
            </GlassCard>
          </TutorialTarget>


          <SectionLabel style={{ marginTop: 20 }}>{t('recipe.steps')}</SectionLabel>
          {recipeLines(view.steps).map((step: string, i: number) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 }}>
                <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textPrimary, flex: 1 }}>{step}</Text>
            </View>
          ))}
          {!recipeLines(view.steps).length ? <Text style={{ color: colors.textSecondary }}>No steps listed.</Text> : null}

          {detailSource === 'mine' ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => navigate('RecipeForm', { recipe })} style={[actionGhost, { flex: 1 }]}>
                <Pencil size={16} color={colors.textPrimary} strokeWidth={2} />
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>{t('recipe.edit')}</Text>
              </Pressable>
              <Pressable onPress={deleteOwn} style={[actionGhost, { flex: 1, backgroundColor: colors.roseBg, borderColor: rgbaHelper('#e11d48', 0.25) }]}>
                <Trash2 size={16} color={colors.rose} strokeWidth={2} />
                <Text style={{ color: colors.rose, fontWeight: '600', fontSize: 14 }}>{t('recipe.delete')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 2.0.0 (102): suggest a better translation */}
      <Modal visible={fixOpen} transparent animationType="slide" onRequestClose={() => setFixOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('shr.fix')}</Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 6 }}>{t('shr.fixHint')}</Text>
            <TextInput
              value={fixText}
              onChangeText={setFixText}
              multiline
              placeholder="…"
              placeholderTextColor={colors.textSecondary}
              style={{ minHeight: 80, textAlignVertical: 'top', marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 12, color: colors.textPrimary }}
            />
            <AppButton
              label={t('common.send')}
              variant="dark"
              style={{ marginTop: 12 }}
              onPress={() => {
                if (fixText.trim().length < 2) return;
                void reportCorrection({
                  recipeKey,
                  language: lang ?? 'en',
                  source: (view?.steps ?? []).slice(0, 40).join(' '),
                  suggestion: fixText.trim(),
                });
                setFixText('');
                setFixOpen(false);
                flash(t('shr.thanks'));
              }}
            />
            <Pressable onPress={() => setFixOpen(false)} style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast ? (
        <View style={{ position: 'absolute', top: insets.top + 16, left: 30, right: 30, borderRadius: 16, backgroundColor: colors.darkButton, paddingVertical: 12, alignItems: 'center', zIndex: 50 }}>
          <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{toast}</Text>
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 + insets.bottom, backgroundColor: colors.header, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {detailSource !== 'mine' ? (
            <Pressable
              ref={saveTarget.ref as any}
              collapsable={false}
              onPress={saveTarget.onPress}
              disabled={busy}
              style={({ pressed }) => [{ width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: isSaved ? colors.success : colors.card, opacity: pressed ? 0.8 : 1 }]}
            >
              {isSaved ? <Check size={22} color={colors.card} strokeWidth={2.6} /> : <Bookmark size={22} color={colors.textPrimary} strokeWidth={2} />}
            </Pressable>
          ) : null}
          <Pressable onPress={addIngredientsToList} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shopping.title')}>
            <ShoppingCart size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          {/* 33 + 113: share / print as text (translated if active) - icon only */}
          <Pressable onPress={() => void shareAsText()} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shr.share')}>
            <Share2 size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          {/* 102: report a better translation (only while a translation is shown) */}
          {showingTr ? (
            <Pressable onPress={() => setFixOpen(true)} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shr.fix')}>
              <Pencil size={20} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
          ) : null}
          {detailSource !== 'mine' ? (
            <Pressable onPress={logThisMeal} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel="Log meal">
              <Zap size={20} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
          ) : (
            <Pressable
              onPress={shareStatus === 'approved' ? withdrawShare : shareThisRecipe}
              disabled={busy || shareStatus === 'pending'}
              style={({ pressed }) => [
                actionBtnSecondary,
                shareStatus === 'approved' ? { backgroundColor: colors.roseBg, borderColor: rgbaHelper('#e11d48', 0.3) } : null,
                pressed && { opacity: 0.82 },
              ]}
              accessibilityLabel={shareStatus === 'approved' ? 'Remove from community' : 'Share with the community'}
            >
              {shareStatus === 'approved' ? (
                <Trash2 size={20} color={colors.rose} strokeWidth={2} />
              ) : shareStatus === 'pending' ? (
                <Clock3 size={20} color={colors.medium} />
              ) : (
                /* community = the people icon */
                <UsersRound size={20} color={colors.textPrimary} strokeWidth={2} />
              )}
            </Pressable>
          )}
        </View>
        <AppButton label={busy ? 'Working…' : t('dialog.startCooking')} variant="dark" style={{ marginTop: 8 }} icon={<Flame size={18} color={colors.darkButtonText} />} onPress={startCooking} />
      </View>
    </View>
  );
}

/* 2.0.0 theme fix: these were plain module-level constants, so they were
   coloured once with the palette of the boot theme. After a theme switch the
   round back button and the whole action row kept the old colours and looked
   broken. They are rebuilt on every theme change now - and because a fresh
   object is assigned, React really re-applies the style. */
function buildDetailStyles() {
  return {
    roundBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.dark ? rgbaHelper('#ffffff', 0.12) : rgbaHelper('#ffffff', 0.9),
      borderWidth: 1, borderColor: colors.cardBorder,
    } as const,
    actionGhost: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      borderRadius: 12, paddingVertical: 11, borderWidth: 1,
      borderColor: colors.cardBorder, backgroundColor: colors.card,
    } as const,
    actionBtnSecondary: {
      flex: 1, height: 50, borderRadius: 15, borderWidth: 1, borderColor: colors.cardBorder,
      backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: 2,
    } as const,
  };
}
let detailStyles = buildDetailStyles();
let roundBtn = detailStyles.roundBtn;
let actionGhost = detailStyles.actionGhost;
let actionBtnSecondary = detailStyles.actionBtnSecondary;
subscribeTheme(() => {
  detailStyles = buildDetailStyles();
  roundBtn = detailStyles.roundBtn;
  actionGhost = detailStyles.actionGhost;
  actionBtnSecondary = detailStyles.actionBtnSecondary;
});


function MetaPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted }}>
      {icon}
      <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

