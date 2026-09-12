import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clock3, Filter, Search, Shuffle, SlidersHorizontal, X } from 'lucide-react-native';
import { useQuery } from '../lib/convex-auth';
import { api, runOp } from '../lib/api';
import { colors, fonts } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Chip, EmptyState, GlassCard, PageHeader, SearchField } from '../components/ui';
import { TutorialTarget } from '../components/TutorialTarget';
import { tutorialAction, useTutorialTarget } from '../lib/tutorial';
import { RecipeImage } from '../components/RecipeImage';
import { LibraryRecipe, asRecipeFromDoc, formatCuisine, formatDiet, difficultyLabel, translateSearchTerm, totalMinutes } from '../lib/recipe';
import { sortFilterValuesAZ } from '../lib/countries';
import { difficultyColor } from '../theme';
import { BookLoader } from '../components/BookLoader';
import { OfflineTv } from '../components/OfflineTv';
import { useConnectivity, retryConnectivity } from '../lib/offline';
import { useCachedList } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { seasonalTerms, pantryTerms } from '../lib/seasonal';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

/** Sort options - the label goes through i18n at render time (2.0.0). */
const SORTS: { value: 'title' | 'quick' | 'calories' | 'newest'; label: string; labelKey?: string }[] = [
  { value: 'title', label: 'A–Z' },
  { value: 'quick', label: 'Quickest', labelKey: 'library.sortQuick' },
  { value: 'calories', label: 'Lightest', labelKey: 'library.sortLight' },
  { value: 'newest', label: 'Newest', labelKey: 'library.sortNew' },
];

/** Prep time buckets for the grouped list (2.0.0). */
function timeBucket(minutes: number): number {
  if (minutes < 15) return 0;
  if (minutes <= 30) return 1;
  if (minutes <= 60) return 2;
  return 3;
}

/** Diet tag a profile diet/allergy maps to in the catalog (hard safety filter). */
const DIET_TAGS: Record<string, string> = { vegetarian: 'vegetarian', vegan: 'vegan', pescatarian: 'pescatarian', halal: 'halal', kosher: 'kosher', glutenFree: 'gluten-free', lactoseFree: 'dairy-free' };
const ALLERGY_TAGS: Record<string, string> = { nuts: 'nut-free', milk: 'dairy-free', gluten: 'gluten-free' };
/** Catalog meal types -> i18n keys (unknown values fall back to the raw value). */
const MEAL_LABEL_KEYS: Record<string, string> = {
  breakfast: 'library.breakfast', main: 'library.mainCourse', lunch: 'library.mainCourse',
  snack: 'library.snack', dessert: 'library.dessert', drink: 'library.drink',
};

