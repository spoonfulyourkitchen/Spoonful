import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowUp, Bookmark, Check, Clock3, Flame, Globe, Play, Share2,
  ShoppingCart, Trash2, Pencil, UsersRound, Zap,
} from 'lucide-react-native';
import { useAction, useMutation, useQuery } from '../lib/convex-auth';
import { api, SHARE_RETRY_WAIT_MS } from '../lib/api';
import { readIntroAnswers } from '../lib/intro-answers';
import { colors, difficultyColor, rgbaHelper, subscribeTheme } from '../theme';
import { navigate, goBack } from '../navigation/rootRef';
import { AppButton, GlassCard, InfoBox, MenuOrb, SectionLabel } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { StepPhotoSlideshow, StepPhotoStrip, useStepPhotos } from '../components/StepPhotoSlideshow';
import { ReportPhotoButton } from '../components/ReportPhotoButton';
import { CollectionModal } from '../components/CollectionModal';
import { useTranslation } from '../lib/i18n';
import { addPendingOp, getConnNow } from '../lib/offline';
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

  
  const scrollRef = useRef<any>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const savedList = useQuery(api.savedRecipes.list);
  const collections = useQuery(api.collections.list) as any[] | undefined;
  const myShares = useQuery((api.sharing as any).myShares) as any[] | undefined;
  const saveRecipe = useMutation(api.savedRecipes.save);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const addToShopping = useMutation(api.shoppingList.addMany);
  const logMeal = useMutation(api.calorieEntries.log);
  const shareRecipe = useMutation(api.sharing.create);
  const removeShare = useMutation(api.sharing.removeShare);
  const removeRecipe = useMutation(api.recipes.remove);
  const translateRecipe = useAction(api.translate.translateRecipe);
  const reportCorrection = useMutation(api.translate.reportCorrection);
  const [translated, setTranslated] = useState<any>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logPortions, setLogPortions] = useState(1);

  useEffect(() => {
    let alive = true;
    void readIntroAnswers().then((stored) => {
      if (!alive) return;
      const size = Number(stored?.householdSize ?? 0);
      if (size > 0) setLogPortions(Math.max(1, Math.min(12, size)));
    });
    return () => {
      alive = false;
    };
  }, []);
  const [logBusy, setLogBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  
  const myProfile = useQuery(api.users.currentUser) as any;
  const { photos: stepPhotos } = useStepPhotos(recipeKey, myProfile?.id);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowStart, setSlideshowStart] = useState(0);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const savedDoc = savedList?.find((s: any) => s.recipeKey === recipeKey);
  

  const savedOnServer = savedList === undefined ? null : !!(savedList as any[]).find((s: any) => s.recipeKey === recipeKey);
  const [saveOptimistic, setSaveOptimistic] = useState<boolean | null>(null);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  useEffect(() => {
    setSaveOptimistic(null);
  }, [savedOnServer]);
  const isSaved = (saveOptimistic ?? savedOnServer ?? false) && detailSource !== 'mine';
  const savePop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isSaved) return;
    Animated.sequence([
      Animated.spring(savePop, { toValue: 1.2, damping: 7, stiffness: 320, mass: 0.6, useNativeDriver: true }),
      Animated.spring(savePop, { toValue: 1, damping: 13, stiffness: 210, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, [isSaved, savePop]);

  
  const backTarget = useTutorialTarget('tut-detail-back', { onPress: () => goBack() });
  const saveTarget = useTutorialTarget('tut-detail-save', { onPress: () => {
    if (isSaved) void toggleSave();
    else setCollectionPickerOpen(true);
  } });

  
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
    } catch {}
  };

  const startCooking = () => {
    if (!recipe) return;
    

    const useTr = showTranslation && !!translated;
    const cookSteps = (useTr ? translated.steps : recipe.steps) ?? [];
    const cookIngredients = (useTr ? translated.ingredients : recipe.ingredients) ?? [];
    navigate('Cooking', {
      recipeKey: recipeId ?? recipe.title,
      title: useTr ? translated.title : recipe.title,
      steps: cookSteps.length ? cookSteps : ['Prepare your ingredients and enjoy.'],
      totalTime: totalMinutes(recipe),
      ingredients: cookIngredients,
      translatedTitle: useTr ? translated.title : undefined,
      translatedSteps: useTr ? translated.steps : undefined,
      translatedIngredients: useTr ? translated.ingredients : undefined,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
    });
  };

  
  const toggleSave = async (collectionId: string | null = null) => {
    if (!recipe) return;
    const next = !isSaved;
    setSaveOptimistic(next);
    if (!next) {
      flash(t('s.savedRemoved'));
      try {
        if (!savedDoc) return;
        if (getConnNow() === 'offline') {
          await addPendingOp('saved.remove', { id: savedDoc._id });
          return;
        }
        await removeSaved({ id: savedDoc._id });
      } catch (e) {
        setSaveOptimistic(null);
        Alert.alert(t('s.xCouldNotUpdate'), e instanceof Error ? e.message : t('common.tryAgain'));
      }
      return;
    }
    const payload = {
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
      collectionIds: collectionId ? [collectionId] : [],
    };
    try {
      if (getConnNow() === 'offline') await addPendingOp('saved.save', payload);
      else await saveRecipe(payload);
      flash(t('s.savedToCollection'));
    } catch (e) {
      setSaveOptimistic(null);
      Alert.alert(t('s.xCouldNotUpdate'), e instanceof Error ? e.message : t('common.tryAgain'));
    }
  };

  const addIngredientsToList = async () => {
    if (!recipe || busy) return;
    const names = recipeLines(recipe.ingredients);
    if (names.length === 0) {
      Alert.alert(t('s.xNothingToAdd'), 'This recipe has no listed ingredients.');
      return;
    }
    setBusy(true);
    try {
      await addToShopping({ items: names.map((name) => ({ name, recipeKey, recipeTitle: recipe.title })) });
      flash(t('shr.added'));
    } catch (e) {
      Alert.alert(t('s.xCouldNotAdd'), e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmLog = async () => {
    if (!recipe || logBusy) return;
    const portions = Math.max(1, Math.min(12, logPortions));
    setLogBusy(true);
    try {
      await logMeal({
        title: portions > 1 ? `${recipe.title} x${portions}` : recipe.title,
        calories: Math.round((recipe.calories ?? 0) * portions),
        protein: Math.round((recipe.protein ?? 0) * portions),
        carbs: Math.round((recipe.carbs ?? 0) * portions),
        fat: Math.round((recipe.fat ?? 0) * portions),
        eatenAt: Date.now(),
      });
      setLogOpen(false);
      flash(lang === 'de' ? 'Im Tracker eingetragen' : 'Logged to your tracker');
    } catch (e) {
      Alert.alert(t('s.xCouldNotLog'), e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLogBusy(false);
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
      Alert.alert(t('s.xCouldNotTranslate'), e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const shareDoc = (myShares ?? []).find((s: any) => s.sourceRecipeId === recipeId);
  const shareStatus: 'none' | 'pending' | 'approved' | 'rejected' = shareDoc?.status ?? 'none';

  

  const shareRetryKey = `spoonful:share-retry:${recipeId ?? ''}`;
  const reviewedAt = Number((shareDoc as any)?.reviewedAt ?? NaN);
  const retryUntil = Number.isFinite(reviewedAt) ? reviewedAt + SHARE_RETRY_WAIT_MS : NaN;
  useEffect(() => {
    if (shareStatus !== 'rejected') return;
    const until = Number.isFinite(retryUntil) ? retryUntil : Date.now() + SHARE_RETRY_WAIT_MS;
    setRetryAt(until);
    void AsyncStorage.setItem(shareRetryKey, String(until)).catch(() => {});
  }, [shareStatus, shareRetryKey, retryUntil]);

  const submitShare = async () => {
    setBusy(true);
    try {
      await shareRecipe({ recipeId });
      flash('Sent for review - an admin will approve it before it goes live.');
    } catch (e) {
      Alert.alert(t('s.xCouldNotShare'), e instanceof Error ? e.message : 'Please try again.');
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
      flash('Already sent - waiting for the admin review.');
      return;
    }
    if (shareStatus === 'rejected') {
      const reasonLabel = shareDoc.rejectionReason === 'no_photo' ? 'No photo'
        : shareDoc.rejectionReason === 'harmless' ? 'Harmless / too plain' : 'Other';
      const waitMs = (retryAt ?? 0) - Date.now();
      if (waitMs > 0) {
        const days = Math.max(1, Math.ceil(waitMs / 86400000));
        Alert.alert(t('s.xPleaseWait'), `${reasonLabel}.${shareDoc.rejectionNote ? `\n\n${shareDoc.rejectionNote}` : ''}\n\nYou can submit this recipe again in about ${days} day${days > 1 ? 's' : ''}, so we can keep the community tidy.`, [{ text: 'OK' }]);
        return;
      }
      Alert.alert(t('s.xNotApproved'), `${reasonLabel}.${shareDoc.rejectionNote ? `\n\n${shareDoc.rejectionNote}` : ''}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send again', onPress: () => void submitShare() },
      ]);
      return;
    }
    await submitShare();
  };

  const withdrawShare = async () => {
    if (!shareDoc || busy) return;
    Alert.alert(t('s.xRemoveFromCommunity'), 'This unpublishes the approved recipe so nobody can find it in Community anymore.', [
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
              Alert.alert(t('s.xCouldNotRemove'), e instanceof Error ? e.message : 'Please try again.');
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
          } catch {  }
        },
      },
    ]);
  };

  if (!recipe) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textSecondary }}>{t('s.xRecipeNotFound')}</Text>
      </View>
    );
  }

  const diff = difficultyColor(recipe.difficulty);
  const hasNutrition = recipe.calories != null || recipe.protein != null || recipe.carbs != null || recipe.fat != null;
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
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 190 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          tutorialAction('tut-detail-ingredients');
          const y = e.nativeEvent.contentOffset.y;
          

          setShowScrollTop((prev) => (prev ? y > 500 : y > 900));
        }}
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
          <View style={{ position: 'absolute', top: insets.top + 10, right: 12 }}>
            <MenuOrb tone="light" />
          </View>
          <View style={{ position: 'absolute', right: 14, bottom: -20 }}>
            <Pressable onPress={startCooking} style={{ width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bg }}>
              <Play size={24} color={colors.accentText} fill={colors.accentText} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {stepPhotos.length ? (
          <View style={{ paddingHorizontal: 18 }}>
            <StepPhotoStrip
              photos={stepPhotos}
              label={t('s.slideTitle')}
              onOpen={(i) => {
                setSlideshowStart(i);
                setSlideshowOpen(true);
              }}
            />
          </View>
        ) : null}

        <StepPhotoSlideshow
          visible={slideshowOpen}
          photos={stepPhotos}
          steps={recipeLines(view.steps)}
          title={recipe.title}
          startIndex={slideshowStart}
          onClose={() => setSlideshowOpen(false)}
        />

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
                <InfoBox label="kcal" value={recipe.calories != null ? `${recipe.calories}` : '-'} accent />
                <InfoBox label="protein" value={recipe.protein != null ? `${recipe.protein}g` : '-'} />
                <InfoBox label="carbs" value={recipe.carbs != null ? `${recipe.carbs}g` : '-'} />
                <InfoBox label="fat" value={recipe.fat != null ? `${recipe.fat}g` : '-'} />
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
            {!recipeLines(view.ingredients).length ? <Text style={{ color: colors.textSecondary }}>{t('s.xNoIngredients')}</Text> : null}
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
          {!recipeLines(view.steps).length ? <Text style={{ color: colors.textSecondary }}>{t('s.xNoSteps')}</Text> : null}

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

      <Modal visible={fixOpen} transparent animationType="slide" onRequestClose={() => setFixOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
      
        </KeyboardAvoidingView></Modal>

      {toast ? (
        <View style={{ position: 'absolute', top: insets.top + 16, left: 30, right: 30, borderRadius: 16, backgroundColor: colors.darkButton, paddingVertical: 12, alignItems: 'center', zIndex: 50 }}>
          <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 14 }}>{toast}</Text>
        </View>
      ) : null}

      {showScrollTop ? (
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          hitSlop={8}
          style={({ pressed }) => [{ position: 'absolute', right: 18, bottom: 84 + insets.bottom, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, opacity: pressed ? 0.8 : 0.96 }]}
          accessibilityLabel={t('s.backToTop')}
        >
          <ArrowUp size={20} color={colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      <CollectionModal
        visible={collectionPickerOpen}
        collections={collections ?? []}
        mode="pick"
        onChoose={(collectionId) => { setCollectionPickerOpen(false); void toggleSave(collectionId); }}
        onClose={() => setCollectionPickerOpen(false)}
      />

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 + insets.bottom, backgroundColor: colors.header, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {detailSource !== 'mine' ? (
            <Pressable
              ref={saveTarget.ref as any}
              collapsable={false}
              onPress={() => {
                if (isSaved) void toggleSave();
                else setCollectionPickerOpen(true);
              }}
              disabled={busy}
              style={({ pressed }) => [{ width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: isSaved ? colors.success : colors.card, opacity: pressed ? 0.8 : 1 }]}
            >
              <Animated.View style={{ transform: [{ scale: savePop }] }}>
                {isSaved ? <Check size={22} color={colors.card} strokeWidth={2.6} /> : <Bookmark size={22} color={colors.textPrimary} strokeWidth={2} />}
              </Animated.View>
            </Pressable>
          ) : null}
          <Pressable onPress={addIngredientsToList} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shopping.title')}>
            <ShoppingCart size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={() => void shareAsText()} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shr.share')}>
            <Share2 size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          {showingTr ? (
            <Pressable onPress={() => setFixOpen(true)} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('shr.fix')}>
              <Pencil size={20} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
          ) : null}
          {detailSource !== 'mine' ? (
            <Pressable onPress={() => { setLogPortions(1); setLogOpen(true); }} disabled={busy} style={({ pressed }) => [actionBtnSecondary, pressed && { opacity: 0.82 }]} accessibilityLabel={t('s.xLogMeal')}>
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
              accessibilityLabel={shareStatus === 'approved' ? 'Remove from community' : t('shr.share')}
            >
              {shareStatus === 'approved' ? (
                <Trash2 size={20} color={colors.rose} strokeWidth={2} />
              ) : shareStatus === 'pending' ? (
                <Clock3 size={20} color={colors.medium} />
              ) : (
                
                <UsersRound size={20} color={colors.textPrimary} strokeWidth={2} />
              )}
            </Pressable>
          )}
        </View>
        <AppButton label={busy ? 'Working…' : t('dialog.startCooking')} variant="dark" style={{ marginTop: 8 }} icon={<Flame size={18} color={colors.darkButtonText} />} onPress={startCooking} />
      </View>

      <Modal visible={logOpen} transparent animationType="fade" onRequestClose={() => setLogOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <View style={{ width: '100%', maxWidth: 380, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.textPrimary }}>
              {lang === 'de' ? 'Wie viele Portionen?' : 'How many servings?'}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>
              {recipe?.calories ?? 0} {t('common.kcal')} {lang === 'de' ? 'pro Portion' : 'per serving'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 18 }}>
              <Pressable onPress={() => setLogPortions((v) => Math.max(1, v - 1))} accessibilityRole="button" accessibilityLabel="minus" style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>-</Text>
              </Pressable>
              <Text style={{ minWidth: 44, textAlign: 'center', fontSize: 30, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{logPortions}</Text>
              <Pressable onPress={() => setLogPortions((v) => Math.min(12, v + 1))} accessibilityRole="button" accessibilityLabel="plus" style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>+</Text>
              </Pressable>
            </View>

            <Text style={{ textAlign: 'center', fontSize: 19, fontWeight: '800', color: colors.accent, marginTop: 14 }}>
              {Math.round((recipe?.calories ?? 0) * logPortions)} {t('common.kcal')}
            </Text>

            <AppButton label={logBusy ? '…' : lang === 'de' ? 'Eintragen' : 'Log meal'} variant="dark" style={{ marginTop: 14 }} onPress={() => void confirmLog()} />
            <Pressable onPress={() => setLogOpen(false)} style={{ marginTop: 10, alignItems: 'center' }} accessibilityRole="button">
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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

