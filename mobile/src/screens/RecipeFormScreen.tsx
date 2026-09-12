import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ImagePlus, Sparkles } from 'lucide-react-native';
import { useAction, useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText } from '../theme';
import { goBack } from '../navigation/rootRef';
import { AppButton, GlassCard, PageHeader, TextField } from '../components/ui';
import { notifyRecipeAdded } from '../lib/notifications';
import { pickFromGallery, takePhoto, uploadPhotoToServer } from '../lib/photo';
import { useTranslation } from '../lib/i18n';

type Difficulty = 'easy' | 'medium' | 'hard';
function toInt(value: string): number | undefined {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
}
const linesOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

export function RecipeFormScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const editing = route.params?.recipe as any;
  const createRecipe = useMutation(api.recipes.create);
  const updateRecipe = useMutation(api.recipes.update);

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
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? '');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [diets, setDiets] = useState((editing?.dietaryRestrictions ?? []).join(', '));
  const [ingredientsText, setIngredientsText] = useState((editing?.ingredients ?? []).join('\n'));
  const [stepsText, setStepsText] = useState((editing?.steps ?? []).join('\n'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attachPhoto = async (source: 'camera' | 'gallery') => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = source === 'camera' ? await takePhoto() : await pickFromGallery();
      if (!photo?.uri) return; // user cancelled or no permission
      setLocalPhoto(photo.uri);
      setImageUrl(photo.uri); // device-local fallback
      // When the backend upload function is available, use the public URL
      // instead so the photo also shows for others / in the community.
      if (photo.base64) {
        try {
          const remote = await uploadPhotoToServer(photo.base64, photo.type ?? 'image/jpeg');
          if (remote) setImageUrl(remote);
        } catch {
          // keep the local file: saving the recipe must still work offline
        }
      }
    } catch (e) {
      Alert.alert(t('s.formErrPhoto'), e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setPhotoBusy(false);
    }
  };
  const clearPhoto = () => { setLocalPhoto(null); setImageUrl(''); };

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
      imageUrl: imageUrl.trim() || undefined, difficulty,
      calories: toInt(calories), protein: toInt(protein), carbs: toInt(carbs), fat: toInt(fat),
    };
    setBusy(true);
    try {
      if (editing?.id || editing?._id) {
        await updateRecipe({ id: editing._id ?? editing.id, ...payload });
      } else {
        await createRecipe(payload as any);
        void notifyRecipeAdded(title.trim());
      }
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the recipe.');
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
      const res = await estimateN({ title: title.trim(), ingredients: linesOf(ingredientsText), steps: linesOf(stepsText) });
      setCalories(res.calories != null ? String(res.calories) : '');
      setProtein(res.protein != null ? String(res.protein) : '');
      setCarbs(res.carbs != null ? String(res.carbs) : '');
      setFat(res.fat != null ? String(res.fat) : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nutrition could not be estimated. Please try again.');
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 20 }}>
          <Pressable onPress={() => goBack()} style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <PageHeader eyebrow={t('s.mineEyebrow')} title={editing ? t('recipe.edit') : t('recipe.createRecipe')} />
          </View>
        </View>

        <GlassCard pad={16} radius={22} style={{ marginTop: 8 }}>
          <TextField label={t('recipe.title')} value={title} onChangeText={setTitle} placeholder={t('s.formTitlePh')} />
          <TextField label={`${t('recipe.photo')} ${t('common.optional')}`} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" autoCorrect={false} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <Pressable onPress={() => void attachPhoto('camera')} disabled={photoBusy} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 10, opacity: pressed || photoBusy ? 0.7 : 1 }]}>
              <Camera size={16} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{photoBusy ? 'Opening…' : 'Take photo'}</Text>
            </Pressable>
            <Pressable onPress={() => void attachPhoto('gallery')} disabled={photoBusy} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 10, opacity: pressed || photoBusy ? 0.7 : 1 }]}>
              <ImagePlus size={16} color={colors.accent} />
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{t('s.formGallery')}</Text>
            </Pressable>
          </View>
          {localPhoto ? (
            <View style={{ marginTop: 10 }}>
              <Image source={{ uri: localPhoto }} resizeMode="cover" style={{ width: '100%', height: 150, borderRadius: 14, backgroundColor: colors.surfaceMuted }} />
              <Pressable onPress={clearPhoto} style={{ alignSelf: 'flex-end', marginTop: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 12 }}>{t('dialog.removePhoto')}</Text>
              </Pressable>
              <Text style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 14 }}>
                When you are online your photo is uploaded to the Spoonful server so it is shared with your recipe everywhere.
              </Text>
            </View>
          ) : null}
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
          <Pressable
            onPress={() => void runEstimate()}
            disabled={estimating}
            style={({ pressed }) => [
              {
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 12, paddingVertical: 10, marginBottom: 6,
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
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.cuisine')}</Text>
          <TextField value={cuisine} onChangeText={setCuisine} placeholder={t('s.formCuisinePh')} autoCapitalize="words" />

          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.difficulty')}</Text>
          <View style={{ flexDirection: 'row', gap: 4, borderRadius: 12, padding: 3, backgroundColor: colors.surfaceMuted, marginBottom: 14 }}>
            {seg('easy')}{seg('medium')}{seg('hard')}
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t('recipe.diet')}</Text>
          <TextField value={diets} onChangeText={setDiets} placeholder={t('s.formDietPh')} autoCapitalize="none" />

          <TextField label={t('recipe.ingredients')} value={ingredientsText} onChangeText={setIngredientsText} placeholder={'200 g pasta\n2 tbsp olive oil'} multiline inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} />
          <TextField label={t('recipe.steps')} value={stepsText} onChangeText={setStepsText} placeholder={'Boil the pasta in salted water.\n…'} multiline inputStyle={{ minHeight: 140, textAlignVertical: 'top' }} />
        </GlassCard>

        {error ? <Text style={{ color: colors.rose, fontSize: 14, marginTop: 8 }}>{error}</Text> : null}
        <AppButton label={busy ? 'Saving…' : editing ? t('recipe.saveChanges') : t('recipe.createRecipe')} variant="dark" style={{ marginTop: 14 }} busy={busy} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

