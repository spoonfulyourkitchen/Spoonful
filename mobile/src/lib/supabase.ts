import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

/**
 * Spoonful → Supabase client (React Native edition).
 * Session persistence goes through AsyncStorage.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type { SupabaseClient, Session, User } from '@supabase/supabase-js';

/** Throws when there is no signed-in user. */
export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const msg = (e as any)?.message ?? (e as any)?.error_description ?? 'Unexpected error';
  return new Error(String(msg));
}

const now = () => Date.now();

/** Column <-> convex-style document helpers (camelCase + `_id`). */
export const ts = now;

export function mapRecipe(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    title: row.title ?? '',
    description: row.description ?? '',
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    prepTime: row.prep_time ?? 0,
    cookTime: row.cook_time ?? 0,
    cuisine: row.cuisine ?? '',
    dietaryRestrictions: row.dietary_restrictions ?? [],
    imageUrl: row.image_url ?? undefined,
    difficulty: row.difficulty ?? 'medium',
    calories: row.calories ?? undefined,
    protein: row.protein ?? undefined,
    carbs: row.carbs ?? undefined,
    fat: row.fat ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function mapSaved(row: any): any {
  if (!row) return row;
  const base = mapRecipe(row);
  return {
    ...base,
    recipeKey: row.recipe_key ?? row.id,
    notes: row.notes ?? '',
    favorite: row.favorite ?? true,
    collectionIds: row.collection_ids ?? [],
  };
}

export function mapLibrary(row: any): any {
  if (!row) return row;
  const base = mapRecipe(row);
  return {
    ...base,
    id: row.id,
    recipeKey: row.recipe_key ?? row.id,
    mealType: row.meal_type ?? undefined,
  };
}

export function mapUser(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    id: row.id,
    email: row.email ?? '',
    name: row.name ?? '',
    image: row.image ?? undefined,
    role: row.role ?? 'user',
    cookingExperience: row.cooking_experience ?? undefined,
    goal: row.goal ?? undefined,
    diet: row.diet ?? undefined,
    allergies: Array.isArray(row.allergies) ? row.allergies : [],
    region: row.region ?? undefined,
    onboardedAt: row.onboarded_at ?? undefined,
    waterGoalMl: row.water_goal_ml ?? undefined,
    householdId: row.household_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapShopping(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    name: row.name ?? '',
    recipeKey: row.recipe_key ?? undefined,
    recipeTitle: row.recipe_title ?? undefined,
    checked: row.checked ?? false,
    price: row.price ?? undefined,
    have: row.have ?? false,
    category: row.category ?? undefined,
    course: row.course ?? undefined,
    householdId: row.household_id ?? undefined,
    ownedBy: row.user_id ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

export function mapCalorie(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    recipeKey: row.recipe_key ?? undefined,
    title: row.title ?? '',
    calories: row.calories ?? 0,
    protein: row.protein ?? undefined,
    carbs: row.carbs ?? undefined,
    fat: row.fat ?? undefined,
    servings: row.servings ?? 1,
    source: row.source ?? 'recipe',
    eatenAt: row.eaten_at ?? Date.now(),
  };
}

export function mapCollection(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    name: row.name ?? '',
    createdAt: row.created_at ?? undefined,
  };
}

export function mapShared(row: any): any {
  if (!row) return row;
  const base = mapRecipe(row);
  return {
    ...base,
    id: row.id,
    _id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? undefined,
    sourceRecipeId: row.source_recipe_id ?? undefined,
    shareKey: row.share_key ?? '',
    status: row.status ?? 'pending',
    rejectionReason: row.rejection_reason ?? undefined,
    rejectionNote: row.rejection_note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    ratingAverage: row.rating_average ?? 0,
    rating: row.rating_count ? Math.round((row.rating_average ?? 0) * 10) / 10 : undefined,
    ratingCount: row.rating_count ?? 0,
    likesCount: row.likes_count ?? 0,
    likedByMe: row.liked_by_me ?? false,
  };
}

export function mapReport(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    user_id: row.user_id,
    recipeKey: row.recipe_key,
    recipeTitle: row.recipe_title ?? '',
    imageUrl: row.image_url ?? undefined,
    reason: row.reason ?? '',
    message: row.message ?? undefined,
    status: row.status ?? 'open',
    createdAt: row.created_at,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
  };
}

export function mapFeedback(row: any): any {
  if (!row) return row;
  return {
    _id: row.id,
    user_name: row.user_name,
    user_email: row.user_email,
    rating: row.rating,
    text: row.text ?? '',
    read: row.read ?? false,
    createdAt: row.created_at,
  };
}
