import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Bookmark, ChefHat, FolderPlus, Pencil, Play, Plus, Trash2, X } from 'lucide-react-native';

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
import { tr2, localeFor } from '../lib/hardcoded-l10n';
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
    if (active === 'all' || active === 'saved' || colls.some((c) => c._id === active)) {
      const list = savedItems.filter((doc) => {
        if (!match(doc)) return false;
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
              accessibilityLabel={tr2('Neu', 'New', lang)}
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
          placeholder={tr2('In deiner Küche suchen', 'Search your kitchen', lang)}
          style={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          <Chip label={`${t('saved.allSaved')} · ${countFor('all')}`} active={active === 'all'} onPress={() => setActive('all')} icon={<Bookmark size={13} color={colors.accent} />} />
          <Chip label={`${tr2('Eigene', 'Mine', lang)} · ${countFor('mine')}`} active={active === 'mine'} onPress={() => setActive('mine')} icon={<ChefHat size={13} color={colors.accent} />} />
          <Chip label={`${tr2('Gespeichert', 'Saved', lang)} · ${countFor('saved')}`} active={active === 'saved'} onPress={() => setActive('saved')} icon={<Bookmark size={13} color={colors.accent} />} />
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
              removeSavedRecipe={removeSavedRecipe}
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
                {tr2('Etwas Neues', 'Something new', lang)}
              </Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable onPress={openEditor} style={addRow}>
              <View style={addIcon}><ChefHat size={19} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={addTitle}>{tr2('Neues Rezept', 'New recipe', lang)}</Text>
                <Text style={addSub}>{tr2('Selbst eintragen und in deiner Küche speichern', 'Write it yourself and keep it in your kitchen', lang)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={openCollections} style={[addRow, { marginTop: 8 }]}>
              <View style={addIcon}><FolderPlus size={19} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={addTitle}>{tr2('Neue Sammlung', 'New collection', lang)}</Text>
                <Text style={addSub}>{tr2('Gespeicherte Rezepte gruppieren', 'Group your saved recipes', lang)}</Text>
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
  removeSavedRecipe,
}: {
  item: KitchenItem;
  title?: string;
  openRecipe: (i: KitchenItem) => void;
  editItem: (i: KitchenItem) => void;
  confirmDelete: (d: any) => void;
  removeSavedRecipe: (d: any) => void;
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
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <Pressable onPress={() => openRecipe(item)} style={[rowBtn, { backgroundColor: colors.accentSoft, borderColor: 'transparent' }]}>
          <Play size={14} color={colors.accent} strokeWidth={2.4} />
          <Text numberOfLines={1} style={[rowText, { color: colors.accent }]}>{t('common.open')}</Text>
        </Pressable>
        <Pressable onPress={() => editItem(item)} style={rowBtn}>
          <Pencil size={14} color={colors.textSecondary} strokeWidth={2.2} />
          <Text numberOfLines={1} style={rowText}>{t('recipe.edit')}</Text>
        </Pressable>
        {item.kind === 'saved' ? (
          <>
            <Pressable onPress={() => removeSavedRecipe(doc)} style={[rowBtn, { backgroundColor: colors.roseBg, borderColor: 'transparent' }]}>
              <Trash2 size={14} color={colors.rose} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[rowText, { color: colors.rose }]}>{t('common.delete')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => confirmDelete(doc)} style={[rowBtn, { backgroundColor: colors.roseBg, borderColor: 'transparent' }]}>
            <Trash2 size={14} color={colors.rose} strokeWidth={2.2} />
            <Text numberOfLines={1} style={[rowText, { color: colors.rose }]}>{t('common.delete')}</Text>
          </Pressable>
        )}
      </View>
    </GlassCard>
  );
}

const rowBtn = {
  flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
  paddingHorizontal: 3, paddingVertical: 9, borderRadius: 10,
  borderWidth: 1, borderColor: colors.cardBorder,
} as const;
const rowText = { get color() { return colors.textSecondary; }, fontWeight: '700', fontSize: 10 } as const;
const addRow = {
  flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16,
  borderWidth: 1, get borderColor() { return colors.cardBorder; }, get backgroundColor() { return colors.card; }, padding: 14,
} as const;
const addIcon = {
  width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  get backgroundColor() { return colors.accentSoft; },
} as const;
const addTitle = { fontSize: 15, fontWeight: '700', get color() { return colors.textPrimary; } } as const;
const addSub = { fontSize: 12.5, get color() { return colors.textSecondary; }, marginTop: 2 } as const;
