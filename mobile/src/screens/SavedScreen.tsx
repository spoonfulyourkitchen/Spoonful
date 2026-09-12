import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Bookmark, Heart, Play, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Chip, EmptyState, GlassCard, PageHeader, SearchField } from '../components/ui';
import { asRecipeFromDoc } from '../lib/recipe';
import { useCachedList, useOfflineGuard, OfflineBadge } from '../lib/offline';
import { useTranslation } from '../lib/i18n';

export function SavedScreen() {
  const savedLive = useQuery(api.savedRecipes.list);
  const { data: saved, offline } = useCachedList('saved', savedLive);
  const collections = useQuery(api.collections?.list);
  const { requireOnline } = useOfflineGuard();
  const updateSaved = useMutation(api.savedRecipes.update);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string>('all');
  const { t } = useTranslation();
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

  const toggleFavorite = (doc: any) => {
    if (!requireOnline('You are offline')) return;
    try {
      updateSaved({ id: doc._id, favorite: !doc.favorite, notes: doc.notes ?? '', collectionIds: doc.collectionIds ?? [] });
    } catch { /* reactive */ }
  };
  const onRemove = (doc: any) => {
    if (!requireOnline('You are offline')) return;
    try { removeSaved({ id: doc._id }); } catch { /* reactive */ }
  };
  const countFor = (g: string) =>
    g === 'all' ? items.length
      : g === 'favorites' ? items.filter((r) => r.favorite).length
        : items.filter((r) => (r.collectionIds ?? []).includes(g)).length;
  const openRecipe = (item: any) =>
    navigate('RecipeDetail', { recipeId: item.recipeKey ?? item._id, title: item.title, source: 'saved', recipe: asRecipeFromDoc(item) });

  return (
    <Page>
      <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
        {offline ? <OfflineBadge /> : null}
        <PageHeader eyebrow={t('saved.privateShelf')} title={t('saved.title')} />
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
          contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 24 }}
          keyExtractor={(r) => r._id}
          ListEmptyComponent={
            <EmptyState icon={<Bookmark size={24} color={colors.accent} strokeWidth={2} />} title={t('saved.nothingSaved')} body={t('saved.bookmarkDesc')} />
          }
          renderItem={({ item }) => (
            <SavedRow item={item} openRecipe={openRecipe} toggleFavorite={toggleFavorite} onRemove={onRemove} />
          )}
        />
      )}
    </Page>
  );
}

function SavedRow({ item, openRecipe, toggleFavorite, onRemove }: { item: any; openRecipe: (i: any) => void; toggleFavorite: (d: any) => void; onRemove: (d: any) => void }) {
  return (
    <GlassCard variant="solid" pad={0} radius={20}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>{item.title}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, textTransform: 'capitalize' }}>
              {item.cuisine || 'Everyday'} · {(item.prepTime ?? 0) + (item.cookTime ?? 0)} min
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

