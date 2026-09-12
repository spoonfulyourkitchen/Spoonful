import { supabase, requireUserId, toError, ts, mapRecipe, mapSaved, mapUser, mapShopping, mapCalorie, mapCollection, mapShared, mapReport, mapFeedback, mapLibrary } from './supabase';
import { aiGenerateRecipe, aiEstimateNutrition, aiImproveRecipe, aiSubstituteIngredient } from './ai';
import { translateRecipeContent, translateRecipeContentOnline } from './recipe-translate';

/**
 * Spoonful data layer — Convex-style API refs backed by Supabase.
 * Screens keep calling `useQuery(api.recipes.list)` / `useMutation(api.X.y)`
 * exactly like they did with Convex. Each leaf is a lightweight function
 * reference; the hooks in `convex-auth.tsx` resolve it against the operation
 * registry below.
 */

export type FnKind = 'query' | 'mutation' | 'action';
export type FnRef = { __spoonfulRef: true; key: string; kind: FnKind };

const R = (key: string, kind: FnKind): FnRef => ({ __spoonfulRef: true, key, kind });

/* ─── API namespace (mirrors the old convex/api surface used by the app) ─── */
export const api = {
  recipes: {
    list: R('recipes.list', 'query'),
    create: R('recipes.create', 'mutation'),
    update: R('recipes.update', 'mutation'),
    remove: R('recipes.remove', 'mutation'),
    reportImage: R('recipes.reportImage', 'mutation'),
    libraryMeta: R('recipes.libraryMeta', 'query'),
    libraryPage: R('recipes.libraryPage', 'query'),
    random: R('recipes.random', 'query'),
  },
  savedRecipes: {
    list: R('savedRecipes.list', 'query'),
    save: R('savedRecipes.save', 'mutation'),
    update: R('savedRecipes.update', 'mutation'),
    remove: R('savedRecipes.remove', 'mutation'),
  },
  collections: {
    list: R('collections.list', 'query'),
  },
  shoppingList: {
    list: R('shoppingList.list', 'query'),
    add: R('shoppingList.add', 'mutation'),
    addMany: R('shoppingList.addMany', 'mutation'),
    toggle: R('shoppingList.toggle', 'mutation'),
    update: R('shoppingList.update', 'mutation'),
    setCheckedMany: R('shoppingList.setCheckedMany', 'mutation'),
    remove: R('shoppingList.remove', 'mutation'),
    clearChecked: R('shoppingList.clearChecked', 'mutation'),
    clearAll: R('shoppingList.clearAll', 'mutation'),
  },
  calorieEntries: {
    list: R('calorieEntries.list', 'query'),
    log: R('calorieEntries.log', 'mutation'),
    logManual: R('calorieEntries.logManual', 'mutation'),
    remove: R('calorieEntries.remove', 'mutation'),
  },
  users: {
    currentUser: R('users.currentUser', 'query'),
    saveProfile: R('users.saveProfile', 'mutation'),
  },
  admin: {
    isAdmin: R('admin.isAdmin', 'query'),
    myRole: R('admin.myRole', 'query'),
    getAllUsers: R('admin.getAllUsers', 'query'),
    getAllFeedback: R('admin.getAllFeedback', 'query'),
    getImageReports: R('admin.getImageReports', 'query'),
    getAdminEmails: R('admin.getAdminEmails', 'query'),
    openReportCount: R('admin.openReportCount', 'query'),
    toggleAdmin: R('admin.toggleAdmin', 'mutation'),
    setRole: R('admin.setRole', 'mutation'),
    addAdminEmail: R('admin.addAdminEmail', 'mutation'),
    removeAdminEmail: R('admin.removeAdminEmail', 'mutation'),
    markFeedbackRead: R('admin.markFeedbackRead', 'mutation'),
    deleteFeedback: R('admin.deleteFeedback', 'mutation'),
    resolveImageReport: R('admin.resolveImageReport', 'mutation'),
    dismissImageReport: R('admin.dismissImageReport', 'mutation'),
  },
  sharing: {
    community: R('sharing.community', 'query'),
    feed: R('sharing.feed', 'query'),
    challenges: R('sharing.challenges', 'query'),
    createChallenge: R('sharing.createChallenge', 'mutation'),
    joinChallenge: R('sharing.joinChallenge', 'mutation'),
    reposts: R('sharing.reposts', 'query'),
    repost: R('sharing.repost', 'mutation'),
    unrepost: R('sharing.unrepost', 'mutation'),
    block: R('sharing.block', 'mutation'),
    unblock: R('sharing.unblock', 'mutation'),
    blocked: R('sharing.blocked', 'query'),
    myShares: R('sharing.myShares', 'query'),
    create: R('sharing.create', 'mutation'),
    removeShare: R('sharing.removeShare', 'mutation'),
    pendingShares: R('sharing.pendingShares', 'query'),
    reviewShare: R('sharing.reviewShare', 'mutation'),
    like: R('sharing.like', 'mutation'),
    unlike: R('sharing.unlike', 'mutation'),
    comments: R('sharing.comments', 'query'),
    addComment: R('sharing.addComment', 'mutation'),
    deleteComment: R('sharing.deleteComment', 'mutation'),
    resultPhotos: R('sharing.resultPhotos', 'query'),
    addResultPhoto: R('sharing.addResultPhoto', 'mutation'),
    report: R('sharing.report', 'mutation'),
    followedCooks: R('sharing.followedCooks', 'query'),
    follow: R('sharing.follow', 'mutation'),
    unfollow: R('sharing.unfollow', 'mutation'),
  },
  ai: {
    generateRecipe: R('ai.generateRecipe', 'action'),
    estimateNutrition: R('ai.estimateNutrition', 'action'),
    improveRecipe: R('ai.improveRecipe', 'action'),
    substituteIngredient: R('ai.substituteIngredient', 'action'),
  },
  media: {
    generateUploadUrl: R('media.generateUploadUrl', 'mutation'),
  },
  translate: {
    translateRecipe: R('translate.translateRecipe', 'action'),
    reportCorrection: R('translate.reportCorrection', 'mutation'),
  },
  feedback: {
    submit: R('feedback.submit', 'mutation'),
  },
  tracker: {
    weights: R('tracker.weights', 'query'),
    addWeight: R('tracker.addWeight', 'mutation'),
    waterToday: R('tracker.waterToday', 'query'),
    addWater: R('tracker.addWater', 'mutation'),
    removeWater: R('tracker.removeWater', 'mutation'),
  },
  account: {
    exportData: R('account.exportData', 'action'),
    deleteAccount: R('account.deleteAccount', 'mutation'),
  },
  household: {
    mine: R('household.mine', 'query'),
    create: R('household.create', 'mutation'),
    invite: R('household.invite', 'mutation'),
    join: R('household.join', 'mutation'),
    leave: R('household.leave', 'mutation'),
  },
  announcement: {
    latest: R('announcement.latest', 'query'),
    list: R('announcement.list', 'query'),
    send: R('announcement.send', 'mutation'),
    deactivate: R('announcement.deactivate', 'mutation'),
  },
  /** 2.1.4: version-gated "new update" notices (only older versions see them). */
  updates: {
    latest: R('updates.latest', 'query'),
    list: R('updates.list', 'query'),
    post: R('updates.post', 'mutation'),
    deactivate: R('updates.deactivate', 'mutation'),
  },
};

