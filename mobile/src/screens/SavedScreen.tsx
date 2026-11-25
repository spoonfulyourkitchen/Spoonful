import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Bookmark, ChefHat, Heart, Play, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { CollectionModal } from '../components/CollectionModal';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Chip, EmptyState, GlassCard, PageHeader, SearchField } from '../components/ui';
import { asRecipeFromDoc } from '../lib/recipe';
import { useCachedList, addPendingOp, getConnNow } from '../lib/offline';
import { loadDraft, saveDraft } from '../lib/draft';
import { useTranslation } from '../lib/i18n';
import { Alert } from '../lib/alert';
import { useTranslatedTexts } from '../lib/recipe-translation-cache';

export function SavedScreen() {
  const savedLive = useQuery(api.savedRecipes.list);
  const { data: saved, apply } = useCachedList('saved', savedLive);
  const collections = useQuery(api.collections.list);
  const updateSaved = useMutation(api.savedRecipes.update);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const createRecipe = useMutation(api.recipes.create);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string>('all');
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDraft<{ search?: string; active?: string }>('saved-list').then((d) => {
      if (!alive) return;
      if (d && typeof d === 'object') {
        if (typeof d.search === 'string') setSearch(d.search);
        if (typeof d.active === 'string') setActive(d.active);
      }
      setFiltersReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const timer = setTimeout(() => {
      void saveDraft('saved-list', { search, active });
    }, 350);
    return () => clearTimeout(timer);
  }, [filtersReady, search, active]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const { t, lang } = useTranslation();
  const items: any[] = saved ?? [];
  const colls: any[] = collections ?? [];

  const filtered: any[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (saved ?? []).filter((r: any) => {
      const matchesSearch = !q || `${r.title ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q);
      const matchesGroup =
        active === 'all' ? true
          : active === 'favorites' ? !!r.favorite
            : (r.collectionIds ?? []).includes(active);
      return matchesSearch && matchesGroup;
    });
  }, [saved, search, active]);

  const titleTexts = useTranslatedTexts(
    filtered.map((recipe: any) => String(recipe.title ?? '')),
    lang,
  );

  const toggleFavorite = (doc: any) => {
    const next = !doc.favorite;
    apply((prev: any[]) => prev.map((r: any) => (r._id === doc._id ? { ...r, favorite: next } : r)));
    void (async () => {
      const payload = { id: doc._id, favorite: next, notes: doc.notes ?? '', collectionIds: doc.collectionIds ?? [] };
      if (getConnNow() === 'offline') {
        await addPendingOp('saved.update', payload);
        return;
      }
      try {
        await updateSaved(payload);
      } catch {
        await addPendingOp('saved.update', payload);
      }
    })();
  };
  const onRemove = (doc: any) => {
    apply((prev: any[]) => prev.filter((r: any) => r._id !== doc._id));
    void (async () => {
      if (getConnNow() === 'offline') {
        await addPendingOp('saved.remove', { id: doc._id });
        return;
      }
      try {
        await removeSaved({ id: doc._id });
      } catch {
        await addPendingOp('saved.remove', { id: doc._id });
      }
    })();
  };
  const addToKitchen = (doc: any) => {
    const payload = {
      title: doc.title || 'Recipe',
      description: doc.description ?? '',
      ingredients: doc.ingredients ?? [],
      steps: doc.steps ?? [],
      guides: doc.guides ?? [],
      prepTime: doc.prepTime ?? 0,
      cookTime: doc.cookTime ?? 0,
      cuisine: doc.cuisine ?? '',
      dietaryRestrictions: doc.dietaryRestrictions ?? [],
      imageUrl: doc.imageUrl ?? undefined,
      difficulty: doc.difficulty ?? 'easy',
      calories: doc.calories ?? undefined,
      protein: doc.protein ?? undefined,
      carbs: doc.carbs ?? undefined,
      fat: doc.fat ?? undefined,
    };
    void (async () => {
      try {
        if (getConnNow() === 'offline') {
          await addPendingOp('recipe.create', payload);
        } else {
          await createRecipe(payload as any);
        }
        Alert.alert(
          lang === 'de' ? 'In deiner Küche' : 'In your kitchen',
          lang === 'de'
            ? 'Das Rezept liegt jetzt in „Meine Rezepte“ und ist mit deinem Konto gespeichert.'
            : 'The recipe is now in My Recipes and saved to your account.',
        );
      } catch (e) {
        Alert.alert(
          lang === 'de' ? 'Hat nicht geklappt' : 'Could not add recipe',
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  };

  const countFor = (g: string) =>
    g === 'all' ? items.length
      : g === 'favorites' ? items.filter((r) => r.favorite).length
        : items.filter((r) => (r.collectionIds ?? []).includes(g)).length;
  const openRecipe = (item: any) =>
    navigate('RecipeDetail', { recipeId: item.recipeKey ?? item._id, title: item.title, source: 'saved', recipe: asRecipeFromDoc(item) });

  return (
    <Page>
      <View style={{ paddingHorizontal: 18 }}>
        <PageHeader
          eyebrow={t('saved.privateShelf')}
          title={t('saved.title')}
          right={(
            <Pressable onPress={() => setCollectionsOpen(true)} accessibilityRole="button" accessibilityLabel={t('s.collectionManage')} hitSlop={4} style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
              <Plus size={20} color={colors.accentText} strokeWidth={2.5} />
            </Pressable>
          )}
        />
        <SearchField value={search} onChangeText={setSearch} placeholder={t('saved.searchSaved')} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <Chip label={`${t('saved.allSaved')} · ${countFor('all')}`} active={active === 'all'} onPress={() => setActive('all')} icon={<Bookmark size={13} color={colors.accent} />} />
          <Chip label={`${t('saved.favorites')} · ${countFor('favorites')}`} active={active === 'favorites'} tone="rose" onPress={() => setActive('favorites')} icon={<Heart size={13} color={colors.rose} />} />
          {colls.map((c) => (
            <Chip key={c._id} label={`${c.name} · ${countFor(c._id)}`} active={active === c._id} onPress={() => setActive(c._id)} />
          ))}
        </View>
      </View>

      {saved === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, gap: 12, paddingBottom: 24 }}
          keyExtractor={(r) => r._id}
          ListEmptyComponent={
            <EmptyState icon={<Bookmark size={24} color={colors.accent} strokeWidth={2} />} title={t('saved.nothingSaved')} body={t('saved.bookmarkDesc')} />
          }
          renderItem={({ item }) => (
            <SavedRow
              item={item}
              title={titleTexts[item.title] ?? item.title}
              openRecipe={openRecipe}
              toggleFavorite={toggleFavorite}
              onRemove={onRemove}
              addToKitchen={addToKitchen}
            />
          )}
        />
      )}
      <CollectionModal visible={collectionsOpen} collections={colls} mode="manage" onClose={() => setCollectionsOpen(false)} />
    </Page>
  );
}

function SavedRow({ item, title, openRecipe, toggleFavorite, onRemove, addToKitchen }: { item: any; title?: string; openRecipe: (i: any) => void; toggleFavorite: (d: any) => void; onRemove: (d: any) => void; addToKitchen: (d: any) => void }) {
  const { t } = useTranslation();
  return (
    <GlassCard variant="solid" pad={0} radius={20}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>{title ?? item.title}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, textTransform: 'capitalize' }}>
              {item.cuisine || t('s.mineEveryday')} · {(item.prepTime ?? 0) + (item.cookTime ?? 0)} min
            </Text>
          </View>
          <Pressable
            onPress={() => toggleFavorite(item)}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: item.favorite ? colors.roseBg : colors.surfaceMuted }}
          >
            <Heart size={17} color={item.favorite ? colors.rose : colors.textSecondary} fill={item.favorite ? colors.rose : 'transparent'} />
          </Pressable>
        </View>
        {item.notes ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 10 }}>{item.notes}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <ActionBtn label={t('common.open')} icon={<Play size={14} color={colors.accent} />} onPress={() => openRecipe(item)} />
        <ActionBtn label={t('nav.shopping')} icon={<ShoppingCart size={14} color={colors.accent} />} onPress={() => openRecipe(item)} />
        <Pressable
          onPress={() => addToKitchen(item)}
          accessibilityRole="button"
          accessibilityLabel="Add to my kitchen"
          style={{ width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}
        >
          <ChefHat size={16} color={colors.accent} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => onRemove(item)} style={{ width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.roseBg }}>
          <Trash2 size={15} color={colors.rose} strokeWidth={2} />
        </Pressable>
      </View>
    </GlassCard>
  );
}

function ActionBtn({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.surfaceMuted }, pressed && { opacity: 0.7 }]}>
      {icon}
      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}

