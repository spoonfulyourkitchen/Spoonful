/**
 * 3.3.0: Coach-Tipps und „Achte auf" pro Schritt.
 *
 * Diese Hinweise kommen nicht mehr aus fest eingebauten Texten, sondern liegen
 * pro Rezept und Schritt in der Bibliothek (`public.recipe_step_guides`) und
 * werden vom Rezept-Bot erzeugt und direkt hochgeladen. Fehlen sie noch, liefert
 * diese Funktion `null` — die Oberfläche zeigt dann einen Hinweis, dass die
 * Schritt-Hinweise noch vorbereitet werden (statt erfundener Tipps).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type StepGuide = { index: number; coach: string | null; look: string | null };

const CACHE_PREFIX = 'spoonful:step-guides:v1:';

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

/**
 * Hinweise für ein Rezept holen (erst Speicher, dann Netz). Was im Speicher
 * liegt, gewinnt sofort — der Kochmodus muss auch ohne Netz vollständig sein.
 */
export async function loadStepGuides(recipeId: string): Promise<StepGuide[] | null> {
  const id = String(recipeId ?? '').trim();
  if (!id) return null;

  let cached: StepGuide[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(id));
    if (raw) cached = parse(JSON.parse(raw));
  } catch {
    /* kein/ungültiger Zwischenspeicher */
  }
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
      } catch {
        /* Speicher voll — dann eben ohne Zwischenspeicher */
      }
      return fresh;
    }
  } catch {
    /* offline oder Tabelle fehlt noch */
  }
  return cached;
}
