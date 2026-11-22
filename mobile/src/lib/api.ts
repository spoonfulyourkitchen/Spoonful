import { supabase, requireUserId, ts, mapRecipe, mapSaved, mapUser, mapShopping, mapCalorie, mapCollection, mapShared, mapReport, mapFeedback, mapLibrary } from './supabase';
import { aiGenerateRecipe, aiEstimateNutrition, aiImproveRecipe, aiSubstituteIngredient } from './ai';
import { translateRecipeContentOnline } from './recipe-translate';
import { ops, rowError, type Op } from './api-core';
import './api-community';
import './api-notices';

let shoppingHousehold: { id: string | null; at: number } | null = null;

function forgetShoppingHousehold() {
  shoppingHousehold = null;
}

async function shoppingHouseholdId(): Promise<string | null> {
  if (shoppingHousehold && Date.now() - shoppingHousehold.at < 15000) return shoppingHousehold.id;
  try {
    const uid = await requireUserId();
    const { data } = await supabase.from('users').select('household_id').eq('id', uid).maybeSingle();
    const id = String((data as any)?.household_id ?? '') || null;
    shoppingHousehold = { id, at: Date.now() };
    return id;
  } catch {
    return null;
  }
}

export type FnKind = 'query' | 'mutation' | 'action';
export type FnRef = { __spoonfulRef: true; key: string; kind: FnKind };

const R = (key: string, kind: FnKind): FnRef => ({ __spoonfulRef: true, key, kind });

export const SHARE_RETRY_WAIT_MS = 3 * 24 * 60 * 60 * 1000;

export const api = {
  recipes: {
    list: R('recipes.list', 'query'),
    create: R('recipes.create', 'mutation'),
    update: R('recipes.update', 'mutation'),
    remove: R('recipes.remove', 'mutation'),
    reportImage: R('recipes.reportImage', 'mutation'),
    libraryMeta: R('recipes.libraryMeta', 'query'),
    
    libraryCount: R('recipes.libraryCount', 'query'),
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
    create: R('collections.create', 'mutation'),
    update: R('collections.update', 'mutation'),
    remove: R('collections.remove', 'mutation'),
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
    profileRefreshDue: R('users.profileRefreshDue', 'query'),
    completeProfileRefresh: R('users.completeProfileRefresh', 'mutation'),
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
    commentCounts: R('sharing.commentCounts', 'query'),
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
  
  householdCooking: {
    state: R('householdCooking.state', 'query'),
    set: R('householdCooking.set', 'mutation'),
    stop: R('householdCooking.stop', 'mutation'),
  },
  announcement: {
    latest: R('announcement.latest', 'query'),
    list: R('announcement.list', 'query'),
    send: R('announcement.send', 'mutation'),
    deactivate: R('announcement.deactivate', 'mutation'),
  },
  
  updates: {
    latest: R('updates.latest', 'query'),
    status: R('updates.status', 'query'),
    list: R('updates.list', 'query'),
    post: R('updates.post', 'mutation'),
    deactivate: R('updates.deactivate', 'mutation'),
  },
};

export function isRef(v: any): v is FnRef {
  return !!v && v.__spoonfulRef === true;
}

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

ops['recipes.libraryCount'] = {
  async query() {
    try {
      

      const { data, error } = await supabase.rpc('library_count');
      if (error) throw error;
      const total = typeof data === 'number' ? data : Number(data ?? 0);
      if (Number.isFinite(total) && total > 0) return { total };
    } catch {}
    try {
      const { count, error } = await supabase
        .from('recipes')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return { total: count ?? 0 };
    } catch {
      
      return { total: 0 };
    }
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
      favorite: args.favorite ?? false,
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
ops['collections.create'] = {
  async mutation({ uid }, args: any) {
    const name = String(args?.name ?? '').trim().slice(0, 60);
    if (name.length < 2) throw new Error('Collection names must contain at least 2 characters.');
    const { data, error } = await supabase
      .from('collections').insert({ user_id: uid, name, created_at: ts() }).select().single();
    if (error) throw rowError(error);
    return mapCollection(data);
  },
};
ops['collections.update'] = {
  async mutation({ uid }, args: any) {
    const name = String(args?.name ?? '').trim().slice(0, 60);
    if (name.length < 2) throw new Error('Collection names must contain at least 2 characters.');
    const { data, error } = await supabase
      .from('collections').update({ name }).eq('id', args.id).eq('user_id', uid).select().single();
    if (error) throw rowError(error);
    return mapCollection(data);
  },
};
ops['collections.remove'] = {
  async mutation({ uid }, args: any) {
    const id = args.id;
    const { error } = await supabase.from('collections').delete().eq('id', id).eq('user_id', uid);
    if (error) throw rowError(error);
    return null;
  },
};

ops['shoppingList.list'] = {
  async query(_ctx) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw rowError(error);
    return (data ?? []).map(mapShopping);
  },
};

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

ops['shoppingList.setCheckedMany'] = {
  async mutation(_ctx, args: any) {
    const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
    if (!ids.length) return null;
    const { error } = await supabase.from('shopping_list_items').update({ checked: !!args.checked }).in('id', ids);
    if (error) throw rowError(error);
    return null;
  },
};

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
    forgetShoppingHousehold();
    const { data, error } = await supabase.rpc('create_household', { p_name: args?.name ?? 'My household' });
    forgetShoppingHousehold();
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
    forgetShoppingHousehold();
    const { data, error } = await supabase.rpc('join_household', { p_code: String(args?.code ?? '').trim() });
    forgetShoppingHousehold();
    if (error) throw rowError(error);
    return data;
  },
};
ops['household.leave'] = {
  async mutation() {
    forgetShoppingHousehold();
    const { error } = await supabase.rpc('leave_household');
    forgetShoppingHousehold();
    if (error) throw rowError(error);
    return null;
  },
};

