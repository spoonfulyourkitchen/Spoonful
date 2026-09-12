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
  OPENROUTER_API_KEY as SECRET_OPENROUTER_API_KEY,
} from './config-secrets';

export const SUPABASE_URL = SECRET_SUPABASE_URL;
export const SUPABASE_ANON_KEY = SECRET_SUPABASE_ANON_KEY;

/**
 * Optional OpenRouter key for the built-in AI chef + nutrition estimator.
 * NOTE: putting a server key inside a shipped app exposes it. For production,
 * move the AI calls into a Supabase Edge Function and remove this constant.
 * Leave empty ('') to disable the AI features.
 */
export const OPENROUTER_API_KEY = SECRET_OPENROUTER_API_KEY;

/** Supabase Storage bucket used for user recipe photos. */
export const SUPABASE_STORAGE_BUCKET = 'recipe-images';

export const APP_NAME = 'Spoonful';

/** Shown in Settings. */
export const APP_VERSION = '2.1.4';
