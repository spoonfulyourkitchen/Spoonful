import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bookmark, ChefHat, FolderPlus, Heart, Pencil, Play, Plus, ShoppingCart, Trash2, X } from 'lucide-react-native';

import { Alert } from '../lib/alert';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { AppButton, Chip, EmptyState, GlassCard, PageHeader, SearchField } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { CollectionModal } from '../components/CollectionModal';
import { asRecipeFromDoc, formatCuisine } from '../lib/recipe';
import { useCachedList, addPendingOp, getConnNow } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { useTranslatedTexts } from '../lib/recipe-translation-cache';

type KitchenItem = { kind: 'mine' | 'saved'; doc: any };

export function MyRecipesScreen() {
  const mineLive = useQuery(api.recipes.list);
  const { data: mine, apply: applyMine } = useCachedList('mine', mineLive);
  const savedLive = useQuery(api.savedRecipes.list);
  const { data: saved, apply: applySaved } = useCachedList('saved', savedLive);
  const collections = useQuery(api.collections.list);
  const removeRecipe = useMutation(api.recipes.remove);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const updateSaved = useMutation(api.savedRecipes.update);
  const createRecipe = useMutation(api.recipes.create);
  const { t, lang } = useTranslation();

  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const mineItems = useMemo<any[]>(() => mine ?? [], [mine]);
  const savedItems = useMemo<any[]>(() => saved ?? [], [saved]);
  const colls = useMemo<any[]>(() => collections ?? [], [collections]);

  const titleTexts = useTranslatedTexts(
    [...mineItems, ...savedItems].map((recipe: any) => String(recipe.title ?? '')),
    lang,
  );

  const filtered: KitchenItem[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (doc: any) =>
      !q || `${doc.title ?? ''} ${doc.notes ?? ''} ${doc.description ?? ''}`.toLowerCase().includes(q);
    const result: KitchenItem[] = [];
    if (active === 'all' || active === 'mine') {
      result.push(...mineItems.filter(match).map((doc) => ({ kind: 'mine' as const, doc })));
    }
    if (active === 'all' || active === 'saved' || active === 'favorites' || colls.some((c) => c._id === active)) {
      const list = savedItems.filter((doc) => {
        if (!match(doc)) return false;
        if (active === 'favorites') return !!doc.favorite;
        if (active !== 'all' && active !== 'saved') return (doc.collectionIds ?? []).includes(active);
        return true;
      });
      result.push(...list.map((doc) => ({ kind: 'saved' as const, doc })));
    }
    return result;
  }, [mineItems, savedItems, search, active, colls]);

  const countFor = (group: string) =>
    group === 'all' ? mineItems.length + savedItems.length
      : group === 'mine' ? mineItems.length
        : group === 'saved' ? savedItems.length
          : group === 'favorites' ? savedItems.filter((r) => r.favorite).length
            : savedItems.filter((r) => (r.collectionIds ?? []).includes(group)).length;

  const openRecipe = (item: KitchenItem) =>
    navigate('RecipeDetail', {
      recipeId: item.kind === 'saved' ? item.doc.recipeKey ?? item.doc._id : item.doc._id,
      title: item.doc.title,
      source: item.kind,
      recipe: asRecipeFromDoc(item.doc),
    });

  const editItem = (item: KitchenItem) => {
    if (item.kind === 'saved') navigate('RecipeForm', { recipe: item.doc, savedId: item.doc._id });
    else navigate('RecipeForm', { recipe: item.doc });
  };

  const confirmDelete = (recipe: any) => {
    Alert.alert(t('recipe.deleteConfirm'), t('recipe.deleteDesc'), [
      { text: t('recipe.keepRecipe'), style: 'cancel' },
      {
        text: t('recipe.deleteRecipe'),
        style: 'destructive',
        onPress: () => {
          applyMine((prev: any[]) => prev.filter((r: any) => r._id !== recipe._id));
          void (async () => {
            if (getConnNow() === 'offline') {
              await addPendingOp('recipe.remove', { id: recipe._id });
              return;
            }
            try {
              await removeRecipe({ id: recipe._id });
            } catch {
              await addPendingOp('recipe.remove', { id: recipe._id });
            }
          })();
        },
      },
    ]);
  };

  const toggleFavorite = (doc: any) => {
    const next = !doc.favorite;
    applySaved((prev: any[]) => prev.map((r: any) => (r._id === doc._id ? { ...r, favorite: next } : r)));
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

  const removeSavedRecipe = (doc: any) => {
    applySaved((prev: any[]) => prev.filter((r: any) => r._id !== doc._id));
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

  const copyToKitchen = (doc: any) => {
    const payload = {
      title: doc.title || 'Recipe',
      description: doc.description ?? '',
      ingredients: doc.ingredients ?? [],
      steps: doc.steps ?? [],
      guides: doc.guides ?? [],
      tips: doc.tips ?? [],
      note: doc.note ?? undefined,
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
        let created: any = null;
        if (getConnNow() === 'offline') {
          await addPendingOp('recipe.create', payload);
        } else {
          created = await createRecipe(payload as any);
        }
        if (created) applyMine((prev: any[]) => [created, ...prev]);
        Alert.alert(
          lang === 'de' ? 'In deiner Küche' : 'In your kitchen',
          lang === 'de'
            ? 'Das Rezept liegt jetzt in deinen eigenen Rezepten und ist mit deinem Konto gespeichert.'
            : 'The recipe is now in your own recipes and saved to your account.',
        );
      } catch (e) {
        Alert.alert(
          lang === 'de' ? 'Hat nicht geklappt' : 'Could not add recipe',
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  };

  const openEditor = () => {
    setAddOpen(false);
    navigate('RecipeForm', {});
  };

  const openCollections = () => {
    setAddOpen(false);
    setCollectionsOpen(true);
  };

  const loading = mine === undefined || saved === undefined;

  return (
    <Page>
      <View style={{ paddingHorizontal: 18 }}>
        <PageHeader
          eyebrow={t('s.mineEyebrow')}
          title={t('s.mineTitle')}
          right={(
            <Pressable
              onPress={() => setAddOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={lang === 'de' ? 'Neu' : 'New'}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.darkButtonText, paddingHorizontal: 14, paddingVertical: 10 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Plus size={17} color={colors.darkButton} strokeWidth={2.6} />
              <Text style={{ color: colors.darkButton, fontWeight: '800', fontSize: 13.5 }}>{t('s.mineNew')}</Text>
            </Pressable>
          )}
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={lang === 'de' ? 'In deiner Küche suchen' : 'Search your kitchen'}
          style={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          <Chip label={`${t('saved.allSaved')} · ${countFor('all')}`} active={active === 'all'} onPress={() => setActive('all')} icon={<Bookmark size={13} color={colors.accent} />} />
          <Chip label={`${lang === 'de' ? 'Eigene' : 'Mine'} · ${countFor('mine')}`} active={active === 'mine'} onPress={() => setActive('mine')} icon={<ChefHat size={13} color={colors.accent} />} />
          <Chip label={`${lang === 'de' ? 'Gespeichert' : 'Saved'} · ${countFor('saved')}`} active={active === 'saved'} onPress={() => setActive('saved')} icon={<Bookmark size={13} color={colors.accent} />} />
          <Chip label={`${t('saved.favorites')} · ${countFor('favorites')}`} active={active === 'favorites'} tone="rose" onPress={() => setActive('favorites')} icon={<Heart size={13} color={colors.rose} />} />
          {colls.map((c) => (
            <Chip key={c._id} label={`${c.name} · ${countFor(c._id)}`} active={active === c._id} onPress={() => setActive(c._id)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={<ChefHat size={26} color={colors.accent} strokeWidth={2} />}
            title={mineItems.length + savedItems.length ? t('saved.nothingSaved') : t('dashboard.startBook')}
            body={mineItems.length + savedItems.length ? t('saved.bookmarkDesc') : t('s.mineStartBody')}
            action={(
              <AppButton
                label={t('s.mineCreateFirst')}
                variant="dark"
                onPress={openEditor}
                icon={<Plus size={18} color="#fff" />}
              />
            )}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, gap: 12, paddingBottom: 28 }}>
          {filtered.map((item) => (
            <KitchenCard
              key={`${item.kind}-${item.doc._id}`}
              item={item}
              title={titleTexts[item.doc.title] ?? item.doc.title}
              openRecipe={openRecipe}
              editItem={editItem}
              confirmDelete={confirmDelete}
              toggleFavorite={toggleFavorite}
              removeSavedRecipe={removeSavedRecipe}
              copyToKitchen={copyToKitchen}
            />
          ))}
        </ScrollView>
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlayStrong }}>
          <Pressable style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                {lang === 'de' ? 'Etwas Neues' : 'Something new'}
              </Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable onPress={openEditor} style={addRow}>
              <View style={addIcon}><ChefHat size={19} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={addTitle}>{lang === 'de' ? 'Neues Rezept' : 'New recipe'}</Text>
                <Text style={addSub}>{lang === 'de' ? 'Selbst eintragen und in deiner Küche speichern' : 'Write it yourself and keep it in your kitchen'}</Text>
              </View>
            </Pressable>
            <Pressable onPress={openCollections} style={[addRow, { marginTop: 8 }]}>
              <View style={addIcon}><FolderPlus size={19} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={addTitle}>{lang === 'de' ? 'Neue Sammlung' : 'New collection'}</Text>
                <Text style={addSub}>{lang === 'de' ? 'Gespeicherte Rezepte gruppieren' : 'Group your saved recipes'}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <CollectionModal
        visible={collectionsOpen}
        collections={colls}
        mode="manage"
        onClose={() => setCollectionsOpen(false)}
      />
    </Page>
  );
}

function KitchenCard({
  item,
  title,
  openRecipe,
  editItem,
  confirmDelete,
  toggleFavorite,
  removeSavedRecipe,
  copyToKitchen,
}: {
  item: KitchenItem;
  title?: string;
  openRecipe: (i: KitchenItem) => void;
  editItem: (i: KitchenItem) => void;
  confirmDelete: (d: any) => void;
  toggleFavorite: (d: any) => void;
  removeSavedRecipe: (d: any) => void;
  copyToKitchen: (d: any) => void;
}) {
  const { t, lang } = useTranslation();
  const doc = item.doc;
  const total = (doc.prepTime ?? 0) + (doc.cookTime ?? 0);
  return (
    <GlassCard variant="solid" pad={0} radius={20}>
      <Pressable onPress={() => openRecipe(item)} style={{ flexDirection: 'row' }}>
        <RecipeImage uri={doc.imageUrl} thumbWidth={110} style={{ width: 100, height: 100 }} />
        <View style={{ flex: 1, padding: 13, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
            {title ?? doc.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 5 }}>
            {`${total} min${doc.cuisine ? ` · ${formatCuisine(doc.cuisine)}` : ''}${doc.calories != null ? ` · ${doc.calories} kcal` : ''}`}
          </Text>
          {item.kind === 'saved' && doc.notes ? (
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{doc.notes}</Text>
          ) : null}
        </View>
        {item.kind === 'saved' ? (
          <Pressable
            onPress={() => toggleFavorite(doc)}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', margin: 10, backgroundColor: doc.favorite ? colors.roseBg : colors.surfaceMuted }}
          >
            <Heart size={16} color={doc.favorite ? colors.rose : colors.textSecondary} fill={doc.favorite ? colors.rose : 'transparent'} />
          </Pressable>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <Pressable onPress={() => openRecipe(item)} style={rowBtn}>
          <Play size={15} color={colors.accent} strokeWidth={2} />
          <Text style={[rowText, { color: colors.accent }]}>{t('common.open')}</Text>
        </Pressable>
        <Pressable onPress={() => editItem(item)} style={rowBtn}>
          <Pencil size={15} color={colors.textSecondary} strokeWidth={2} />
          <Text style={rowText}>{t('recipe.edit')}</Text>
        </Pressable>
        {item.kind === 'saved' ? (
          <>
            <Pressable onPress={() => copyToKitchen(doc)} style={rowBtn} accessibilityLabel={lang === 'de' ? 'In eigene Rezepte kopieren' : 'Copy to my recipes'}>
              <ShoppingCart size={15} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => removeSavedRecipe(doc)} style={[rowBtn, { backgroundColor: colors.roseBg }]}>
              <Trash2 size={15} color={colors.rose} strokeWidth={2} />
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => confirmDelete(doc)} style={[rowBtn, { backgroundColor: colors.roseBg }]}>
            <Trash2 size={15} color={colors.rose} strokeWidth={2} />
            <Text style={[rowText, { color: colors.rose }]}>{t('common.delete')}</Text>
          </Pressable>
        )}
      </View>
    </GlassCard>
  );
}

const rowBtn = {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
  borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
} as const;
const rowText = { color: colors.textSecondary, fontWeight: '600', fontSize: 12.5 } as const;
const addRow = {
  flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16,
  borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 14,
} as const;
const addIcon = {
  width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  backgroundColor: colors.accentSoft,
} as const;
const addTitle = { fontSize: 15, fontWeight: '700', color: colors.textPrimary } as const;
const addSub = { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 } as const;
