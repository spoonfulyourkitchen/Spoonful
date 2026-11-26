import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Alert } from '../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ImagePlus, Info, Sparkles } from 'lucide-react-native';
import { dairyAssumptions, type DairyAssumption } from '../lib/ai';
import { useAction, useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText, rgbaHelper } from '../theme';
import { goBack } from '../navigation/rootRef';
import { AppButton, GlassCard, PageHeader, TextField } from '../components/ui';
import { CroppedImage } from '../components/CroppedImage';
import { notifyRecipeAdded } from '../lib/notifications';
import { pickFromGallery, takePhoto, uploadPhotoToServer } from '../lib/photo';
import { copyCrop, editPhotoCrop } from '../lib/photo-crop';
import { addPendingOp } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft';

type Difficulty = 'easy' | 'medium' | 'hard';
function toInt(value: string): number | undefined {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
}
const linesOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

export function RecipeFormScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const editing = route.params?.recipe as any;
  const savedId = route.params?.savedId as string | undefined;
  const createRecipe = useMutation(api.recipes.create);
  const updateRecipe = useMutation(api.recipes.update);
  const updateSaved = useMutation(api.savedRecipes.update);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [cuisine, setCuisine] = useState(editing?.cuisine ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(editing?.difficulty ?? 'medium');
  const [prepTime, setPrepTime] = useState(editing?.prepTime != null ? String(editing.prepTime) : '15');
  const [cookTime, setCookTime] = useState(editing?.cookTime != null ? String(editing.cookTime) : '');
  const [calories, setCalories] = useState(editing?.calories != null ? String(editing.calories) : '');
  const [protein, setProtein] = useState(editing?.protein != null ? String(editing.protein) : '');
  const [carbs, setCarbs] = useState(editing?.carbs != null ? String(editing.carbs) : '');
  const [fat, setFat] = useState(editing?.fat != null ? String(editing.fat) : '');
  const estimateN = useAction(api.ai.estimateNutrition);
  const [estimating, setEstimating] = useState(false);
  const [estimatedAssumptions, setEstimatedAssumptions] = useState<DairyAssumption[]>([]);
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? '');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropVersion, setCropVersion] = useState(0);
  

  const [pendingPhoto, setPendingPhoto] = useState<{ base64: string; mime: string } | null>(null);
  const [diets, setDiets] = useState((editing?.dietaryRestrictions ?? []).join(', '));
  const [ingredientsText, setIngredientsText] = useState((editing?.ingredients ?? []).join('\n'));
  const [stepsText, setStepsText] = useState((editing?.steps ?? []).join('\n'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const draftKey = savedId ? `saved-${savedId}` : editing ? `recipe-${editing._id ?? editing.id}` : 'recipe-new';
  const savedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadDraft<any>(draftKey).then((d) => {
      if (!alive) return;
      if (d && typeof d === 'object') {
        const filled = [d.title, d.ingredientsText, d.stepsText, d.cuisine, d.diets].some((v) => String(v ?? '').trim().length > 0);
        if (filled) {
          if (typeof d.title === 'string') setTitle(d.title);
          if (typeof d.cuisine === 'string') setCuisine(d.cuisine);
          if (d.difficulty === 'easy' || d.difficulty === 'medium' || d.difficulty === 'hard') setDifficulty(d.difficulty);
          if (typeof d.prepTime === 'string') setPrepTime(d.prepTime);
          if (typeof d.cookTime === 'string') setCookTime(d.cookTime);
          if (typeof d.calories === 'string') setCalories(d.calories);
          if (typeof d.protein === 'string') setProtein(d.protein);
          if (typeof d.carbs === 'string') setCarbs(d.carbs);
          if (typeof d.fat === 'string') setFat(d.fat);
          if (typeof d.imageUrl === 'string') setImageUrl(d.imageUrl);
          if (typeof d.diets === 'string') setDiets(d.diets);
          if (typeof d.ingredientsText === 'string') setIngredientsText(d.ingredientsText);
          if (typeof d.stepsText === 'string') setStepsText(d.stepsText);
          setDraftRestored(true);
        }
      }
      setDraftLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftLoaded || savedRef.current) return;
    const timer = setTimeout(() => {
      void saveDraft(draftKey, {
        title, cuisine, difficulty, prepTime, cookTime, calories, protein, carbs, fat,
        imageUrl, diets, ingredientsText, stepsText,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [draftLoaded, draftKey, title, cuisine, difficulty, prepTime, cookTime, calories, protein, carbs, fat, imageUrl, diets, ingredientsText, stepsText]);

  const attachPhoto = async (source: 'camera' | 'gallery') => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = source === 'camera' ? await takePhoto() : await pickFromGallery();
      if (!photo?.uri) return;
      await editPhotoCrop(photo.uri);
      setCropVersion((v) => v + 1);
      setLocalPhoto(photo.uri);
      if (photo.base64) {
        const mime = photo.type ?? 'image/jpeg';
        try {
          const remote = await uploadPhotoToServer(photo.base64, mime);
          if (remote) {
            setPendingPhoto(null);
            setImageUrl(remote);
            await copyCrop(photo.uri, remote);
          } else {
            

            setPendingPhoto({ base64: photo.base64, mime });
            setImageUrl('');
          }
        } catch {
          setPendingPhoto({ base64: photo.base64, mime });
          setImageUrl('');
        }
      } else {
        setImageUrl('');
      }
    } catch (e) {
      Alert.alert(t('s.formErrPhoto'), e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setPhotoBusy(false);
    }
  };
  const clearPhoto = () => { setLocalPhoto(null); setImageUrl(''); };

  const recropPhoto = async () => {
    const uri = localPhoto || imageUrl;
    if (!uri) return;
    await editPhotoCrop(uri);
    setCropVersion((v) => v + 1);
  };

  const discardDraft = () => {
    void clearDraft(draftKey);
    setTitle(editing?.title ?? '');
    setCuisine(editing?.cuisine ?? '');
    setDifficulty(editing?.difficulty ?? 'medium');
    setPrepTime(editing?.prepTime != null ? String(editing.prepTime) : '15');
    setCookTime(editing?.cookTime != null ? String(editing.cookTime) : '');
    setCalories(editing?.calories != null ? String(editing.calories) : '');
    setProtein(editing?.protein != null ? String(editing.protein) : '');
    setCarbs(editing?.carbs != null ? String(editing.carbs) : '');
    setFat(editing?.fat != null ? String(editing.fat) : '');
    setImageUrl(editing?.imageUrl ?? '');
    setDiets((editing?.dietaryRestrictions ?? []).join(', '));
    setIngredientsText((editing?.ingredients ?? []).join('\n'));
    setStepsText((editing?.steps ?? []).join('\n'));
    setEstimatedAssumptions([]);
    setDraftRestored(false);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) { setError(t('s.formErrTitle')); return; }
    const ingredients = linesOf(ingredientsText);
    const steps = linesOf(stepsText);
    if (!ingredients.length) { setError(t('s.formErrIng')); return; }
    if (!steps.length) { setError(t('s.formErrStep')); return; }
    const prep = toInt(prepTime) ?? 0;
    if (prep < 1) { setError(t('s.formErrPrep')); return; }
    const payload = {
      title: title.trim(), ingredients, steps, prepTime: prep,
      cookTime: toInt(cookTime), cuisine: cuisine.trim() || undefined,
      dietaryRestrictions: diets.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean),
      imageUrl: imageUrl.trim(), difficulty,
      calories: toInt(calories), protein: toInt(protein), carbs: toInt(carbs), fat: toInt(fat),
      guides: Array.isArray(editing?.guides) ? editing.guides : [],
      tips: Array.isArray(editing?.tips) ? editing.tips : [],
      note: editing?.note,
    };
    setBusy(true);
    try {
      let savedRecipeId: string | undefined;
      if (savedId) {
        savedRecipeId = savedId;
        await updateSaved({ id: savedId, ...payload });
      } else if (editing?.id || editing?._id) {
        savedRecipeId = editing._id ?? editing.id;
        await updateRecipe({ id: savedRecipeId, ...payload });
      } else {
        const created: any = await createRecipe(payload as any);
        savedRecipeId = created?._id ?? created?.id;
        void notifyRecipeAdded(title.trim());
      }
      

      if (pendingPhoto && savedRecipeId) {
        try {
          const remote = await uploadPhotoToServer(pendingPhoto.base64, pendingPhoto.mime);
          if (remote) {
            if (savedId) await updateSaved({ id: savedId, imageUrl: remote });
            else await updateRecipe({ id: savedRecipeId, imageUrl: remote });
            if (localPhoto) await copyCrop(localPhoto, remote);
          } else {
            await addPendingOp('photo.upload', { recipeId: savedRecipeId, base64: pendingPhoto.base64, mime: pendingPhoto.mime });
          }
        } catch {
          await addPendingOp('photo.upload', { recipeId: savedRecipeId, base64: pendingPhoto.base64, mime: pendingPhoto.mime });
        }
      }
      savedRef.current = true;
      void clearDraft(draftKey);
      setDraftRestored(false);
      goBack();
    } catch {
      setError(t('s.saveFailed'));
      setBusy(false);
    }
  };

  const runEstimate = async () => {
    if (!title.trim() || !linesOf(ingredientsText).length || !linesOf(stepsText).length) {
      setError(t('s.formErrEst'));
      return;
    }
    setError(null);
    setEstimating(true);
    try {
      const ingredients = linesOf(ingredientsText);
      const res = await estimateN({
        title: title.trim(),
        ingredients,
        steps: linesOf(stepsText),
      });
      setEstimatedAssumptions(dairyAssumptions(ingredients));
      setCalories(res.calories != null ? String(res.calories) : '');
      setProtein(res.protein != null ? String(res.protein) : '');
      setCarbs(res.carbs != null ? String(res.carbs) : '');
      setFat(res.fat != null ? String(res.fat) : '');
    } catch {
      setError(t('s.errBody'));
    } finally {
      setEstimating(false);
    }
  };

  const seg = (d: Difficulty) => (
    <Pressable key={d} onPress={() => setDifficulty(d)} style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: difficulty === d ? colors.darkButton : 'transparent' }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: difficulty === d ? readableText(colors.darkButton) : colors.textSecondary, textTransform: 'capitalize' }}>{d}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow={t('s.mineEyebrow')}
          title={editing ? t('recipe.edit') : t('recipe.createRecipe')}
          leading={(
            <Pressable
              onPress={() => goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: rgbaHelper(readableText(colors.darkButton), 0.16), opacity: pressed ? 0.75 : 1 }]}
            >
              <ArrowLeft size={18} color={readableText(colors.darkButton)} />
            </Pressable>
          )}
        />

        {draftRestored ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 2 }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.accent }}>{t('s.draftRestored')}</Text>
            <Pressable onPress={discardDraft} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>{t('s.draftDiscard')}</Text>
            </Pressable>
          </View>
        ) : null}

        <GlassCard pad={16} radius={22} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Pressable onPress={() => void attachPhoto('camera')} disabled={photoBusy} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 10, opacity: pressed || photoBusy ? 0.7 : 1 }]}>
              <Camera size={16} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{lang === 'de' ? 'Foto machen' : 'Take photo'}</Text>
            </Pressable>
            <Pressable onPress={() => void attachPhoto('gallery')} disabled={photoBusy} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 10, opacity: pressed || photoBusy ? 0.7 : 1 }]}>
              <ImagePlus size={16} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{t('s.formGallery')}</Text>
            </Pressable>
          </View>

          {localPhoto || imageUrl ? (
            <View style={{ marginBottom: 12 }}>
              <Pressable
                onLongPress={() => void recropPhoto()}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={t('s.cropLongPress')}
              >
                <CroppedImage
                  uri={localPhoto || imageUrl}
                  cropVersion={cropVersion}
                  style={{ width: '100%', height: 170, borderRadius: 14, backgroundColor: colors.surfaceMuted }}
                />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <Pressable onPress={() => void recropPhoto()} style={{ paddingHorizontal: 2, paddingVertical: 5 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{t('s.cropEdit')}</Text>
                </Pressable>
                <Pressable onPress={clearPhoto} style={{ paddingHorizontal: 2, paddingVertical: 5 }}>
                  <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 12 }}>{t('dialog.removePhoto')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <TextField label={t('recipe.title')} value={title} onChangeText={setTitle} placeholder={t('s.formTitlePh')} />

          <TextField
            label={t('recipe.ingredients')}
            value={ingredientsText}
            onChangeText={(value) => {
              setEstimatedAssumptions([]);
              const heading = /(^|\n)\s*(zubereitung|anleitung|arbeitsschritte|schritte|instructions?|steps?|method|directions)\s*:?\s*(\n|$)/i.exec(value);
              if (heading && heading.index > 0) {
                setIngredientsText(value.slice(0, heading.index).trim());
                const rest = value.slice(heading.index).replace(/^\s*[^\n]*\n?/, '').trim();
                if (rest) setStepsText(rest);
                return;
              }
              setIngredientsText(value);
            }}
            placeholder={lang === 'de' ? '200 g Pasta\n2 EL Olivenöl' : '200 g pasta\n2 tbsp olive oil'}
            multiline
            inputStyle={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          <TextField
            label={t('recipe.steps')}
            value={stepsText}
            onChangeText={setStepsText}
            placeholder={lang === 'de' ? 'Pasta in Salzwasser kochen.\n…' : 'Boil the pasta in salted water.\n…'}
            multiline
            inputStyle={{ minHeight: 130, textAlignVertical: 'top' }}
          />

          <Pressable
            onPress={() => setDetailsOpen((v) => !v)}
            accessibilityRole="button"
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 11, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
              {lang === 'de' ? 'Details: Zeit, Kalorien, Küche' : 'Details: time, calories, cuisine'}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accent }}>{detailsOpen ? '−' : '+'}</Text>
          </Pressable>

          {detailsOpen ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextField label={`${t('recipe.prepTime')} (min)`} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={`${t('recipe.cookTime')} (min)`} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={t('library.calories')} value={calories} onChangeText={setCalories} keyboardType="number-pad" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextField label={`${t('common.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={`${t('common.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label={`${t('common.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Pressable
                  onPress={() => void runEstimate()}
                  disabled={estimating}
                  style={({ pressed }) => [
                    {
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                      borderRadius: 12, paddingVertical: 10,
                      backgroundColor: colors.surfaceMuted,
                    },
                    estimating && { opacity: 0.6 },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Sparkles size={15} color={colors.accent} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                    {estimating ? t('recipe.estimating') : t('recipe.estimateAI')}
                  </Text>
                </Pressable>
                {estimatedAssumptions.length ? (
                  <Pressable
                    onPress={() => {
                      const labels: Record<DairyAssumption['kind'], string> = {
                        yogurt: t('s.formAssumeYogurt'),
                        greekYogurt: t('s.formAssumeGreekYogurt'),
                        milk: t('s.formAssumeMilk'),
                        cream: t('s.formAssumeCream'),
                        cheese: t('s.formAssumeCheese'),
                      };
                      Alert.alert(
                        t('s.formAssumptionTitle'),
                        `${t('s.formAssumptionIntro')}\n\n${estimatedAssumptions.map((item) => labels[item.kind].replace('{ingredient}', item.ingredient)).join('\n')}`,
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('s.formAssumptionTitle')}
                    hitSlop={8}
                    style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}
                  >
                    <Info size={18} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.cuisine')}</Text>
              <TextField value={cuisine} onChangeText={setCuisine} placeholder={t('s.formCuisinePh')} autoCapitalize="words" />

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.difficulty')}</Text>
              <View style={{ flexDirection: 'row', gap: 4, borderRadius: 12, padding: 3, backgroundColor: colors.surfaceMuted, marginBottom: 14 }}>
                {seg('easy')}{seg('medium')}{seg('hard')}
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.diet')}</Text>
              <TextField value={diets} onChangeText={setDiets} placeholder={t('s.formDietPh')} autoCapitalize="none" />
            </View>
          ) : null}
        </GlassCard>

        {error ? <Text style={{ color: colors.rose, fontSize: 14, marginTop: 8 }}>{error}</Text> : null}
        <AppButton label={busy ? (lang === 'de' ? 'Wird gespeichert…' : 'Saving…') : editing ? t('recipe.saveChanges') : t('recipe.createRecipe')} variant="dark" style={{ marginTop: 14 }} busy={busy} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