export function isRef(v: any): v is FnRef {
  return !!v && v.__spoonfulRef === true;
}

/* ─── Operation registry ─────────────────────────────────────────────────── */

type Op = {
  query?: (ctx: { uid: string }, args: any) => Promise<any>;
  mutation?: (ctx: { uid: string }, args: any) => Promise<any>;
  action?: (ctx: { uid: string }, args: any) => Promise<any>;
};

const ops: Record<string, Op> = {};

function rowError(e: any): Error {
  return toError(e);
}

/* ---------- recipes ---------- */
ops['recipes.list'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('user_recipes').select('*').eq('user_id', uid).order('updated_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapRecipe);
  },
};
ops['recipes.create'] = {
  async mutation({ uid }, args: any) {
    const t = ts();
    const { data, error } = await supabase
      .from('user_recipes')
      .insert({
        user_id: uid,
        title: args.title ?? '',
        description: args.description ?? '',
        ingredients: args.ingredients ?? [],
        steps: args.steps ?? [],
        prep_time: args.prepTime ?? 0,
        cook_time: args.cookTime ?? 0,
        cuisine: args.cuisine ?? '',
        dietary_restrictions: args.dietaryRestrictions ?? [],
        image_url: args.imageUrl ?? null,
        difficulty: args.difficulty ?? 'easy',
        calories: args.calories ?? null,
        protein: args.protein ?? null,
        carbs: args.carbs ?? null,
        fat: args.fat ?? null,
        created_at: t,
        updated_at: t,
      })
      .select()
      .single();
    if (error) throw rowError(error);
    return mapRecipe(data);
  },
};
ops['recipes.update'] = {
  async mutation({ uid }, args: any) {
    const patch: any = { updated_at: ts() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.ingredients !== undefined) patch.ingredients = args.ingredients;
    if (args.steps !== undefined) patch.steps = args.steps;
    if (args.prepTime !== undefined) patch.prep_time = args.prepTime;
    if (args.cookTime !== undefined) patch.cook_time = args.cookTime;
    if (args.cuisine !== undefined) patch.cuisine = args.cuisine;
    if (args.dietaryRestrictions !== undefined) patch.dietary_restrictions = args.dietaryRestrictions;
    if (args.imageUrl !== undefined) patch.image_url = args.imageUrl;
    if (args.difficulty !== undefined) patch.difficulty = args.difficulty;
    if (args.calories !== undefined) patch.calories = args.calories;
    if (args.protein !== undefined) patch.protein = args.protein;
    if (args.carbs !== undefined) patch.carbs = args.carbs;
    if (args.fat !== undefined) patch.fat = args.fat;
    const { data, error } = await supabase
      .from('user_recipes').update(patch).eq('id', args.id).eq('user_id', uid).select().single();
    if (error) throw rowError(error);
    return mapRecipe(data);
  },
};
ops['recipes.remove'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('user_recipes').delete().eq('id', args.id).eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};
ops['recipes.reportImage'] = {
  async mutation({ uid }, args: any) {
    const { data, error } = await supabase
      .from('image_reports')
      .insert({
        user_id: uid,
        recipe_key: args.recipeKey ?? '',
        recipe_title: args.recipeTitle ?? '',
        image_url: args.imageUrl ?? null,
        reason: args.reason ?? '',
        message: args.message ?? null,
        status: 'open',
        created_at: ts(),
      })
      .select()
      .single();
    if (error) throw rowError(error);
    return mapReport(data);
  },
};
ops['recipes.libraryMeta'] = {
  async query() {
    const { data, error } = await supabase.rpc('catalog_meta');
    if (error) throw rowError(error);
    const v: any = data;
    const obj = v && typeof v === 'object' && v.catalog_meta ? v.catalog_meta : v;
    return {
      diets: obj?.diets ?? [],
      cuisines: obj?.cuisines ?? [],
      mealTypes: obj?.mealTypes ?? [],
    };
  },
};
ops['recipes.libraryPage'] = {
  async query(_ctx, args: any) {
    const { data, error } = await supabase.rpc('catalog_page', {
      p: {
        search: args?.search ?? '',
        cuisine: args?.cuisine && args.cuisine !== 'all' ? args.cuisine : '',
        diets: args?.diets ?? [],
        mealType: args?.mealType && args.mealType !== 'all' ? args.mealType : '',
        timeRange: args?.timeRange && args.timeRange !== 'all' ? args.timeRange : '',
        calories: args?.calories && args.calories !== 'all' ? args.calories : '',
        difficulty: args?.difficulty && args.difficulty !== 'all' ? args.difficulty : '',
        limit: Math.max(1, Number(args?.limit ?? 24)),
        offset: Math.max(0, Number(args?.offset ?? 0)),
        sort: args?.sort && args.sort !== 'title' ? String(args.sort) : '',
        terms: Array.isArray(args?.terms) ? args.terms : [],
        minMatch: Math.max(1, Number(args?.minMatch ?? 1)),
      },
    });
    if (error) throw rowError(error);
    const v: any = data;
    const obj = v && typeof v === 'object' && v.catalog_page ? v.catalog_page : v;
    const items = (obj?.items ?? []).map(mapLibrary);
    return {
      items,
      total: obj?.total ?? items.length,
      hasMore: !!obj?.hasMore,
      offset: obj?.offset ?? 0,
      /**
       * 2.0.0 fix: the library screen sends a token that identifies the exact
       * filter set of the request and gets it back here. While a query is
       * loading the cache still holds the previous filter set, and applying
       * that data made the counter and the grid disagree (e.g. "2 recipes"
       * above ten tiles). With the token the screen simply ignores responses
       * that belong to an older filter set.
       */
      token: args?.token ?? null,
    };
  },
};
ops['recipes.random'] = {
  async query() {
    const { data, error } = await supabase.rpc('random_recipe');
    if (error) throw rowError(error);
    if (!data) return null;
    return mapLibrary(data);
  },
};

