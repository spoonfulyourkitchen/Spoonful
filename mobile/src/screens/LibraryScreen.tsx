import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Clock3, Filter, Flag, Search, Shuffle, SlidersHorizontal, X } from 'lucide-react-native';
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

const ONBOARDING_LIBRARY_CUISINES: Record<string, string> = {
  cItalian: 'Italian', cAsian: 'Asian', cMexican: 'Mexican',
  cIndian: 'Indian', cMiddleEast: 'Middle Eastern', cFrench: 'French',
};
import { sortFilterValuesAZ } from '../lib/countries';
import { difficultyColor } from '../theme';
import { BookLoader } from '../components/BookLoader';
import { ErrorState } from '../components/ErrorState';
import { OfflineTv } from '../components/OfflineTv';
import { useConnectivity, retryConnectivity } from '../lib/offline';
import { useCachedList } from '../lib/offline';
import { useTranslation, translate } from '../lib/i18n';
import { useAdminQuickReport } from '../lib/app-prefs';
import { useLocalPrefs } from '../lib/local-prefs';
import { difficultyForSkill, skillLevel } from '../lib/skill';
import { seasonalTerms, pantryTerms } from '../lib/seasonal';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const SORTS: { value: 'title' | 'quick' | 'calories' | 'newest'; label: string; labelKey?: string }[] = [
  { value: 'title', label: 'A–Z' },
  { value: 'quick', label: 'Quickest', labelKey: 'library.sortQuick' },
  { value: 'calories', label: 'Lightest', labelKey: 'library.sortLight' },
  { value: 'newest', label: 'Newest', labelKey: 'library.sortNew' },
];

function timeBucket(minutes: number): number {
  if (minutes < 15) return 0;
  if (minutes <= 30) return 1;
  if (minutes <= 60) return 2;
  return 3;
}

const DIET_TAGS: Record<string, string> = { vegetarian: 'vegetarian', vegan: 'vegan', pescatarian: 'pescatarian', halal: 'halal', kosher: 'kosher', glutenFree: 'gluten-free', lactoseFree: 'dairy-free' };
const ALLERGY_TAGS: Record<string, string> = { nuts: 'nut-free', milk: 'dairy-free', gluten: 'gluten-free' };

const MEAL_LABEL_KEYS: Record<string, string> = {
  breakfast: 'library.breakfast', main: 'library.mainCourse', lunch: 'library.mainCourse',
  snack: 'library.snack', dessert: 'library.dessert', drink: 'library.drink',
};

