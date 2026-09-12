import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ChefHat, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { AppButton, EmptyState, GlassCard, PageHeader } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { formatCuisine } from '../lib/recipe';
import { useCachedList, useOfflineGuard, OfflineBadge } from '../lib/offline';
import { useTranslation } from '../lib/i18n';

function asLibrary(r: any) {
  return {
    id: r._id, title: r.title, description: r.description ?? '',
    ingredients: r.ingredients ?? [], steps: r.steps ?? [],
    prepTime: r.prepTime ?? 0, cookTime: r.cookTime ?? 0,
    cuisine: r.cuisine ?? 'Other', dietaryRestrictions: r.dietaryRestrictions ?? [],
    imageUrl: r.imageUrl, difficulty: r.difficulty ?? 'medium',
    calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat,
  };
}

export function MyRecipesScreen() {
  const live = useQuery(api.recipes.list);
  const { data: mine, offline } = useCachedList('mine', live);
  const { requireOnline } = useOfflineGuard();
  const { t } = useTranslation();
  const removeRecipe = useMutation(api.recipes.remove);
  const openEditor = () => navigate('RecipeForm', {});

  const confirmDelete = (recipe: any) => {
    if (!requireOnline('You are offline')) return;
    Alert.alert(t('recipe.deleteConfirm'), t('recipe.deleteDesc'), [
      { text: t('recipe.keepRecipe'), style: 'cancel' },
      { text: t('recipe.deleteRecipe'), style: 'destructive', onPress: () => { try { removeRecipe({ id: recipe._id }); } catch { /* reactive */ } } },
    ]);
  };

  return (
    <Page>
      <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
        {offline ? <OfflineBadge /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PageHeader eyebrow={t('s.mineEyebrow')} title={t('s.mineTitle')} />
          </View>
          <Pressable
            onPress={openEditor}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Plus size={17} color={colors.accentText} strokeWidth={2.6} />
            <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>{t('s.mineNew')}</Text>
          </Pressable>
        </View>
      </View>

      {mine === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : mine.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={<ChefHat size={26} color={colors.accent} strokeWidth={2} />}
            title={t('dashboard.startBook')}
            body={t('s.mineStartBody')}
            action={<AppButton label={t('s.mineCreateFirst')} variant="dark" onPress={openEditor} icon={<Plus size={18} color="#fff" />} />}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 28 }}>
          {mine.map((recipe: any) => (
            <GlassCard key={recipe._id} pad={0} radius={20} variant="solid">
              <Pressable
                onPress={() => navigate('RecipeDetail', { recipeId: recipe._id, title: recipe.title, source: 'mine', recipe: asLibrary(recipe) })}
                style={{ flexDirection: 'row' }}
              >
                <RecipeImage uri={recipe.imageUrl} style={{ width: 100, height: 100 }} />
                <View style={{ flex: 1, padding: 13, justifyContent: 'center' }}>
                  <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{recipe.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 5 }}>
                    {`${(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min${recipe.cuisine ? ` · ${formatCuisine(recipe.cuisine)}` : ''}${recipe.calories != null ? ` · ${recipe.calories} kcal` : ''}`}
                  </Text>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
                <Pressable onPress={() => navigate('RecipeForm', { recipe })} style={rowBtn}>
                  <Pencil size={15} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{t('recipe.edit')}</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(recipe)} style={[rowBtn, { borderColor: 'rgba(225,29,72,0.3)', backgroundColor: colors.roseBg }]}>
                  <Trash2 size={15} color={colors.rose} strokeWidth={2} />
                  <Text style={{ color: colors.rose, fontWeight: '600', fontSize: 13 }}>{t('common.delete')}</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </Page>
  );
}

const rowBtn = {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10,
  borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
} as const;