function missingHouseholdCooking(error: any): boolean {
  const code = String((error as any)?.code ?? '');
  const text = `${(error as any)?.message ?? ''} ${(error as any)?.details ?? ''}`;
  return code === 'PGRST202' || code === '42P01' || code === '42883' || /could not find the function|schema cache|does not exist/i.test(text);
}

ops['householdCooking.state'] = {
  async query() {
    const { data, error } = await supabase.rpc('household_cooking_state');
    if (error) {
      if (missingHouseholdCooking(error)) return [];
      throw rowError(error);
    }
    return (Array.isArray(data) ? data : []).map((r: any) => ({
      userId: r.user_id,
      name: r.name ?? '',
      recipeKey: r.recipe_key ?? '',
      title: r.title ?? '',
      step: Number(r.step_index ?? 0),
      total: Number(r.step_total ?? 1),
      done: Number(r.done_steps ?? 0),
      at: new Date(r.updated_at ?? 0).getTime(),
    }));
  },
};

ops['householdCooking.set'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.rpc('set_cooking_state', {
      p_recipe_key: String(args?.recipeKey ?? ''),
      p_title: String(args?.title ?? ''),
      p_step: Number(args?.step ?? 0),
      p_total: Number(args?.total ?? 1),
      p_done: Number(args?.done ?? 0),
    });
    if (error) {
      if (missingHouseholdCooking(error) || /no household|sign in required/i.test(String(error.message ?? ''))) return null;
      throw rowError(error);
    }
    return null;
  },
};

ops['householdCooking.stop'] = {
  async mutation() {
    const { error } = await supabase.rpc('stop_cooking_state');
    if (error) {
      if (missingHouseholdCooking(error)) return null;
      throw rowError(error);
    }
    return null;
  },
};
ops['shoppingList.add'] = {
  async mutation({ uid }, args: any) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        user_id: uid,
        household_id: await shoppingHouseholdId(),
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
    const wanted = new Map<string, any>();
    for (const it of items) {
      const name = String(it?.name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!wanted.has(key)) wanted.set(key, { ...it, name });
    }
    if (!wanted.size) return [];
    let have = new Set<string>();
    try {
      const { data: existing } = await supabase.from('shopping_list_items').select('name').eq('checked', false);
      have = new Set((existing ?? []).map((r: any) => String(r?.name ?? '').trim().toLowerCase()));
    } catch {}
    const householdId = await shoppingHouseholdId();
    const rows = [...wanted.entries()]
      .filter(([key]) => !have.has(key))
      .map(([, it]: any) => ({
        user_id: uid,
        household_id: householdId,
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
    const cur = await supabase.from('shopping_list_items').select('checked').eq('id', args.id).maybeSingle();
    if (cur.error) throw rowError(cur.error);
    const next = !(cur.data?.checked ?? false);
    const { data, error } = await supabase
      .from('shopping_list_items').update({ checked: next }).eq('id', args.id).select().single();
    if (error) throw rowError(error);
    return mapShopping(data);
  },
};
ops['shoppingList.remove'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', args.id);
    if (error) throw rowError(error);
    return null;
  },
};
ops['shoppingList.clearChecked'] = {
  async mutation() {
    const { error } = await supabase.from('shopping_list_items').delete().eq('checked', true);
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
    const RETRY_WAIT_MS = SHARE_RETRY_WAIT_MS;
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

ops['media.generateUploadUrl'] = {
  async mutation() {
    throw new Error('Photo uploads are handled through Supabase Storage now (see lib/photo.ts).');
  },
};

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
      servings: Number(args.servings) > 0 ? Number(args.servings) : undefined,
    });
  },
};

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
  async mutation({ uid }, _args: any) {
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

export async function runPublicQuery(refOrKey: FnRef | string, args: any = {}): Promise<any> {
  const key = typeof refOrKey === 'string' ? refOrKey : refOrKey?.key;
  const op = key ? ops[key] : undefined;
  if (!op?.query) throw new Error(`Function ${key} is not a query`);
  return op.query({ uid: '' } as any, args ?? {});
}

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
    console.warn('[spoonful] unimplemented ops:', missing.join(', '));
  }
}