export function LibraryScreen() {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  
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
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [cuisineQuery, setCuisineQuery] = useState('');
  

  const filterTarget = useTutorialTarget('tut-library-filter', { onPress: () => setFiltersOpen(true) });
  const applyTarget = useTutorialTarget('tut-library-apply', { onPress: () => setFiltersOpen(false) });
  const [sort, setSort] = useState<'title' | 'quick' | 'calories' | 'newest' | 'match'>('title');
  const [seasonal, setSeasonal] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [pantry, setPantry] = useState<string[]>([]);
  const [groupByTime, setGroupByTime] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  const profile = useQuery(api.users.currentUser) as any;
  const localPrefs = useLocalPrefs();
  
  const isAdmin = useQuery(api.admin.isAdmin) === true;
  const [quickReportPref] = useAdminQuickReport();
  const quickReport = isAdmin && quickReportPref;
  const [reportNote, setReportNote] = useState<string | null>(null);
  const dietInit = useRef(false);

  
  const terms = useMemo(() => (seasonal ? seasonalTerms() : pantry), [seasonal, pantry]);

  

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

  

  const translatedSearch = useMemo(() => translateSearchTerm(search), [search]);

  const FILTERS_KEY = 'spoonful:library-filters';
  const LIB_PAGE_CACHE = 'spoonful:library-page:';
  const PRESETS_KEY = 'spoonful:library-presets';
  const filtersLoaded = useRef(false);
  const filtersRaw = useRef<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);

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

  useEffect(() => {
    if (!filtersLoaded.current) return;
    const payload = JSON.stringify({ search: searchInput, cuisine, mealType, timeRange, calories, difficulty, diets, sort });
    AsyncStorage.setItem(FILTERS_KEY, payload).catch(() => {});
  }, [searchInput, cuisine, mealType, timeRange, calories, difficulty, diets, sort]);

  useEffect(() => {
    if (dietInit.current || !profile) return;
    if (!filtersReady) return;
    dietInit.current = true;
    const saved = (() => { try { return JSON.parse(filtersRaw.current ?? 'null'); } catch { return null; } })();
    const diet = profile.diet || localPrefs.diet || '';
    const allergies = (profile.allergies?.length ? profile.allergies : localPrefs.allergies) ?? [];
    const fromProfile = [DIET_TAGS[diet] ?? '', ...allergies.map((a: string) => ALLERGY_TAGS[a] ?? '')].filter(Boolean);
    if ((!saved || !Array.isArray(saved.diets) || !saved.diets.length) && fromProfile.length) {
      setDiets(Array.from(new Set(fromProfile)));
    }
    if (!saved || !saved.difficulty) {
      const level = skillLevel(profile.cookingExperience || localPrefs.experience, localPrefs.startedAt);
      setDifficulty(difficultyForSkill(level));
    }
    if (!saved || !saved.timeRange) {
      const minutes = Number(localPrefs.cookTime ?? 0);
      if (minutes > 0) setTimeRange(minutes <= 15 ? 'under15' : minutes <= 30 ? '15-30' : 'over30');
    }
    if (!saved || !saved.cuisine || saved.cuisine === 'all') {
      const mapped = (localPrefs.cuisines ?? []).map((key: string) => ONBOARDING_LIBRARY_CUISINES[key]).filter(Boolean);
      if (mapped.length) setCuisine(mapped[0]);
    }
  }, [profile, localPrefs, filtersReady]);

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

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const [items, setItems] = useState<LibraryRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const offsetRef = useRef(0);
  const signatureRef = useRef('');
  const itemsLenRef = useRef(0);
  const loadingRef = useRef(false);
  const listRef = useRef<any>(null);

  const meta = useQuery(api.recipes.libraryMeta);
  

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

  

  const [loadPct, setLoadPct] = useState(0);
  useEffect(() => {
    if (loadedOnce) {
      setLoadPct(1);
      return;
    }
    setLoadPct(0.04);
    const started = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const eased = 1 - Math.exp(-elapsed / 2.2);
      setLoadPct(Math.min(0.93, Math.max(0.04, eased)));
    }, 140);
    return () => clearInterval(id);
  }, [loadedOnce, queryKey]);

  useEffect(() => {
    if (!pageData) return;
    if (pageData.token !== queryKey) return;

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
    if (first.length) {
      AsyncStorage.setItem(
        LIB_PAGE_CACHE + queryKey,
        JSON.stringify({ items: first.slice(0, 40), total: pageData.total, hasMore: pageData.hasMore, at: Date.now() }),
      ).catch(() => {});
    }
  }, [pageData, queryKey]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LIB_PAGE_CACHE + queryKey)
      .then((raw) => {
        if (!alive || !raw || itemsLenRef.current > 0) return;
        const cached = JSON.parse(raw);
        if (!Array.isArray(cached?.items) || !cached.items.length) return;
        signatureRef.current = queryKey;
        offsetRef.current = cached.items.length;
        itemsLenRef.current = cached.items.length;
        setItems(cached.items);
        setTotal(Number(cached.total) || cached.items.length);
        setHasMore(!!cached.hasMore);
        setLoadedOnce(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [queryKey]);

  
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
      if (res?.token !== key) return;
      const more = (res?.items ?? []) as LibraryRecipe[];
      offsetRef.current += more.length;
      tracksItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      setTotal(Number(res?.total) || 0);
      setHasMore(!!res?.hasMore);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, queryArgs, queryKey, tracksItems]);

  
  const surpriseMe = useCallback(async () => {
    try {
      const item = (await runOp(api.recipes.random, 'query', null, {})) as LibraryRecipe | null;
      if (!item?.id) return;
      navigate('RecipeDetail', { recipeId: item.id, title: item.title, source: 'library', recipe: item });
    } catch {
      setLoadError(true);
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
    setSort('title');
  };
  const toggleDiet = (d: string) =>
    setDiets((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const orderedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const ai = a.imageUrl ? 0 : 1;
      const bi = b.imageUrl ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return String(a.title ?? '').localeCompare(String(b.title ?? ''));
    });
    return list;
  }, [items]);

  const cuisineOptions = useMemo(
    
    () => sortFilterValuesAZ((meta?.cuisines as string[] | undefined) ?? []).map((c: string) => ({ value: c, label: formatCuisine(c) })),
    [meta],
  );
  

  const cuisineMatches = useMemo(() => {
    const q = cuisineQuery.trim().toLowerCase();
    const list = cuisineOptions;
    return q ? list.filter((c: any) => c.label.toLowerCase().includes(q)) : list;
  }, [cuisineOptions, cuisineQuery]);

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
  

  const openRecipe = useCallback((recipe: LibraryRecipe) => {
    navigate('RecipeDetail', { recipeId: recipe.id, title: recipe.title, source: 'library', recipe });
  }, []);

  

  const quickReportImage = useCallback(
    async (recipe: LibraryRecipe) => {
      try {
        await runOp(api.recipes.reportImage, 'mutation', null, {
          recipeKey: recipe.id,
          recipeTitle: recipe.title,
          imageUrl: recipe.imageUrl,
          reason: 'Wrong photo',
        });
        setReportNote(t('s.qrReported', { title: recipe.title }));
      } catch {
        setReportNote(t('s.qrReportFailed'));
      }
    },
    [t],
  );

  if (conn === 'offline') {
    return (
      <OfflineTv
        title={t('s.xOfflineLibraryTitle')}
        message={t('s.xOfflineLibraryBody')}
        onRetry={() => { void retryConnectivity(); }}
      />
    );
  }

  const listHeader = (
    <>
      <PageHeader eyebrow={t('library.explore')} title={t('library.title')} subtitle={`${total || '…'} ${t('library.recipes')}`} />

      {reportNote ? (
        <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.accent }}>{reportNote}</Text>
        </View>
      ) : null}
      {quickReport ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Flag size={13} color={colors.rose} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.rose }}>{t('s.qrModeBadge')}</Text>
        </View>
      ) : null}

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

      {
}
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

  const listFooter = loadError ? (
    <ErrorState compact onRetry={() => { setLoadError(false); void loadMore(); }} />
  ) : hasMore ? (
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
      {
}
      <FlatList
        ref={listRef}
        key={groupByTime ? 'grouped' : 'grid'}
        data={orderedItems}
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
            <BookLoader label={t('s.loadCooking')} progress={loadPct} />
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
            {groupByTime && (index === 0 || timeBucket(totalMinutes(orderedItems[index - 1])) !== timeBucket(totalMinutes(item))) ? (
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textSecondary, marginTop: 10, marginBottom: 4 }}>
                {
                  [`< 15 ${t('common.min')}`, `15-30 ${t('common.min')}`, `30-60 ${t('common.min')}`, `> 60 ${t('common.min')}`][
                    timeBucket(totalMinutes(item))
                  ]
                }
              </Text>
            ) : null}
            {index === 0 ? (
              
              <TutorialTarget id="tut-library-card" style={{ flex: 1 }}>
                <RecipeTile
                  recipe={item}
                  quickReport={quickReport}
                  onReport={quickReportImage}
                  onOpen={(r) => {
                    tutorialAction('tut-library-card');
                    openRecipe(r);
                  }}
                  width={tileWidth}
                  single={groupByTime}
                />
              </TutorialTarget>
            ) : (
              <RecipeTile
                recipe={item}
                quickReport={quickReport}
                onReport={quickReportImage}
                onOpen={openRecipe}
                width={tileWidth}
                single={groupByTime}
              />
            )}
          </View>
        )}
      />

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.overlayStrong }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 24 }}>
            <Pressable style={{ flex: 1 }} onPress={() => setFiltersOpen(false)} />
            <View style={{ backgroundColor: colors.bg, borderRadius: 24, maxHeight: '86%' }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 21, fontWeight: '700', color: colors.textPrimary }}>{t('library.filters')}</Text>
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accent }}>{t('s.xSurpriseMe')}</Text>
                    </Pressable>
                  </View>

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
                  <Pressable
                    onPress={() => { setCuisineQuery(''); setCuisineOpen(true); tutorialAction('tut-library-chip'); }}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                      borderRadius: 999, borderWidth: 1, borderColor: cuisine === 'all' ? colors.cardBorder : colors.accent,
                      backgroundColor: cuisine === 'all' ? colors.card : colors.accentSoft,
                      paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: cuisine === 'all' ? colors.textPrimary : colors.accent }}>
                      {cuisine === 'all' ? t('library.allCuisines') : formatCuisine(cuisine)}
                    </Text>
                    <X size={13} color={cuisine === 'all' ? colors.textSecondary : colors.accent} />
                  </Pressable>
                </FilterSection>

                <FilterSection title={t('library.type')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                    {mealTypeOptions.map((m) => (
                      <Chip key={m.value} label={m.label} active={mealType === m.value} onPress={() => setMealType(m.value === mealType ? 'all' : m.value)} />
                    ))}
                  </ScrollView>
                </FilterSection>

                <FilterSection title={t('s.xTotalTime')}>
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
        </KeyboardAvoidingView></Modal>
      <Modal visible={cuisineOpen} transparent animationType="fade" onRequestClose={() => setCuisineOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 24 }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCuisineOpen(false)} />
          <View style={{ backgroundColor: colors.bg, borderRadius: 24, maxHeight: '78%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16 }}>
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.textPrimary }}>{t('library.cuisine')}</Text>
              <Pressable onPress={() => setCuisineOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 12, borderRadius: 12, backgroundColor: colors.surfaceMuted, paddingHorizontal: 12 }}>
              <Search size={15} color={colors.textSecondary} />
              <TextInput
                value={cuisineQuery}
                onChangeText={setCuisineQuery}
                placeholder={t('library.searchIngredients')}
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                style={{ flex: 1, paddingVertical: 11, fontSize: 14, color: colors.textPrimary }}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 }}>
              <Pressable
                onPress={() => { setCuisine('all'); setCuisineOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{t('library.allCuisines')}</Text>
                {cuisine === 'all' ? <Check size={16} color={colors.accent} /> : null}
              </Pressable>
              {cuisineMatches.map((c: any) => (
                <Pressable
                  key={c.value}
                  onPress={() => { setCuisine(c.value); setCuisineOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
                >
                  <Text style={{ fontSize: 14, color: colors.textPrimary }}>{c.label}</Text>
                  {cuisine === c.value ? <Check size={16} color={colors.accent} /> : null}
                </Pressable>
              ))}
              {!cuisineMatches.length ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, paddingVertical: 14 }}>{t('x.noResults')}</Text>
              ) : null}
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

const RecipeTile = React.memo(function RecipeTile({
  recipe,
  onOpen,
  width,
  single,
  quickReport,
  onReport,
}: {
  recipe: LibraryRecipe;
  onOpen: (recipe: LibraryRecipe) => void;
  
  width?: number;
  
  single?: boolean;
  
  quickReport?: boolean;
  onReport?: (recipe: LibraryRecipe) => void;
}) {
  const diff = difficultyColor(recipe.difficulty);
  const cardWidth = single ? undefined : width;
  return (
    <Pressable
      onPress={() => (quickReport ? onReport?.(recipe) : onOpen(recipe))}
      accessibilityLabel={quickReport ? translate('s.qrA11y') : undefined}
      style={({ pressed }) => [{ width: cardWidth ?? '100%' }, pressed && { opacity: 0.85 }]}
    >
      <GlassCard pad={0} radius={20} style={{ overflow: 'hidden', height: single ? undefined : 196 }}>
        <RecipeImage uri={recipe.imageUrl} thumbWidth={single ? 420 : 260} style={{ height: single ? 150 : 106, width: '100%' }} />
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

