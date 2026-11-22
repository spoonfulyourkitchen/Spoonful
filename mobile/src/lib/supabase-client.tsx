import { supabase } from './supabase';

export { supabase };
export { useAuth as useSupabase } from './convex-auth';

export function useSupabaseClient() {
  return supabase;
}
