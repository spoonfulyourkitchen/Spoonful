/**
 * Template for the private `config-secrets.ts` file.
 *
 * The real credentials are deliberately kept out of this repository so that
 * nobody can point a clone at the Spoonful backend. Create your own copy:
 *
 *   cp src/config-secrets.example.ts src/config-secrets.ts
 *
 * and paste the values from your own Supabase project (Project Settings → API).
 * The AI features do not need a key here — the OpenRouter key lives as a secret
 * of the Supabase Edge Function `ai` (see supabase/functions/ai).
 */
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';

/** Publishable / anon key of your Supabase project. */
export const SUPABASE_ANON_KEY = 'YOUR-PUBLISHABLE-KEY';
