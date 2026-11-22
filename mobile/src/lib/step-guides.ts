

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type StepGuide = { index: number; coach: string | null; look: string | null };

const CACHE_PREFIX = 'spoonful:step-guides:v2:';

function cacheKey(recipeId: string): string {
  return `${CACHE_PREFIX}${recipeId}`;
}

function parse(rows: any[] | null | undefined): StepGuide[] | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows
    .filter((r) => r && (r.coach_tip || r.look_for))
    .map((r) => ({
      index: Number(r.step_index ?? 0),
      coach: r.coach_tip ? String(r.coach_tip) : null,
      look: r.look_for ? String(r.look_for) : null,
    }));
}

export async function loadStepGuides(recipeId: string): Promise<StepGuide[] | null> {
  const id = String(recipeId ?? '').trim();
  if (!id) return null;

  let cached: StepGuide[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(id));
    if (raw) cached = parse(JSON.parse(raw));
  } catch {}
  if (cached && cached.length) return cached;

  try {
    const { data, error } = await supabase
      .from('recipe_step_guides')
      .select('step_index, coach_tip, look_for')
      .eq('recipe_id', id)
      .eq('lang', 'en')
      .order('step_index', { ascending: true });
    if (error) throw error;
    const fresh = parse(data);
    if (fresh && fresh.length) {
      try {
        await AsyncStorage.setItem(cacheKey(id), JSON.stringify(data));
      } catch {}
      return fresh;
    }
  } catch {}
  return cached;
}