/* ---------- saved recipes / collections ---------- */
ops['savedRecipes.list'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('saved_recipes').select('*').eq('user_id', uid)
      .order('updated_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapSaved);
  },
};
ops['savedRecipes.save'] = {
  async mutation({ uid }, args: any) {
    const t = ts();
    const snapshot = {
      user_id: uid,
      recipe_key: args.recipeKey ?? '',
      title: args.title ?? '',
      description: args.description ?? '',
      ingredients: args.ingredients ?? [],
      steps: args.steps ?? [],
      prep_time: args.prepTime ?? 0,
      cook_time: args.cookTime ?? 0,
      cuisine: args.cuisine ?? '',
      dietary_restrictions: args.dietaryRestrictions ?? [],
      image_url: args.imageUrl ?? null,
      difficulty: args.difficulty ?? 'easy',
      calories: args.calories ?? null,
      protein: args.protein ?? null,
      carbs: args.carbs ?? null,
      fat: args.fat ?? null,
      notes: args.notes ?? '',
      favorite: args.favorite ?? true,
      collection_ids: args.collectionIds ?? [],
      updated_at: t,
    };
    const existing = await supabase
      .from('saved_recipes').select('id').eq('user_id', uid).eq('recipe_key', snapshot.recipe_key).maybeSingle();
    if (existing.error) throw rowError(existing.error);
    if (existing.data) {
      const { data, error } = await supabase
        .from('saved_recipes').update(snapshot).eq('id', existing.data.id).select().single();
      if (error) throw rowError(error);
      return mapSaved(data);
    }
    const { data, error } = await supabase
      .from('saved_recipes').insert({ ...snapshot, created_at: t }).select().single();
    if (error) throw rowError(error);
    return mapSaved(data);
  },
};
ops['savedRecipes.update'] = {
  async mutation({ uid }, args: any) {
    const patch: any = { updated_at: ts() };
    if (args.favorite !== undefined) patch.favorite = args.favorite;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.collectionIds !== undefined) patch.collection_ids = args.collectionIds;
    const { data, error } = await supabase
      .from('saved_recipes').update(patch).eq('id', args.id).eq('user_id', uid).select().single();
    if (error) throw rowError(error);
    return mapSaved(data);
  },
};
ops['savedRecipes.remove'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('saved_recipes').delete().eq('id', args.id).eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};
ops['collections.list'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('collections').select('*').eq('user_id', uid).order('created_at', { ascending: true });
    if (error) throw rowError(error);
    return (data ?? []).map(mapCollection);
  },
};

/* ---------- shopping list ---------- */
ops['shoppingList.list'] = {
  async query({ uid }) {
    // RLS returns the user's own items plus everything shared in the household.
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw rowError(error);
    return (data ?? []).map(mapShopping);
  },
};

/** 2.0.0: price, "have it at home", category and course can be edited inline. */
ops['shoppingList.update'] = {
  async mutation(_ctx, args: any) {
    const patch: any = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.price !== undefined) patch.price = args.price === null || args.price === '' ? null : Number(args.price);
    if (args.have !== undefined) patch.have = !!args.have;
    if (args.checked !== undefined) patch.checked = !!args.checked;
    if (args.category !== undefined) patch.category = args.category;
    if (args.course !== undefined) patch.course = args.course;
    if (!Object.keys(patch).length) return null;
    const { data, error } = await supabase.from('shopping_list_items').update(patch).eq('id', args.id).select().single();
    if (error) throw rowError(error);
    return mapShopping(data);
  },
};

/** Check off several items at once (shopping run mode). */
ops['shoppingList.setCheckedMany'] = {
  async mutation(_ctx, args: any) {
    const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
    if (!ids.length) return null;
    const { error } = await supabase.from('shopping_list_items').update({ checked: !!args.checked }).in('id', ids);
    if (error) throw rowError(error);
    return null;
  },
};

