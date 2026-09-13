/**
 * Central config for the Spoonful mobile app.
 *
 * The backend credentials (Supabase URL + publishable key and the OpenRouter
 * key) are NOT stored in this repository. They live in `config-secrets.ts`,
 * which is ignored by git. Create it once:
 *
 *   cp src/config-secrets.example.ts src/config-secrets.ts
 *
 * Every screen (auth, recipes, library, tracker, shopping list, AI chef and
 * user data) talks to the Supabase project configured there.
 */
import {
  SUPABASE_URL as SECRET_SUPABASE_URL,
  SUPABASE_ANON_KEY as SECRET_SUPABASE_ANON_KEY,
} from './config-secrets';

export const SUPABASE_URL = SECRET_SUPABASE_URL;
export const SUPABASE_ANON_KEY = SECRET_SUPABASE_ANON_KEY;

/**
 * The OpenRouter key is NOT part of the app. All AI calls go through the
 * Supabase Edge Function `ai` (supabase/functions/ai), which keeps the key as a
 * server secret — so nobody can extract it from the APK.
 */

/** Supabase Storage bucket used for user recipe photos. */
export const SUPABASE_STORAGE_BUCKET = 'recipe-images';

export const APP_NAME = 'Spoonful';

/** Shown in Settings. */
export const APP_VERSION = '3.1.0';