export function LibraryScreen() {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  /** Card width = screen - page padding (2x18) - column gap (12), split in two. */
  const tileWidth = Math.floor((windowWidth - 36 - 12) / 2);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('all');
  const [mealType, setMealType] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [calories, setCalories] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [diets, setDiets] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* Tutorial targets: the tour highlights these elements and finishes the step
     only when the user really taps/typing them. */
  const filterTarget = useTutorialTarget('tut-library-filter', { onPress: () => setFiltersOpen(true) });
  const applyTarget = useTutorialTarget('tut-library-apply', { onPress: () => setFiltersOpen(false) });
  const [sort, setSort] = useState<'title' | 'quick' | 'calories' | 'newest' | 'match'>('title');
  // 2.0.0: "in season now" shelf and the "what can I cook?" matcher
  const [seasonal, setSeasonal] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [pantry, setPantry] = useState<string[]>([]);
  const [groupByTime, setGroupByTime] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  const profile = useQuery(api.users.currentUser) as any;
  const dietInit = useRef(false);

  /** The catalog search terms: seasonal produce or the user's pantry. */
  const terms = useMemo(() => (seasonal ? seasonalTerms() : pantry), [seasonal, pantry]);

  /**
   * 2.0.0 (55/56): the same search also runs over the user's own and saved
   * recipes - offline from the cached mirror, online fresh from the server.
   */
  const mineLive = useQuery(api.recipes.list) as any[] | undefined;
  const savedLive = useQuery(api.savedRecipes.list) as any[] | undefined;
  const { data: mineCache } = useCachedList<any>('mine', mineLive);
  const { data: savedCache } = useCachedList<any>('saved', savedLive);
  const localHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return { mine: [] as any[], saved: [] as any[] };
    const match = (r: any) =>
      `${r.title ?? ''} ${r.description ?? ''} ${(r.ingredients ?? []).join(' ')} ${(r.steps ?? []).join(' ')}`.toLowerCase().includes(q);
    return { mine: (mineCache ?? []).filter(match).slice(0, 6), saved: (savedCache ?? []).filter(match).slice(0, 6) };
  }, [search, mineCache, savedCache]);


  /** Catalog titles are English - map "Aubergine", "melanzane" … so
      the same recipes show up for every user language. */
  const translatedSearch = useMemo(() => translateSearchTerm(search), [search]);

  const FILTERS_KEY = 'spoonful:library-filters';
  const PRESETS_KEY = 'spoonful:library-presets';
  const filtersLoaded = useRef(false);
  const filtersRaw = useRef<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);

  // restore the last used filters/sorting
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(FILTERS_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        filtersRaw.current = raw;
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return;
        if (typeof s.search === 'string') setSearchInput(s.search);
        if (typeof s.cuisine === 'string') setCuisine(s.cuisine);
        if (typeof s.mealType === 'string') setMealType(s.mealType);
        if (typeof s.timeRange === 'string') setTimeRange(s.timeRange);
        if (typeof s.calories === 'string') setCalories(s.calories);
        if (typeof s.difficulty === 'string') setDifficulty(s.difficulty);
        if (Array.isArray(s.diets)) setDiets(s.diets.filter((d: unknown) => typeof d === 'string'));
        if (['title', 'quick', 'calories', 'newest'].includes(s.sort)) setSort(s.sort);
      })
      .catch(() => {})
      .finally(() => { if (alive) { filtersLoaded.current = true; setFiltersReady(true); } });
    return () => { alive = false; };
  }, []);

  // remember them for the next visit
  useEffect(() => {
    if (!filtersLoaded.current) return;
    const payload = JSON.stringify({ search: searchInput, cuisine, mealType, timeRange, calories, difficulty, diets, sort });
    AsyncStorage.setItem(FILTERS_KEY, payload).catch(() => {});
  }, [searchInput, cuisine, mealType, timeRange, calories, difficulty, diets, sort]);

  // 2.0.0: the onboarding answers (diet + allergies) pre-filter the library once.
  useEffect(() => {
    if (dietInit.current || !profile) return;
    if (!filtersReady) return; // wait until we know whether filters were saved
    dietInit.current = true;
    const saved = (() => { try { return JSON.parse(filtersRaw.current ?? 'null'); } catch { return null; } })();
    if (saved && Array.isArray(saved.diets) && saved.diets.length) return; // user already chose
    const fromProfile = [DIET_TAGS[profile.diet ?? ''] ?? '', ...((profile.allergies ?? []) as string[]).map((a) => ALLERGY_TAGS[a] ?? '')].filter(Boolean);
    if (fromProfile.length) setDiets(Array.from(new Set(fromProfile)));
  }, [profile, filtersReady]);

  // Saved filter combinations ("my filters").
  useEffect(() => {
    AsyncStorage.getItem(PRESETS_KEY)
      .then((raw) => {
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) setPresets(list);
      })
      .catch(() => {})
      .finally(() => setPresetsLoaded(true));
  }, []);

  const persistPresets = (list: any[]) => {
    setPresets(list);
    AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(list)).catch(() => {});
  };

  const currentFilterSet = () => ({ cuisine, mealType, timeRange, calories, difficulty, diets, sort: sort === 'match' ? 'title' : sort });

  const savePreset = () => {
    const set = currentFilterSet();
    const label = [cuisine !== 'all' ? cuisine : '', mealType !== 'all' ? mealType : '', timeRange !== 'all' ? timeRange : '', calories !== 'all' ? calories : '', difficulty !== 'all' ? difficulty : '', ...diets].filter(Boolean).join(' · ');
    persistPresets([{ id: Date.now(), label: label || t('feat.savePreset'), ...set }, ...presets].slice(0, 8));
  };

  const applyPreset = (p: any) => {
    setCuisine(p.cuisine ?? 'all');
    setMealType(p.mealType ?? 'all');
    setTimeRange(p.timeRange ?? 'all');
    setCalories(p.calories ?? 'all');
    setDifficulty(p.difficulty ?? 'all');
    setDiets(Array.isArray(p.diets) ? p.diets : []);
    setSort(p.sort ?? 'title');
  };

  // Typing must not fire a database request per keystroke (that was the main
  // reason the library felt laggy while searching).
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Pagination state: the first page is fetched reactively, further pages are
  // appended so the scroll position never jumps back to the top.
  const [items, setItems] = useState<LibraryRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const offsetRef = useRef(0);
  const signatureRef = useRef('');
  const itemsLenRef = useRef(0);
  const loadingRef = useRef(false);
  const listRef = useRef<any>(null);

  const meta = useQuery(api.recipes.libraryMeta);
  /**
   * 2.0.0 fix: one memoised request description for the current filter set.
   * It is used for the reactive first page *and* for "load more", and it doubles
   * as the token that tells us which response belongs to which filter set -
   * without it the list showed the recipes of the previous filter while the
   * counter already showed the new one.
   */
  const queryArgs = useMemo(
    () => ({
      search: translatedSearch,
      cuisine,
      diets,
      mealType,
      timeRange,
      calories,
      difficulty,
      sort: terms.length && sort === 'title' ? 'match' : sort,
      terms,
      minMatch: seasonal ? 1 : Math.max(1, Math.min(terms.length, 2)),
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [translatedSearch, cuisine, diets, mealType, timeRange, calories, difficulty, sort, terms, seasonal],
  );
  const queryKey = useMemo(() => JSON.stringify(queryArgs), [queryArgs]);

  const pageData = useQuery(api.recipes.libraryPage, { ...queryArgs, token: queryKey });

  const tracksItems = useCallback((updater: (prev: LibraryRecipe[]) => LibraryRecipe[]) => {
    setItems((prev) => {
      const next = updater(prev);
      itemsLenRef.current = next.length;
      return next;
    });
  }, []);

  /**
   * 2.0.0 fix: as soon as the filter set changes, drop the old tiles. Before
   * this the previous results stayed on screen while the new counter was
   * already there ("2 recipes" above ten tiles) - and because the query hook
   * keeps the last value while loading, that stale list was even written back
   * into the state.
   */
  useEffect(() => {
    signatureRef.current = '';
    itemsLenRef.current = 0;
    offsetRef.current = 0;
    loadingRef.current = false;
    setItems([]);
    setTotal(0);
    setHasMore(false);
    setLoadedOnce(false);
    setLoadingMore(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [queryKey]);

  useEffect(() => {
    if (!pageData) return;
    // Ignore responses that belong to an older filter set.
    if (pageData.token !== queryKey) return;

    // Any app event (mutation, foreground, refresh) re-fetches queries. For the
    // *same* filters that must not throw away the pages the user loaded
    // already - only the counters get refreshed.
    if (queryKey === signatureRef.current && itemsLenRef.current > 0) {
      setTotal(Number(pageData.total) || 0);
      setHasMore(!!pageData.hasMore);
      return;
    }

    const first = (pageData.items ?? []) as LibraryRecipe[];
    signatureRef.current = queryKey;
    offsetRef.current = first.length;
    itemsLenRef.current = first.length;
    setItems(first);
    setTotal(Number(pageData.total) || 0);
    setHasMore(!!pageData.hasMore);
    setLoadedOnce(true);
  }, [pageData, queryKey]);

  /** Appends the next 24 results - nothing else is re-fetched. */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const key = queryKey;
    try {
      const res = await runOp(api.recipes.libraryPage, 'query', null, {
        ...queryArgs,
        offset: offsetRef.current,
        token: key,
      });
      // The user changed a filter while this page was in flight: drop it.
      if (res?.token !== key) return;
      const more = (res?.items ?? []) as LibraryRecipe[];
      offsetRef.current += more.length;
      tracksItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      setTotal(Number(res?.total) || 0);
      setHasMore(!!res?.hasMore);
    } catch (e) {
      // Keep current list; user can retry via the button.
      console.warn('[spoonful] load more failed', e instanceof Error ? e.message : e);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, queryArgs, queryKey, tracksItems]);

  /** "Surprise me": jump straight into a random catalog recipe. */
  const surpriseMe = useCallback(async () => {
    try {
      const item = (await runOp(api.recipes.random, 'query', null, {})) as LibraryRecipe | null;
      if (!item?.id) return;
      navigate('RecipeDetail', { recipeId: item.id, title: item.title, source: 'library', recipe: item });
    } catch (e) {
      console.warn('[spoonful] random recipe failed', e instanceof Error ? e.message : e);
    }
  }, []);

  const dietTags: string[] = meta?.diets ?? [];

  const activeFilterCount =
    (cuisine !== 'all' ? 1 : 0) + (mealType !== 'all' ? 1 : 0) +
    (timeRange !== 'all' ? 1 : 0) + (calories !== 'all' ? 1 : 0) +
    (difficulty !== 'all' ? 1 : 0) + diets.length;

  const clearAll = () => {
    setCuisine('all'); setMealType('all'); setTimeRange('all');
    setCalories('all'); setDifficulty('all'); setDiets([]);
  };
  const toggleDiet = (d: string) =>
    setDiets((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const cuisineOptions = useMemo(
    /* 2.1.2: countries are sorted A→Z (Afghanistan … Zimbabwe) */
    () => sortFilterValuesAZ((meta?.cuisines as string[] | undefined) ?? []).map((c: string) => ({ value: c, label: formatCuisine(c) })),
    [meta],
  );
  /* Meal types come from the catalog, so no filter ends up with zero results
     (the old list offered "Drink", which no recipe in the catalog uses). */
  const mealTypeOptions = useMemo(() => {
    const live = ((meta?.mealTypes as string[] | undefined) ?? []).filter(Boolean);
    const values = live.length ? live : ['breakfast', 'main', 'snack', 'dessert'];
    return [
      { value: 'all', label: t('library.allTypes') },
      ...values.map((v) => ({ value: v, label: MEAL_LABEL_KEYS[v] ? t(MEAL_LABEL_KEYS[v]) : formatCuisine(v) })),
    ];
  }, [meta, t]);
  const timeOptions = [
    { value: 'all', label: t('library.anyTime') },
    { value: 'under15', label: t('library.under15') },
    { value: '15-30', label: `15–30 ${t('common.min')}` },
    { value: 'over30', label: `30+ ${t('common.min')}` },
  ];
  const calorieOptions = [
    { value: 'all', label: t('common.all') },
    { value: '0-400', label: `0–400 ${t('common.kcal')}` },
    { value: '400-700', label: `400–700 ${t('common.kcal')}` },
    { value: 'over700', label: `700+ ${t('common.kcal')}` },
  ];
  const difficultyOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'easy', label: t('recipe.easy') },
    { value: 'medium', label: t('recipe.medium') },
    { value: 'hard', label: t('recipe.hard') },
  ];

  const sortLabel = (value: typeof sort): string => {
    if (value === 'match') return t('feat.matchPercent');
    const found = SORTS.find((s) => s.value === value);
    if (!found) return value;
    return found.labelKey ? t(found.labelKey) : found.label;
  };

  /**
   * 2.0.0: every active filter is listed as a chip under the search field and
   * can be removed with one tap - nobody has to open the sheet to find out why
   * the library looks the way it does.
   */
  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  if (cuisine !== 'all') activeChips.push({ key: 'cuisine', label: formatCuisine(cuisine), remove: () => setCuisine('all') });
  if (mealType !== 'all') activeChips.push({ key: 'meal', label: mealTypeOptions.find((o) => o.value === mealType)?.label ?? formatCuisine(mealType), remove: () => setMealType('all') });
  if (timeRange !== 'all') activeChips.push({ key: 'time', label: timeOptions.find((o) => o.value === timeRange)?.label ?? timeRange, remove: () => setTimeRange('all') });
  if (calories !== 'all') activeChips.push({ key: 'kcal', label: calorieOptions.find((o) => o.value === calories)?.label ?? calories, remove: () => setCalories('all') });
  if (difficulty !== 'all') activeChips.push({ key: 'diff', label: difficultyOptions.find((o) => o.value === difficulty)?.label ?? difficultyLabel(difficulty), remove: () => setDifficulty('all') });
  diets.forEach((d) => activeChips.push({ key: `diet-${d}`, label: formatDiet(d), remove: () => toggleDiet(d) }));
  if (seasonal) activeChips.push({ key: 'seasonal', label: t('feat.inSeason'), remove: () => setSeasonal(false) });
  if (pantry.length) activeChips.push({ key: 'pantry', label: `${t('feat.whatCanICook')} · ${pantry.length}`, remove: () => setPantry([]) });
  if (sort !== 'title') activeChips.push({ key: 'sort', label: `${t('common.sort')}: ${sortLabel(sort)}`, remove: () => setSort('title') });

  const conn = useConnectivity();
  if (conn === 'offline') {
    return (
      <OfflineTv
        title="Recipe library"
        message="The library needs the internet. Everything you saved before is still available offline under My Recipes and Saved."
        onRetry={() => { void retryConnectivity(); }}
      />
    );
  }

  const openRecipe = useCallback((recipe: LibraryRecipe) => {
    navigate('RecipeDetail', { recipeId: recipe.id, title: recipe.title, source: 'library', recipe });
  }, []);

  const listHeader = (
    <>
      <PageHeader eyebrow={t('library.explore')} title={t('library.title')} subtitle={`${total || '…'} ${t('library.recipes')}`} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <TutorialTarget id="tut-library-search">
            <SearchField
              value={searchInput}
              onChangeText={(v) => {
                setSearchInput(v);
                tutorialAction('tut-library-search');
              }}
              placeholder={t('library.searchIngredients')}
            />
          </TutorialTarget>
        </View>
        <Pressable
          ref={filterTarget.ref as any}
          collapsable={false}
          onPress={filterTarget.onPress}
          style={({ pressed }) => [
            {
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
              backgroundColor: activeFilterCount > 0 ? colors.accent : colors.card,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <SlidersHorizontal size={17} color={activeFilterCount > 0 ? colors.accentText : colors.textSecondary} strokeWidth={2.2} />
          {activeFilterCount > 0 ? (
            <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accentText, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* 2.0.0: the active filters are visible and removable right here, so
          nobody has to open the sheet to understand the result list. */}
      {activeChips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ marginTop: 10 }}>
          {activeChips.map((c) => (
            <Pressable
              key={c.key}
              onPress={c.remove}
              accessibilityLabel={c.label}
              style={({ pressed }) => [
                {
                  flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
                  borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card,
                  paddingLeft: 12, paddingRight: 8, paddingVertical: 7, opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textPrimary }}>{c.label}</Text>
              <X size={13} color={colors.textSecondary} />
            </Pressable>
          ))}
          <Pressable
            onPress={clearAll}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.roseBg, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.rose }}>{t('library.clearFilters')}</Text>
          </Pressable>
        </ScrollView>
      ) : null}




      {localHits.mine.length || localHits.saved.length ? (
        <View style={{ marginTop: 10 }}>
          {[
            { label: t('feat.fromMine'), items: localHits.mine, source: 'mine' },
            { label: t('feat.fromSaved'), items: localHits.saved, source: 'saved' },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <View key={g.label} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textSecondary, marginBottom: 4 }}>
                  {g.label} ({g.items.length})
                </Text>
                {g.items.map((r: any) => (
                  <Pressable
                    key={String(r._id)}
                    onPress={() =>
                      navigate('RecipeDetail', {
                        recipeId: r.recipeKey ?? r._id,
                        title: r.title,
                        source: g.source,
                        recipe: asRecipeFromDoc(r),
                      })
                    }
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        backgroundColor: colors.card,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        marginBottom: 6,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Search size={14} color={colors.accent} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary, fontWeight: '600' }}>
                      {r.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
        </View>
      ) : null}
    </>
  );

  const listFooter = hasMore ? (
    <Pressable
      onPress={() => void loadMore()}
      disabled={loadingMore}
      style={({ pressed }) => [
        { marginTop: 16, borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: pressed ? colors.darkButtonPressed : colors.darkButton, flexDirection: 'row', justifyContent: 'center', gap: 8 },
        (pressed || loadingMore) && { opacity: 0.9 },
      ]}
    >
      {loadingMore ? <ActivityIndicator size="small" color={colors.darkButtonText} /> : null}
      <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 15 }}>
        {loadingMore ? t('common.loading') : `${t('library.loadMore')} (${Math.max(0, Math.min(PAGE_SIZE, total - items.length))})`}
      </Text>
    </Pressable>
  ) : (
    <View style={{ height: 4 }} />
  );

  return (
    <Page>
      {/* One virtualised list: only the tiles on screen are rendered, which is
          what makes a 500-recipe library scroll smoothly. */}
      <FlatList
        ref={listRef}
        key={groupByTime ? 'grouped' : 'grid'}
        data={items}
        numColumns={groupByTime ? 1 : 2}
        keyExtractor={(r) => r.id}
        columnWrapperStyle={groupByTime ? undefined : { gap: 12, alignItems: 'flex-start' }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loadedOnce ? (
            <BookLoader label="Cooking" />
          ) : (
            <EmptyState
              icon={<Filter size={24} color={colors.accent} strokeWidth={2} />}
              title={t('library.noMatch')}
              body={activeChips.length ? t('library.clearFilters') : undefined}
              action={
                activeChips.length ? (
                  <Pressable
                    onPress={clearAll}
                    style={({ pressed }) => [
                      { marginTop: 12, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{t('library.clearFilters')}</Text>
                  </Pressable>
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={listFooter}
        renderItem={({ item, index }) => (
          <View>
            {groupByTime && (index === 0 || timeBucket(totalMinutes(items[index - 1])) !== timeBucket(totalMinutes(item))) ? (
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textSecondary, marginTop: 10, marginBottom: 4 }}>
                {
                  [`< 15 ${t('common.min')}`, `15-30 ${t('common.min')}`, `30-60 ${t('common.min')}`, `> 60 ${t('common.min')}`][
                    timeBucket(totalMinutes(item))
                  ]
                }
              </Text>
            ) : null}
            {index === 0 ? (
              /* the first tile is the tour target for "tap a recipe" */
              <TutorialTarget id="tut-library-card" style={{ flex: 1 }}>
                <RecipeTile
                  recipe={item}
                  onOpen={(r) => {
                    tutorialAction('tut-library-card');
                    openRecipe(r);
                  }}
                  width={tileWidth}
                  single={groupByTime}
                />
              </TutorialTarget>
            ) : (
              <RecipeTile recipe={item} onOpen={openRecipe} width={tileWidth} single={groupByTime} />
            )}
          </View>
        )}
      />

      {/* Filters sheet */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlayStrong }}>
          <Pressable style={{ flex: 1 }} onPress={() => setFiltersOpen(false)} />
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '84%', paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder }} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 21, fontWeight: '700', color: colors.textPrimary }}>{t('library.filters')}</Text>
                  {/* 2.0.0: the result count updates live while filters are changed */}
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
                    {loadedOnce ? `${total} ${t('library.recipes')}` : t('common.loading')}
                  </Text>
                </View>
                <Pressable onPress={() => setFiltersOpen(false)} hitSlop={8}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <FilterSection title={t('library.filters')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {SORTS.map((s) => (
                    <Chip key={s.value} label={s.labelKey ? t(s.labelKey) : s.label} active={sort === s.value} onPress={() => setSort(s.value)} />
                  ))}
                  {terms.length ? (
                    <Chip label={t('feat.matchPercent')} active={sort === 'match'} onPress={() => setSort('match')} />
                  ) : null}
                  <Pressable
                    onPress={() => void surpriseMe()}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        backgroundColor: pressed ? colors.surfaceMuted : colors.card,
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                      },
                    ]}
                  >
                    <Shuffle size={14} color={colors.accent} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accent }}>Surprise me</Text>
                  </Pressable>
                </View>

                {/* discovery: in season now / what can I cook / group by time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Chip
                    label={t('feat.inSeason')}
                    active={seasonal}
                    onPress={() => {
                      setSeasonal((v) => !v);
                      setPantry([]);
                    }}
                  />
                  <Chip
                    label={t('feat.whatCanICook')}
                    active={pantryOpen}
                    onPress={() => {
                      setPantryOpen((v) => !v);
                      setSeasonal(false);
                      if (pantryOpen) setPantry([]);
                    }}
                  />
                  <Chip label={t('feat.groupByTime')} active={groupByTime} onPress={() => setGroupByTime((v) => !v)} />
                </View>

                {pantryOpen ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <TextInput
                        value={pantryInput}
                        onChangeText={setPantryInput}
                        placeholder={t('feat.pantryPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          backgroundColor: colors.card,
                          paddingHorizontal: 13,
                          paddingVertical: 11,
                          color: colors.textPrimary,
                        }}
                      />
                      <Pressable
                        onPress={() => setPantry(pantryTerms(pantryInput))}
                        style={({ pressed }) => [
                          { borderRadius: 14, backgroundColor: colors.darkButton, paddingHorizontal: 14, paddingVertical: 12, opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13 }}>{t('feat.findRecipes')}</Text>
                      </Pressable>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{t('feat.whatCanICookHint')}</Text>
                  </>
                ) : null}

                {/* my saved filters: tap = apply, long press = delete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Chip label={t('feat.savePreset')} active={false} onPress={savePreset} />
                  {presetsLoaded && presets.map((p) => (
                    <Chip
                      key={String(p.id)}
                      label={p.label}
                      active={false}
                      onPress={() => applyPreset(p)}
                      onLongPress={() =>
                        Alert.alert(t('feat.deletePreset'), p.label, [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: () => persistPresets(presets.filter((x) => x.id !== p.id)),
                          },
                        ])
                      }
                    />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title={t('library.cuisine')}>
                <TutorialTarget id="tut-library-chip">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                    {cuisineOptions.map((c) => (
                      <Chip
                        key={c.value}
                        label={c.label}
                        active={cuisine === c.value}
                        onPress={() => {
                          setCuisine(c.value === cuisine ? 'all' : c.value);
                          tutorialAction('tut-library-chip');
                        }}
                      />
                    ))}
                  </ScrollView>
                </TutorialTarget>
              </FilterSection>

              <FilterSection title={t('library.type')}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {mealTypeOptions.map((m) => (
                    <Chip key={m.value} label={m.label} active={mealType === m.value} onPress={() => setMealType(m.value === mealType ? 'all' : m.value)} />
                  ))}
                </ScrollView>
              </FilterSection>

              <FilterSection title="Total time">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {timeOptions.map((o) => (
                    <Chip key={o.value} label={o.label} active={timeRange === o.value} onPress={() => setTimeRange(o.value === timeRange ? 'all' : o.value)} />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title={t('library.calories')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {calorieOptions.map((o) => (
                    <Chip key={o.value} label={o.label} active={calories === o.value} onPress={() => setCalories(o.value === calories ? 'all' : o.value)} />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title={t('library.difficulty')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {difficultyOptions.map((o) => (
                    <Chip key={o.value} label={o.label} active={difficulty === o.value} onPress={() => setDifficulty(o.value === difficulty ? 'all' : o.value)} />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title={t('library.dietary')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {dietTags.map((d) => (
                    <Chip key={d} label={formatDiet(d)} active={diets.includes(d)} onPress={() => toggleDiet(d)} />
                  ))}
                </View>
              </FilterSection>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable onPress={clearAll} style={{ flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card }}>
                  <Text style={{ fontWeight: '700', color: colors.rose }}>{t('library.clearFilters')}</Text>
                </Pressable>
                <Pressable
                  ref={applyTarget.ref as any}
                  collapsable={false}
                  onPress={applyTarget.onPress}
                  style={{ flex: 2, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton }}
                >
                  <Text style={{ fontWeight: '700', color: colors.darkButtonText }}>
                    {total > 0 ? `${t('library.apply')} · ${total}` : t('library.apply')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Memoised tile: list re-renders (scroll, filters, counters) skip untouched cards. */
const RecipeTile = React.memo(function RecipeTile({
  recipe,
  onOpen,
  width,
  single,
}: {
  recipe: LibraryRecipe;
  onOpen: (recipe: LibraryRecipe) => void;
  /** Fixed card width - keeps every tile the same size and the grid edges flush. */
  width?: number;
  /** One column layout (grouped view). */
  single?: boolean;
}) {
  const diff = difficultyColor(recipe.difficulty);
  const cardWidth = single ? undefined : width;
  return (
    <Pressable
      onPress={() => onOpen(recipe)}
      style={({ pressed }) => [{ width: cardWidth ?? '100%' }, pressed && { opacity: 0.85 }]}
    >
      <GlassCard pad={0} radius={20} style={{ overflow: 'hidden', height: single ? undefined : 196 }}>
        <RecipeImage uri={recipe.imageUrl} style={{ height: single ? 150 : 106, width: '100%' }} />
        <View style={{ flex: 1, padding: 11, justifyContent: 'space-between' }}>
          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 }}>
            {recipe.title}
          </Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock3 size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {(Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0)} min
              </Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: diff.bg }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: diff.fg }}>{difficultyLabel(recipe.difficulty)}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.accent, fontWeight: '600', marginTop: 5 }}>
              {recipe.calories != null ? `${recipe.calories} kcal` : ' '}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
});

