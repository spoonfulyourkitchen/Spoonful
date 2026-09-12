/**
 * Template for the private `config-secrets.ts` file.
 *
 * The real credentials are deliberately kept out of this repository so that
 * nobody can point a clone at the Spoonful backend. Create your own copy:
 *
 *   cp src/config-secrets.example.ts src/config-secrets.ts
 *
 * and paste the values from your own Supabase project (Project Settings → API)
 * and OpenRouter account (https://openrouter.ai → Keys). The AI features are
 * disabled while `OPENROUTER_API_KEY` is empty.
 */
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';

/** Publishable / anon key of your Supabase project. */
export const SUPABASE_ANON_KEY = 'YOUR-PUBLISHABLE-KEY';

/** OpenRouter key for the AI chef (optional — leave '' to disable AI). */
export const OPENROUTER_API_KEY = '';
