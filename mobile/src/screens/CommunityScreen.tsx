import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Bookmark, BookmarkCheck, Clock3, Flame, Heart, MessageSquare, Play, Search, SlidersHorizontal, Star, UsersRound, X } from 'lucide-react-native';
import { markReviewAction } from '../lib/review';
import { CollectionModal } from '../components/CollectionModal';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { AppButton, Chip, EmptyState, GlassCard, PageHeader } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { CommentSheet } from '../components/CommentSheet';
import { CommunityReportButton } from '../components/CommunityReportButton';
import { TutorialTarget } from '../components/TutorialTarget';
import { tutorialAction } from '../lib/tutorial';
import { translate } from '../lib/i18n';
import { difficultyLabel } from '../lib/recipe';
import { asRecipeFromDoc } from '../lib/recipe';
import { useConnectivity, retryConnectivity, addPendingOp, getConnNow } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { difficultyColor } from '../theme';
import { formatCuisine } from '../lib/recipe';
import { OfflineTv } from '../components/OfflineTv';

const DIFFS = ['all', 'easy', 'medium', 'hard'] as const;

export function CommunityScreen() {
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  const community = useQuery(api.sharing.community);
  const savedList = useQuery(api.savedRecipes.list);
  const collections = useQuery(api.collections.list) as any[] | undefined;
  const saveRecipe = useMutation(api.savedRecipes.save);
  const removeSaved = useMutation(api.savedRecipes.remove);
  const likeShare = useMutation(api.sharing.like);
  const unlikeShare = useMutation(api.sharing.unlike);
  
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const likeOf = (item: any) => likes[item._id] ?? { liked: !!item.likedByMe, count: Number(item.likesCount ?? 0) };
  const [commentShare, setCommentShare] = useState<{ id: string; title: string } | null>(null);
  const [collectionTarget, setCollectionTarget] = useState<any | null>(null);
  const commentCounts = useQuery(api.sharing.commentCounts) as Record<string, number> | undefined;
  const me = useQuery(api.users.currentUser);
  const slideX = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(0);
  const { width: W } = useWindowDimensions();
  const feedHeight = Dimensions.get('window').height;

  
  const goPage = (index: number) => {
    const clamped = index < 0 ? 0 : index > 1 ? 1 : index;
    pageRef.current = clamped;
    Animated.spring(slideX, {
      toValue: -clamped * W,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
      overshootClamping: true,
    }).start();
  };

  useEffect(() => {
    slideX.setValue(-pageRef.current * W);
  }, [W, slideX]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const base = -pageRef.current * W;
        let next = base + g.dx;
        if (next > 0) next *= 0.35;
        else if (next < -W) next = -W + (next + W) * 0.35;
        slideX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = -pageRef.current * W;
        const next = base + g.dx;
        const flung = Math.abs(g.vx) > 0.45;
        if ((flung && g.vx < 0) || (!flung && next < -W * 0.35)) goPage(pageRef.current + 1);
        else if ((flung && g.vx > 0) || (!flung && next > W * 0.35)) goPage(pageRef.current - 1);
        else goPage(pageRef.current);
      },
      onPanResponderTerminate: () => goPage(pageRef.current),
    }),
  ).current;
  const [sort, setSort] = useState<'popular' | 'recent'>('recent');
  const [q, setQ] = useState('');
  const [diff, setDiff] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const items: any[] = useMemo(() => community ?? [], [community]);
  const savedDocs: any[] = savedList ?? [];
  const { t } = useTranslation();

  const conn = useConnectivity();
  

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = [...items].filter((it: any) => {
      if (diff !== 'all' && (it.difficulty ?? 'medium') !== diff) return false;
      if (!query) return true;
      const hay = `${it.title} ${it.cuisine ?? ''} ${it.authorName ?? ''} ${(it.description ?? '')}`.toLowerCase();
      return hay.includes(query);
    });
    return base.sort((a: any, b: any) =>
      sort === 'popular' ? (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) : (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
  }, [items, sort, q, diff]);

  

  useEffect(() => {
    if (!community) return;
    setLikes((prev) => {
      if (!Object.keys(prev).length) return prev;
      let changed = false;
      const next = { ...prev };
      for (const item of community as any[]) {
        const override = next[item._id];
        if (!override) continue;
        if (override.liked === !!item.likedByMe && override.count === Number(item.likesCount ?? 0)) {
          delete next[item._id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [community]);

  if (conn === 'offline') {
    return (
      <OfflineTv
        title={t('community.title')}
        message={t('s.commOfflineB')}
        onRetry={() => { void retryConnectivity(); }}
      />
    );
  }

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); void retryConnectivity(); }, 900);
  };

  const isSaved = (id: string) => savedDocs.some((s: any) => s.recipeKey === `community-${id}`);

  const toggleSave = async (item: any, currently: boolean, collectionId: string | null = null) => {
    if (currently) {
      const doc = savedDocs.find((s: any) => s.recipeKey === `community-${item._id}`);
      if (doc) { try { await removeSaved({ id: doc._id }); } catch {  } }
      return;
    }
    const rec = asRecipeFromDoc(item, `community-${item._id}`);
    try {
      await saveRecipe({
        recipeKey: `community-${item._id}`,
        title: rec.title,
        description: rec.description ?? '',
        ingredients: rec.ingredients ?? [],
        steps: rec.steps ?? [],
        prepTime: rec.prepTime ?? 0,
        cookTime: rec.cookTime ?? 0,
        cuisine: rec.cuisine ?? 'Other',
        dietaryRestrictions: rec.dietaryRestrictions ?? [],
        imageUrl: rec.imageUrl,
        difficulty: (rec.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
        calories: rec.calories,
        protein: rec.protein,
        carbs: rec.carbs,
        fat: rec.fat,
        collectionIds: collectionId ? [collectionId] : [],
      });
    } catch {  }
  };

  const cookNow = (item: any) => {
    navigate('Cooking', {
      title: item.title,
      steps: item.steps?.length ? item.steps : ['Prepare your ingredients and enjoy.'],
      totalTime: (item.prepTime ?? 0) + (item.cookTime ?? 0),
      ingredients: item.ingredients ?? [],
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    });
  };

  const toggleLike = (item: any) => {
    

    const current = likeOf(item);
    const next = { liked: !current.liked, count: Math.max(0, current.count + (current.liked ? -1 : 1)) };
    if (next.liked) markReviewAction('like');
    setLikes((prev) => ({ ...prev, [item._id]: next }));
    void (async () => {
      const kind = next.liked ? 'community.like' : 'community.unlike';
      if (getConnNow() === 'offline') {
        await addPendingOp(kind, { shareId: item._id });
        return;
      }
      try {
        if (next.liked) await likeShare({ shareId: item._id });
        else await unlikeShare({ shareId: item._id });
      } catch {
        await addPendingOp(kind, { shareId: item._id });
      }
    })();
  };

  const feedPage = (
    <View style={{ width: W, flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => goPage(0)}
        hitSlop={8}
        style={{ position: 'absolute', top: 14, right: 16, zIndex: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.darkButton }}
      >
        <Text style={{ fontSize: 11, color: colors.darkButtonText, fontWeight: '700' }}>{'← Back to the list'}</Text>
      </Pressable>
      <FlatList
            data={items}
            keyExtractor={(r: any) => r._id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            renderItem={({ item }: any) => (
              <View style={{ height: feedHeight, paddingTop: 40 }}>
                <RecipeImage uri={item.imageUrl} thumbWidth={460} style={{ height: feedHeight * 0.55, width: '100%' }} />
                <View style={{ flex: 1, padding: 20 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif' }}>{item.title}</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6 }} numberOfLines={3}>
                    {item.description || t('s.commFallbackDesc')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
                    <Pressable
                      onPress={() => toggleLike(item)}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: likeOf(item).liked ? colors.roseBg : colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Heart size={18} color={likeOf(item).liked ? colors.rose : colors.textSecondary} fill={likeOf(item).liked ? colors.rose : 'transparent'} />
                      <Text style={{ fontWeight: '800', color: likeOf(item).liked ? colors.rose : colors.textSecondary }}>{likeOf(item).count}</Text>
                    </Pressable>
                    <Pressable onPress={() => cookNow(item)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
                      <Flame size={16} color={colors.darkButtonText} />
                      <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{t('s.commCookIt')}</Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 'auto', textAlign: 'center' }}>{t('s.commSwipe')}</Text>
                </View>
              </View>
            )}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }} {...pan.panHandlers}>
      <Animated.View style={{ width: W * 2, flex: 1, flexDirection: 'row', transform: [{ translateX: slideX }] }}>
        <View style={{ width: W, flex: 1 }}>
        <Page>

      {community === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <TutorialTarget id="tut-community-feed" style={{ flex: 1 }}>
        <FlatList
          data={filtered}
          onScroll={() => tutorialAction('tut-community-feed')}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 24 }}
          keyExtractor={(r) => r._id}
          ListHeaderComponent={<>
      <View style={{ paddingTop: 4, paddingBottom: 2 }}>
        <PageHeader eyebrow={t('community.fromCommunity')} title={t('community.title')} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10 }}>
            <Search size={15} color={colors.textSecondary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('s.commSearch')}
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: colors.textPrimary }}
            />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><X size={15} color={colors.textSecondary} /></Pressable> : null}
          </View>
          <Pressable onPress={() => setFiltersOpen(true)} accessibilityLabel={t('s.commFilters')} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
            <SlidersHorizontal size={15} color={colors.darkButtonText} />
            <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13 }}>{t('s.commFilters')}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {diff !== 'all' ? <Chip label={dLabel(diff)} active tone={diff === 'hard' ? 'rose' : diff === 'medium' ? 'accent' : 'green'} onPress={() => setDiff('all')} /> : null}
        </View>

        <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
              <Pressable style={{ flex: 1 }} onPress={() => setFiltersOpen(false)} />
              <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SlidersHorizontal size={17} color={colors.accent} />
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.commFilters')}</Text>
                  <Pressable onPress={() => setFiltersOpen(false)} hitSlop={10}>
                    <X size={19} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' }}>{t('s.commSort')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={t('s.commSortNew')} active={sort === 'recent'} onPress={() => setSort('recent')} />
                  <Chip label={t('s.commSortTop')} active={sort === 'popular'} onPress={() => setSort('popular')} />
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' }}>{t('s.commDifficulty')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {DIFFS.map((d) => (
                    <Chip key={d} label={dLabel(d)} active={diff === d} onPress={() => setDiff(d)} tone={d === 'hard' ? 'rose' : d === 'medium' ? 'accent' : 'green'} />
                  ))}
                </View>
                <AppButton label={t('common.close')} variant="dark" style={{ marginTop: 20 }} onPress={() => setFiltersOpen(false)} />
              </View>
            </View>
        
        </KeyboardAvoidingView></Modal>
      </View>
      </>}
          ListEmptyComponent={
            <EmptyState
              icon={<UsersRound size={24} color={colors.accent} strokeWidth={2} />}
              title={q || diff !== 'all' ? 'No matches' : t('community.emptyTitle')}
              body={q || diff !== 'all' ? 'Try a different search or difficulty.' : t('community.emptyShare')}
            />
          }
          renderItem={({ item }) => (
            <CommunityCard
              item={item}
              saved={isSaved(item._id)}
              liked={likeOf(item).liked}
              likesCount={likeOf(item).count}
              commentCount={Number(commentCounts?.[item._id] ?? 0)}
              likeBusyId={null}
              onComments={() => setCommentShare({ id: item._id, title: item.title ?? 'Recipe' })}
              onLike={() => toggleLike(item)}
              onSave={() => {
                if (isSaved(item._id)) void toggleSave(item, true);
                else setCollectionTarget(item);
              }}
              onCook={() => cookNow(item)}
              onOpen={() => navigate('RecipeDetail', { recipeId: item._id, title: item.title, source: 'community', recipe: asRecipeFromDoc(item, `community-${item._id}`) })}
            />
          )}
        />
        </TutorialTarget>
      )}
        </Page>
        </View>
        {feedPage}
      </Animated.View>

      <CollectionModal
        visible={collectionTarget != null}
        collections={collections ?? []}
        mode="pick"
        onChoose={(collectionId) => {
          const target = collectionTarget;
          setCollectionTarget(null);
          if (target) void toggleSave(target, false, collectionId);
        }}
        onClose={() => setCollectionTarget(null)}
      />
      <CommentSheet
        shareId={commentShare?.id ?? null}
        shareTitle={commentShare?.title ?? ''}
        userName={(me as any)?.name ?? (me as any)?.email ?? null}
        onClose={() => setCommentShare(null)}
      />
    </View>
  );
}

