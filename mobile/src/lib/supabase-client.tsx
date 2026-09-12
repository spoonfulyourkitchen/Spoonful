import { supabase } from './supabase';

/** Backwards-compatible alias for code that imports `lib/supabase-client`. */
export { supabase };
export { useAuth as useSupabase } from './convex-auth';

export function useSupabaseClient() {
  return supabase;
}