/* ---------- household (shared shopping list) ---------- */
ops['household.mine'] = {
  async query() {
    const { data, error } = await supabase.rpc('my_household');
    if (error) throw rowError(error);
    const v: any = data;
    return v && typeof v === 'object' && 'my_household' in v ? v.my_household : v;
  },
};
ops['household.create'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('create_household', { p_name: args?.name ?? 'My household' });
    if (error) throw rowError(error);
    return data;
  },
};
ops['household.invite'] = {
  async mutation() {
    const { data, error } = await supabase.rpc('make_household_invite');
    if (error) throw rowError(error);
    return data;
  },
};
ops['household.join'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('join_household', { p_code: String(args?.code ?? '').trim() });
    if (error) throw rowError(error);
    return data;
  },
};
ops['household.leave'] = {
  async mutation() {
    const { error } = await supabase.rpc('leave_household');
    if (error) throw rowError(error);
    return null;
  },
};
ops['shoppingList.add'] = {
  async mutation({ uid }, args: any) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        user_id: uid,
        name: args.name ?? '',
        recipe_key: args.recipeKey ?? null,
        recipe_title: args.recipeTitle ?? null,
        checked: false,
        created_at: ts(),
      })
      .select()
      .single();
    if (error) throw rowError(error);
    return mapShopping(data);
  },
};
ops['shoppingList.addMany'] = {
  async mutation({ uid }, args: any) {
    const items: any[] = Array.isArray(args.items) ? args.items : [];
    const t = ts();
    const rows = items.map((it) => ({
      user_id: uid,
      name: it?.name ?? '',
      recipe_key: it?.recipeKey ?? null,
      recipe_title: it?.recipeTitle ?? null,
      checked: false,
      created_at: t,
    }));
    if (!rows.length) return [];
    const { data, error } = await supabase.from('shopping_list_items').insert(rows).select();
    if (error) throw rowError(error);
    return (data ?? []).map(mapShopping);
  },
};
ops['shoppingList.toggle'] = {
  async mutation({ uid }, args: any) {
    const cur = await supabase.from('shopping_list_items').select('checked').eq('id', args.id).eq('user_id', uid).maybeSingle();
    if (cur.error) throw rowError(cur.error);
    const next = !(cur.data?.checked ?? false);
    const { data, error } = await supabase
      .from('shopping_list_items').update({ checked: next }).eq('id', args.id).eq('user_id', uid).select().single();
    if (error) throw rowError(error);
    return mapShopping(data);
  },
};
ops['shoppingList.remove'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', args.id).eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};
ops['shoppingList.clearChecked'] = {
  async mutation({ uid }) {
    const { error } = await supabase.from('shopping_list_items').delete().eq('user_id', uid).eq('checked', true);
    if (error) throw rowError(error);
    return null;
  },
};
ops['shoppingList.clearAll'] = {
  async mutation({ uid }) {
    const { error } = await supabase.from('shopping_list_items').delete().eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};
/* ---------- calorie entries ---------- */
ops['calorieEntries.list'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('calorie_entries').select('*').eq('user_id', uid).order('eaten_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapCalorie);
  },
};
ops['calorieEntries.log'] = {
  async mutation({ uid }, args: any) {
    return insertCalorie(uid, args, args.recipeKey ? 'recipe' : args.source ?? 'recipe');
  },
};
ops['calorieEntries.logManual'] = {
  async mutation({ uid }, args: any) {
    return insertCalorie(uid, args, args.source ?? 'manual');
  },
};
async function insertCalorie(uid: string, args: any, source: string) {
  const { data, error } = await supabase
    .from('calorie_entries')
    .insert({
      user_id: uid,
      recipe_key: args.recipeKey ?? null,
      title: args.title ?? 'Meal',
      calories: args.calories ?? 0,
      protein: args.protein ?? null,
      carbs: args.carbs ?? null,
      fat: args.fat ?? null,
      servings: args.servings ?? 1,
      source,
      eaten_at: args.eatenAt ?? ts(),
    })
    .select()
    .single();
  if (error) throw rowError(error);
  return mapCalorie(data);
}
ops['calorieEntries.remove'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('calorie_entries').delete().eq('id', args.id).eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};

/* ---------- users ---------- */
ops['users.currentUser'] = {
  async query({ uid }) {
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) throw rowError(error);
    return data ? mapUser(data) : null;
  },
};
ops['users.saveProfile'] = {
  async mutation({ uid }, args: any) {
    const patch: any = { updated_at: ts() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.cookingExperience !== undefined) patch.cooking_experience = args.cookingExperience;
    if (args.image !== undefined) patch.image = args.image;
    // onboarding profile (2.0.0)
    if (args.goal !== undefined) patch.goal = args.goal;
    if (args.diet !== undefined) patch.diet = args.diet;
    if (args.allergies !== undefined) patch.allergies = args.allergies ?? [];
    if (args.region !== undefined) patch.region = args.region;
    if (args.onboardedAt !== undefined) patch.onboarded_at = args.onboardedAt;
    if (args.waterGoalMl !== undefined) patch.water_goal_ml = args.waterGoalMl;
    const { data, error } = await supabase.from('users').update(patch).eq('id', uid).select().single();
    if (error) throw rowError(error);
    return data ? mapUser(data) : null;
  },
};
/* ---------- sharing / community ---------- */
ops['sharing.community'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('shared_recipes').select('*').eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw rowError(error);
    const rows: any[] = data ?? [];
    if (rows.length && uid) {
      const { data: likes, error: likeErr } = await supabase
        .from('recipe_likes').select('shared_recipe_id').eq('user_id', uid)
        .in('shared_recipe_id', rows.map((r) => r.id));
      if (likeErr) throw rowError(likeErr);
      const liked = new Set((likes ?? []).map((l: any) => l.shared_recipe_id));
      return rows.map((r: any) => {
        const d = mapShared(r);
        d.likedByMe = liked.has(r.id);
        return d;
      });
    }
    return rows.map(mapShared);
  },
};
ops['sharing.myShares'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('shared_recipes').select('*').eq('owner_id', uid).order('created_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapShared);
  },
};
/* ---------- community extras (2.0.0) ---------- */
ops['sharing.challenges'] = {
  async query() {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw rowError(error);
    const { data: entries } = await supabase.from('challenge_entries').select('*').limit(500);
    const list: any[] = data ?? [];
    const all: any[] = entries ?? [];
    return list.map((c) => ({
      _id: c.id,
      title: c.title,
      description: c.description ?? '',
      emoji: c.emoji ?? '',
      endsAt: c.ends_at ?? null,
      ownerId: c.owner_id ?? null,
      entries: all.filter((e) => e.challenge_id === c.id).length,
      maxEntries: 0,
    }));
  },
};
ops['sharing.createChallenge'] = {
  async mutation({ uid }, args: any) {
    const title = String(args?.title ?? '').trim().slice(0, 80);
    if (title.length < 3) throw new Error('Please give the challenge a title.');
    const { error } = await supabase.from('challenges').insert({
      title,
      description: String(args?.description ?? '').slice(0, 400),
      emoji: String(args?.emoji ?? '').slice(0, 4),
      owner_id: uid,
      starts_at: ts(),
      ends_at: args?.days ? ts() + Number(args.days) * 86400000 : null,
      created_at: ts(),
    });
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.joinChallenge'] = {
  async mutation({ uid }, args: any) {
    const name = String(args?.userName ?? '').slice(0, 60);
    const { error } = await supabase.from('challenge_entries').insert({
      challenge_id: String(args?.challengeId ?? ''),
      user_id: uid,
      user_name: name || null,
      note: String(args?.note ?? '').slice(0, 300) || null,
      image_url: args?.imageUrl ?? null,
      created_at: ts(),
    });
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.reposts'] = {
  async query() {
    const { data, error } = await supabase.from('recipe_reposts').select('*').limit(500);
    if (error) throw rowError(error);
    return (data ?? []).map((r: any) => ({
      _id: r.id,
      shareId: r.shared_recipe_id,
      userId: r.user_id,
      userName: r.user_name ?? '',
      note: r.note ?? '',
      createdAt: r.created_at,
    }));
  },
};
ops['sharing.repost'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('recipe_reposts').upsert(
      {
        shared_recipe_id: String(args?.shareId ?? ''),
        user_id: uid,
        user_name: String(args?.userName ?? '').slice(0, 60) || null,
        note: String(args?.note ?? '').slice(0, 200) || null,
        created_at: ts(),
      },
      { onConflict: 'shared_recipe_id,user_id' },
    );
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.unrepost'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase
      .from('recipe_reposts')
      .delete()
      .eq('user_id', uid)
      .eq('shared_recipe_id', String(args?.shareId ?? ''));
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.block'] = {
  async mutation({ uid }, args: any) {
    const blocked = String(args?.userId ?? '');
    if (!blocked || blocked === uid) return null;
    const { error } = await supabase
      .from('user_blocks')
      .upsert({ user_id: uid, blocked_id: blocked, created_at: ts() }, { onConflict: 'user_id,blocked_id' });
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.unblock'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('user_id', uid)
      .eq('blocked_id', String(args?.userId ?? ''));
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.blocked'] = {
  async query({ uid }) {
    const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('user_id', uid);
    if (error) throw rowError(error);
    return (data ?? []).map((r: any) => r.blocked_id);
  },
};
/** Community feed with server side sorting (newest / rating / likes / near me). */
ops['sharing.feed'] = {
  async query(_ctx, args: any) {
    const { data, error } = await supabase.rpc('community_page', {
      p: {
        sort: args?.sort ?? 'newest',
        region: args?.region ?? '',
        search: args?.search ?? '',
        limit: Math.max(1, Number(args?.limit ?? 20)),
        offset: Math.max(0, Number(args?.offset ?? 0)),
      },
    });
    if (error) throw rowError(error);
    const v: any = data;
    const obj = v && typeof v === 'object' && v.community_page ? v.community_page : v;
    return {
      items: (obj?.items ?? []).map((r: any) => ({
        _id: r.id,
        title: r.title ?? '',
        description: r.description ?? '',
        imageUrl: r.image_url ?? undefined,
        ownerId: r.owner_id ?? undefined,
        ownerName: r.owner_name ?? 'Spoonful cook',
        region: r.owner_region ?? '',
        ratingAverage: Number(r.rating_average ?? 0),
        ratingCount: Number(r.rating_count ?? 0),
        likesCount: Number(r.likes_count ?? 0),
        commentCount: Number(r.comment_count ?? 0),
        photoCount: Number(r.photo_count ?? 0),
        reviewCount: Number(r.review_count ?? 0),
        createdAt: r.created_at ?? null,
      })),
      total: Number(obj?.total ?? 0),
      hasMore: !!obj?.hasMore,
    };
  },
};

ops['sharing.create'] = {
  async mutation({ uid }, args: any) {
    const recipeId = args.recipeId ?? args.sourceRecipeId;
    if (!recipeId) throw new Error('Missing recipe');
    const { data: rec, error: recErr } = await supabase
      .from('user_recipes').select('*').eq('id', recipeId).eq('user_id', uid).maybeSingle();
    if (recErr) throw rowError(recErr);
    if (!rec) throw new Error('Recipe not found');

    const { data: me, error: meErr } = await supabase
      .from('users').select('name').eq('id', uid).maybeSingle();
    if (meErr) throw rowError(meErr);

    const existing = await supabase
      .from('shared_recipes').select('*').eq('owner_id', uid).eq('source_recipe_id', rec.id).maybeSingle();
    if (existing.error) throw rowError(existing.error);

    const now = ts();
    const RETRY_WAIT_MS = 3 * 24 * 60 * 60 * 1000;
    const shareKey = `sp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const baseRow: any = {
      owner_id: uid,
      owner_name: me?.name ?? null,
      source_recipe_id: rec.id,
      title: rec.title ?? '',
      description: rec.description ?? '',
      ingredients: rec.ingredients ?? [],
      steps: rec.steps ?? [],
      prep_time: rec.prep_time ?? 0,
      cook_time: rec.cook_time ?? 0,
      cuisine: rec.cuisine ?? '',
      dietary_restrictions: rec.dietary_restrictions ?? [],
      image_url: rec.image_url ?? null,
      difficulty: rec.difficulty ?? 'easy',
      calories: rec.calories ?? null,
      protein: rec.protein ?? null,
      carbs: rec.carbs ?? null,
      fat: rec.fat ?? null,
      rating_average: 0,
      rating_count: 0,
      updated_at: now,
    };

    if (existing.data) {
      const prev = existing.data;
      if (prev.status === 'pending') {
        throw new Error('Your recipe is already waiting for review.');
      }
      if (prev.status === 'approved') {
        throw new Error('This recipe is already in the community.');
      }
      // Previously rejected → enforce a cooldown before it can be submitted again.
      if (prev.reviewed_at && now - prev.reviewed_at < RETRY_WAIT_MS) {
        const wait = RETRY_WAIT_MS - (now - prev.reviewed_at);
        const days = Math.max(1, Math.ceil(wait / 86400000));
        throw new Error(`Your recipe was not approved yet. You can submit it again in about ${days} day${days > 1 ? 's' : ''}.`);
      }
      const { data, error } = await supabase
        .from('shared_recipes')
        .update({
          ...baseRow,
          share_key: shareKey,
          status: 'pending',
          rejection_reason: null,
          rejection_note: null,
          reviewed_at: null,
        })
        .eq('id', prev.id)
        .select()
        .single();
      if (error) throw rowError(error);
      return mapShared(data);
    }

    const { data, error } = await supabase
      .from('shared_recipes')
      .insert({ ...baseRow, share_key: shareKey, status: 'pending', created_at: now })
      .select()
      .single();
    if (error) throw rowError(error);
    return mapShared(data);
  },
};
ops['sharing.removeShare'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('shared_recipes').delete().eq('id', args.id).eq('owner_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};
ops['sharing.pendingShares'] = {
  async query() {
    const { data, error } = await supabase.rpc('admin_list_pending_shares');
    if (error) throw rowError(error);
    return (data ?? []).map(mapShared);
  },
};
ops['sharing.reviewShare'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('admin_review_share', {
      share_id: args.sharedRecipeId ?? args.shareId ?? args.id,
      approved: !!args.approve,
      reason: args.reason ?? null,
      note: args.note ?? null,
    });
    if (error) throw rowError(error);
    return data;
  },
};
/* ---------- likes ---------- */
ops['sharing.like'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('share_like', { target: args.shareId ?? args.id });
    if (error) throw rowError(error);
    return data;
  },
};
ops['sharing.unlike'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('share_unlike', { target: args.shareId ?? args.id });
    if (error) throw rowError(error);
    return data;
  },
};
/* ---------- admin ---------- */
async function rpcValue<T>(fn: string, params?: any): Promise<T> {
  const { data, error } = params ? await supabase.rpc(fn, params) : await supabase.rpc(fn);
  if (error) throw rowError(error);
  return data as T;
}

ops['admin.isAdmin'] = {
  async query() {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return false;
    const v: any = data;
    if (typeof v === 'boolean') return v;
    if (v && typeof (v as any).is_admin === 'boolean') return (v as any).is_admin;
    return !!v;
  },
};
ops['admin.getAllUsers'] = {
  async query() {
    try {
      const rows = await rpcValue<any[]>('admin_list_users');
      return (rows ?? []).map(mapUser);
    } catch (e) {
      // non-admins (mods) cannot list users
      console.warn('[spoonful] getAllUsers denied', e instanceof Error ? e.message : e);
      return [];
    }
  },
};
ops['admin.getAllFeedback'] = {
  async query() {
    const { data, error } = await supabase
      .from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapFeedback);
  },
};
ops['admin.getImageReports'] = {
  async query() {
    const { data, error } = await supabase
      .from('image_reports').select('*').order('created_at', { ascending: false });
    if (error) throw rowError(error);
    return (data ?? []).map(mapReport);
  },
};
ops['admin.myRole'] = {
  async query({ uid }) {
    const { data, error } = await supabase.from('users').select('role').eq('id', uid).maybeSingle();
    if (error) throw rowError(error);
    const role = data?.role;
    if (role === 'admin') return 'admin';
    if (role === 'mod') {
      // email-based admins are also admins even if their row says "user"
      const isAdm = await rpcValue<any>('is_admin');
      const v: any = isAdm;
      const admin = typeof v === 'boolean' ? v : !!(v && v.is_admin);
      return admin ? 'admin' : 'mod';
    }
    const isAdm2 = await rpcValue<any>('is_admin');
    const v2: any = isAdm2;
    const admin2 = typeof v2 === 'boolean' ? v2 : !!(v2 && v2.is_admin);
    return admin2 ? 'admin' : 'user';
  },
};
ops['admin.setRole'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('admin_set_role', {
      target_user_id: args.userId ?? args.id,
      new_role: args.role ?? 'mod',
    });
    if (error) throw rowError(error);
    return data;
  },
};
ops['admin.getAdminEmails'] = {
  async query() {
    const { data, error } = await supabase.from('admin_emails').select('email').order('email');
    if (error) throw rowError(error);
    return ((data ?? []) as any[]).map((r) => r.email);
  },
};
ops['admin.openReportCount'] = {
  async query() {
    const n = await rpcValue<any>('admin_open_report_count');
    const v: any = n;
    if (typeof v === 'number') return v;
    if (v && typeof (v as any).admin_open_report_count === 'number') return (v as any).admin_open_report_count;
    return 0;
  },
};
ops['admin.toggleAdmin'] = {
  async mutation(_ctx, args: any) {
    await rpcValue('admin_toggle_admin', { target_user_id: args.targetUserId ?? args.userId ?? args.id });
    return null;
  },
};
ops['admin.addAdminEmail'] = {
  async mutation(_ctx, args: any) {
    await rpcValue('admin_add_email', { email: args.email });
    return null;
  },
};
ops['admin.removeAdminEmail'] = {
  async mutation(_ctx, args: any) {
    await rpcValue('admin_remove_email', { email: args.email });
    return null;
  },
};
ops['admin.markFeedbackRead'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('feedback').update({ read: true }).eq('id', args.feedbackId);
    if (error) throw rowError(error);
    return null;
  },
};
ops['admin.deleteFeedback'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('feedback').delete().eq('id', args.feedbackId);
    if (error) throw rowError(error);
    return null;
  },
};
ops['admin.resolveImageReport'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('image_reports').update({ status: 'resolved' }).eq('id', args.reportId);
    if (error) throw rowError(error);
    return null;
  },
};
ops['admin.dismissImageReport'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('image_reports').update({ status: 'dismissed' }).eq('id', args.reportId);
    if (error) throw rowError(error);
    return null;
  },
};

/* ---------- media / image uploads ---------- */
ops['media.generateUploadUrl'] = {
  async mutation() {
    throw new Error('Photo uploads are handled through Supabase Storage now (see lib/photo.ts).');
  },
};
/* ---------- AI (OpenRouter) ---------- */
ops['ai.generateRecipe'] = {
  async action(_ctx, args: any) {
    return aiGenerateRecipe({
      availableIngredients: args.availableIngredients ?? '',
      dietaryPreferences: args.dietaryPreferences ?? '',
      prompt: args.prompt ?? '',
      experience: args.experience ?? '',
      goal: args.goal ?? '',
      diet: args.diet ?? '',
      allergies: args.allergies ?? [],
      servings: args.servings,
      cuisine: args.cuisine ?? '',
      maxMinutes: args.maxMinutes,
      difficulty: args.difficulty ?? '',
      spice: args.spice ?? '',
      lighter: !!args.lighter,
      kidFriendly: !!args.kidFriendly,
      equipment: args.equipment ?? '',
      avoidTitles: Array.isArray(args.avoidTitles) ? args.avoidTitles : [],
      explain: args.explain !== false,
      temperature: args.temperature,
    });
  },
};
ops['ai.improveRecipe'] = {
  async action(_ctx, args: any) {
    return aiImproveRecipe({
      title: String(args?.title ?? ''),
      ingredients: Array.isArray(args?.ingredients) ? args.ingredients : [],
      steps: Array.isArray(args?.steps) ? args.steps : [],
      goal: String(args?.goal ?? 'lighter and faster'),
      experience: args?.experience ?? '',
      allergies: args?.allergies ?? [],
    });
  },
};
ops['ai.substituteIngredient'] = {
  async action(_ctx, args: any) {
    return aiSubstituteIngredient({
      ingredient: String(args?.ingredient ?? ''),
      dish: args?.dish ? String(args.dish) : undefined,
      diet: args?.diet ?? '',
      allergies: args?.allergies ?? [],
    });
  },
};
ops['ai.estimateNutrition'] = {
  async action(_ctx, args: any) {
    return aiEstimateNutrition({
      title: args.title,
      ingredients: args.ingredients,
      steps: args.steps,
    });
  },
};

/* ---------- tracker: weight log ---------- */
/* ---------- water tracking (2.0.0) ---------- */
ops['tracker.waterToday'] = {
  async query({ uid }) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('water_logs')
      .select('*')
      .eq('user_id', uid)
      .gte('logged_at', start.getTime());
    if (error) throw rowError(error);
    const rows: any[] = data ?? [];
    return { totalMl: rows.reduce((sum, r) => sum + Number(r.ml ?? 0), 0), glasses: rows.length };
  },
};
ops['tracker.addWater'] = {
  async mutation({ uid }, args: any) {
    const ml = Math.max(50, Math.min(2000, Number(args?.ml ?? 250)));
    const { error } = await supabase.from('water_logs').insert({ user_id: uid, ml, logged_at: ts() });
    if (error) throw rowError(error);
    return null;
  },
};
ops['tracker.removeWater'] = {
  async mutation({ uid }, args: any) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('water_logs')
      .select('id')
      .eq('user_id', uid)
      .gte('logged_at', start.getTime())
      .order('logged_at', { ascending: false })
      .limit(1);
    if (error) throw rowError(error);
    const last = (data ?? [])[0]?.id;
    if (!last) return null;
    const del = await supabase.from('water_logs').delete().eq('id', last);
    if (del.error) throw rowError(del.error);
    return null;
  },
};

ops['tracker.weights'] = {
  async query({ uid }) {
    const { data, error } = await supabase
      .from('weight_logs').select('*').eq('user_id', uid)
      .order('logged_at', { ascending: false }).limit(60);
    if (error) throw rowError(error);
    return (data ?? []).map((r: any) => ({
      _id: r.id,
      weightKg: Number(r.weight_kg),
      loggedAt: r.logged_at,
    }));
  },
};
ops['tracker.addWeight'] = {
  async mutation({ uid }, args: any) {
    const weightKg = Number(args.weightKg);
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
      throw new Error('Enter a valid weight in kg.');
    }
    const at = Number(args.at ?? Date.now());
    const { data, error } = await supabase
      .from('weight_logs')
      .insert({ user_id: uid, weight_kg: weightKg, logged_at: at })
      .select()
      .single();
    if (error) throw rowError(error);
    return { _id: data.id, weightKg: Number(data.weight_kg), loggedAt: data.logged_at };
  },
};

/* ---------- recipe translation (no AI, server-cached) ---------- */
/** 2.0.0 (102): users can report a better translation for a specific recipe. */
ops['translate.reportCorrection'] = {
  async mutation({ uid }, args: any) {
    const { error } = await supabase.from('translation_corrections').insert({
      recipe_key: String(args?.recipeKey ?? ''),
      language: String(args?.language ?? 'en'),
      source_text: args?.source ?? null,
      suggestion: String(args?.suggestion ?? '').slice(0, 2000),
      user_id: uid,
      status: 'open',
      created_at: ts(),
    });
    if (error) throw rowError(error);
    return null;
  },
};
ops['translate.translateRecipe'] = {
  async action(_ctx, args: any) {
    const key = args.recipeKey ?? '';
    const lang = args.targetLanguage ?? 'en';
    if (!key || !lang || lang === 'en') return null;

    const { data: cached, error: readErr } = await supabase
      .from('recipe_translations').select('*').eq('recipe_key', key).eq('language', lang).maybeSingle();
    if (readErr) throw rowError(readErr);
    if (cached) {
      return {
        language: lang,
        title: cached.title ?? '',
        description: cached.description ?? undefined,
        ingredients: cached.ingredients ?? [],
        steps: cached.steps ?? [],
      };
    }

    const translated = await translateRecipeContentOnline(
      {
        title: args.title ?? '',
        description: args.description ?? '',
        ingredients: args.ingredients ?? [],
        steps: args.steps ?? [],
      },
      lang,
    );

    // Caching must never break the feature: if the write fails (offline,
    // RPC hiccup) the user still gets the translation right away.
    try {
      const { error: saveErr } = await supabase.rpc('save_translation', {
        p: {
          recipeKey: key,
          language: lang,
          title: translated.title,
          description: translated.description ?? '',
          ingredients: translated.ingredients,
          steps: translated.steps,
        },
      });
      if (saveErr) console.warn('[spoonful] translation cache failed', saveErr.message);
    } catch (e) {
      console.warn('[spoonful] translation cache failed', e instanceof Error ? e.message : e);
    }

    return { language: lang, ...translated };
  },
};

/* ---------- feedback (in-app) ---------- */
ops['feedback.submit'] = {
  async mutation({ uid }, args: any) {
    const rating = args.rating != null ? Number(args.rating) : null;
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: uid,
        user_name: args.name ?? null,
        user_email: args.email ?? null,
        rating,
        text: String(args.text ?? '').trim(),
        read: false,
        created_at: ts(),
      })
      .select()
      .single();
    if (error) throw rowError(error);
    return mapFeedback(data);
  },
};
/* ---------- community extras: comments, result photos, reports, follows ---------- */

function mapComment(row: any, uid: string | null) {
  return {
    _id: row.id,
    sharedRecipeId: row.shared_recipe_id,
    userId: row.user_id,
    userName: row.user_name ?? 'Spoonful cook',
    text: row.text,
    createdAt: row.created_at,
    mine: !!uid && row.user_id === uid,
  };
}

ops['sharing.comments'] = {
  async query({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    if (!id) return [];
    const { data, error } = await supabase
      .from('share_comments')
      .select('*')
      .eq('shared_recipe_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => mapComment(row, uid));
  },
};

/** Comment counts for the whole feed in one request (no N+1 round trips). */
ops['sharing.commentCounts'] = {
  async query() {
    const { data, error } = await supabase.from('share_comments').select('shared_recipe_id').limit(5000);
    if (error) throw rowError(error);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row: any) => {
      const key = String(row.shared_recipe_id);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  },
};

ops['sharing.addComment'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    const text = String(args?.text ?? '').trim();
    if (!id) throw new Error('Missing recipe.');
    if (!text) throw new Error('Please write something first.');
    if (text.length > 600) throw new Error('That comment is a bit too long (max 600 characters).');
    const { data, error } = await supabase
      .from('share_comments')
      .insert({ shared_recipe_id: id, user_id: uid, user_name: args?.userName ?? null, text, created_at: ts() })
      .select('*')
      .single();
    if (error) throw rowError(error);
    return mapComment(data, uid);
  },
};

ops['sharing.deleteComment'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.id ?? '');
    if (!id) throw new Error('Missing comment.');
    const { error } = await supabase.from('share_comments').delete().eq('id', id).eq('user_id', uid);
    if (error) throw rowError(error);
    return true;
  },
};

ops['sharing.resultPhotos'] = {
  async query(_ctx, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    if (!id) return [];
    const { data, error } = await supabase
      .from('share_photos')
      .select('*')
      .eq('shared_recipe_id', id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => ({
      _id: row.id,
      sharedRecipeId: row.shared_recipe_id,
      userName: row.user_name ?? 'Spoonful cook',
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }));
  },
};

ops['sharing.addResultPhoto'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    const url = String(args?.imageUrl ?? '');
    if (!id || !/^https?:\/\//i.test(url)) throw new Error('Could not attach that photo.');
    const { error } = await supabase
      .from('share_photos')
      .insert({ shared_recipe_id: id, user_id: uid, user_name: args?.userName ?? null, image_url: url, created_at: ts() });
    if (error) throw rowError(error);
    return true;
  },
};

const REPORT_REASONS = ['spam', 'offensive', 'wrong', 'other'];

ops['sharing.report'] = {
  async mutation({ uid }, args: any) {
    const targetType = String(args?.targetType ?? 'recipe');
    const targetId = String(args?.targetId ?? '');
    const reason = String(args?.reason ?? 'other');
    if (!targetId) throw new Error('Missing target.');
    if (!REPORT_REASONS.includes(reason)) throw new Error('Please pick a reason.');
    const { error } = await supabase
      .from('content_reports')
      .insert({
        target_type: targetType,
        target_id: targetId,
        reporter_id: uid,
        reason,
        note: args?.note ? String(args.note).slice(0, 500) : null,
        status: 'open',
        created_at: ts(),
      });
    // 23505 = already reported by this user
    if (error && (error as any).code !== '23505') throw rowError(error);
    return true;
  },
};

ops['sharing.followedCooks'] = {
  async query({ uid }) {
    const { data, error } = await supabase.from('cook_follows').select('following_id').eq('follower_id', uid).limit(500);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => String(row.following_id));
  },
};

ops['sharing.follow'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.userId ?? '');
    if (!id || id === uid) throw new Error('You cannot follow yourself.');
    const { error } = await supabase
      .from('cook_follows')
      .upsert({ follower_id: uid, following_id: id, created_at: ts() }, { onConflict: 'follower_id,following_id' });
    if (error) throw rowError(error);
    return true;
  },
};

ops['sharing.unfollow'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.userId ?? '');
    if (!id) throw new Error('Missing user.');
    const { error } = await supabase.from('cook_follows').delete().eq('follower_id', uid).eq('following_id', id);
    if (error) throw rowError(error);
    return true;
  },
};

/* ---------- admin broadcast (2.0.0): one popup for everyone ---------- */
ops['announcement.latest'] = {
  async query() {
    const { data, error } = await supabase.rpc('latest_announcement');
    if (error) throw rowError(error);
    const v: any = data;
    return v && typeof v === 'object' && 'latest_announcement' in v ? v.latest_announcement : v;
  },
};
ops['announcement.list'] = {
  async query() {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw rowError(error);
    return (data ?? []).map((r: any) => ({
      _id: r.id,
      title: r.title,
      body: r.body,
      active: !!r.active,
      createdAt: r.created_at,
    }));
  },
};
ops['announcement.send'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('send_announcement', {
      p_title: String(args?.title ?? '').trim(),
      p_body: String(args?.body ?? '').trim(),
    });
    if (error) throw rowError(error);
    return data;
  },
};
ops['announcement.deactivate'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('announcements').update({ active: false }).eq('id', args?.id);
    if (error) throw rowError(error);
    return null;
  },
};

/* ---------- 2.1.4: update notices (only users on an older version see them) ---------- */
ops['updates.latest'] = {
  async query(_ctx, args: any) {
    const clientVersion = String(args?.version ?? '0');
    const { data, error } = await supabase.rpc('latest_update_notice', { p_client_version: clientVersion });
    if (error) throw rowError(error);
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const row: any = rows[0];
    if (!row) return null;
    return {
      _id: row.id,
      version: row.version,
      title: row.title,
      body: row.body,
      url: row.release_url,
      createdAt: row.created_at,
    };
  },
};
ops['updates.list'] = {
  async query() {
    const { data, error } = await supabase.rpc('list_update_notices');
    if (error) throw rowError(error);
    return (Array.isArray(data) ? data : []).map((r: any) => ({
      _id: r.id,
      version: r.version,
      title: r.title,
      body: r.body,
      url: r.release_url,
      active: !!r.active,
      createdAt: r.created_at,
    }));
  },
};
ops['updates.post'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('post_update_notice', {
      p_version: String(args?.version ?? '').trim(),
      p_url: String(args?.url ?? '').trim(),
      p_title: String(args?.title ?? '').trim() || 'New update',
      p_body: String(args?.body ?? '').trim(),
    });
    if (error) throw rowError(error);
    return data;
  },
};
ops['updates.deactivate'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.rpc('deactivate_update_notice', { p_id: Number(args?.id) });
    if (error) throw rowError(error);
    return null;
  },
};

/* ---------- GDPR: export / delete my account ---------- */

ops['account.exportData'] = {
  async action() {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) throw rowError(error);
    return data ?? {};
  },
};

ops['account.deleteAccount'] = {
  async mutation() {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw rowError(error);
    return true;
  },
};

/* ─── Registry helpers used by the hooks in convex-auth.tsx ─────────────── */
export function getOp(refOrKey: FnRef | string): Op | undefined {
  const key = typeof refOrKey === 'string' ? refOrKey : refOrKey?.key;
  return ops[key];
}

export async function runOp(
  refOrKey: FnRef | string,
  kind: FnKind,
  uid: string | null,
  args: any,
): Promise<any> {
  const key = typeof refOrKey === 'string' ? refOrKey : refOrKey?.key;
  if (!key) throw new Error('Invalid function reference');
  const op = ops[key];
  if (!op) throw new Error(`Function not implemented: ${key}`);
  const fn = op[kind];
  if (!fn) throw new Error(`Function ${key} is not a ${kind}`);
  const ctx = { uid: uid ?? (await requireUserId()) };
  return fn(ctx, args ?? {});
}

/** Validate that every registered ref has a matching implementation. */
export function assertOpsRegistered() {
  const missing: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.__spoonfulRef === true) {
      const key = node.key as string;
      const op = ops[key];
      const fn = op ? (node.kind === 'action' ? op.action : node.kind === 'mutation' ? op.mutation : op.query) : undefined;
      if (!fn) missing.push(key);
      return;
    }
    for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(api);
  if (missing.length) {
    // Non-fatal — listed functions are simply not available in this build.
    console.warn('[spoonful] unimplemented ops:', missing.join(', '));
  }
}