function dLabel(d: string): string {
  return d === 'all' ? translate('s.commAnyDiff') : d.charAt(0).toUpperCase() + d.slice(1);
}

function CommunityCard({ item, saved, liked, likesCount, commentCount, likeBusyId, onLike, onSave, onCook, onOpen, onComments }: {
  item: any;
  saved: boolean;
  liked: boolean;
  likesCount: number;
  commentCount: number;
  likeBusyId: string | null;
  onLike: () => void;
  onSave: () => void;
  onCook: () => void;
  onOpen: () => void;
  onComments: () => void;
}) {
  const { t } = useTranslation();
  const rating = item.ratingCount ? Number(item.ratingAverage ?? 0).toFixed(1) : null;
  const diff = item.difficulty || 'medium';
  const dc = difficultyColor(diff);
  return (
    <GlassCard pad={0} radius={22} variant="solid">
      <Pressable onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <RecipeImage uri={item.imageUrl} thumbWidth={340} style={{ height: 140, width: '100%' }} />
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>{item.title}</Text>
              <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                {item.description || t('s.commFallbackDesc')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {diff ? (
              <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: dc.bg }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: dc.fg }}>{difficultyLabel(diff)}</Text>
              </View>
            ) : null}
            {item.cuisine ? (
              <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.accentSoft }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>{formatCuisine(item.cuisine)}</Text>
              </View>
            ) : null}
            {item.calories != null ? (
              <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surfaceMuted }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{item.calories} kcal</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <RowMeta icon={<Clock3 size={12} color={colors.textSecondary} />} text={`${(item.prepTime ?? 0) + (item.cookTime ?? 0)} min`} />
            <RowMeta icon={<Star size={12} color={colors.amber200} fill={colors.amber200} />} text={rating ? `${rating} (${item.ratingCount})` : 'New'} />
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onLike}
              disabled={likeBusyId === item._id}
              hitSlop={6}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: liked ? colors.roseBg : colors.surfaceMuted, opacity: pressed || likeBusyId === item._id ? 0.6 : 1 }]}
            >
              <Heart size={13} color={liked ? colors.rose : colors.textSecondary} fill={liked ? colors.rose : 'transparent'} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: liked ? colors.rose : colors.textSecondary }}>{likesCount || 0}</Text>
            </Pressable>
            <Pressable
              onPress={onComments}
              hitSlop={6}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
            >
              <MessageSquare size={13} color={colors.accent} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>{commentCount || 0}</Text>
            </Pressable>
            <CommunityReportButton shareId={item._id} />
          </View>
          {item.authorName ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              {t('s.commSharedBy', { name: item.authorName })}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <Pressable onPress={onCook} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingVertical: 9, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
          <Flame size={15} color={colors.darkButtonText} />
          <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13 }}>{t('s.commCookIt')}</Text>
        </Pressable>
        <Pressable onPress={onSave} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingVertical: 9, backgroundColor: saved ? colors.successBg : colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}>
          {saved ? <BookmarkCheck size={15} color={colors.success} /> : <Bookmark size={15} color={colors.textSecondary} />}
          <Text style={{ color: saved ? colors.success : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{saved ? t('s.commSavedShort') : t('s.commSave')}</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
          <Play size={14} color={colors.textPrimary} />
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{t('s.commOpen')}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function RowMeta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {icon}
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

