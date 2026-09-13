/**
 * Kochmodus-Extras (3.0.0)
 *
 * Speichert lokale Zusatzinfos pro Rezept: Notizen je Schritt (Nr. 16),
 * übersprungene Schritte (Nr. 4), Schritt-Fotos (Nr. 17), Startzeit für den
 * Soll/Ist-Vergleich (Nr. 25) und das zweite Gericht im Parallel-Modus (Nr. 12).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StepExtras = {
  notes: Record<string, string>;
  skipped: number[];
  photos: Record<string, string>;
  startedAt?: number;
  updatedAt?: number;
};

export const EMPTY_EXTRAS: StepExtras = { notes: {}, skipped: [], photos: {} };

/**
 * 3.0.0: alles pro **Konto** (Nutzer-ID) getrennt - Notizen, übersprungene
 * Schritte und besonders die Schritt-Fotos. Wechselt jemand das Konto auf
 * demselben Gerät, sieht er nur seine eigenen Fotos. Nichts davon geht in
 * den Haushalt oder in die Cloud.
 */
const scope = (userId?: string | null) => (userId && userId.length ? userId : 'local');
const extrasKey = (userId: string, recipeKey: string) => `spoonful:cook-extras:${scope(userId)}:${recipeKey}`;
const secondKey = (userId: string) => `spoonful:cook-second:${scope(userId)}`;
const lastActiveKey = (userId: string, recipeKey: string) => `spoonful:cook-last-active:${scope(userId)}:${recipeKey}`;

/** Wie viele Schritt-Fotos pro Rezept gespeichert werden (Speicher schonen). */
export const MAX_STEP_PHOTOS = 6;

export async function loadExtras(userId: string | undefined, recipeKey: string): Promise<StepExtras> {
  try {
    const raw = await AsyncStorage.getItem(extrasKey(userId ?? '', recipeKey));
    if (!raw) return { ...EMPTY_EXTRAS, notes: {}, skipped: [], photos: {} };
    const parsed = JSON.parse(raw);
    return {
      notes: parsed?.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
      skipped: Array.isArray(parsed?.skipped) ? parsed.skipped.filter((n: unknown) => typeof n === 'number') : [],
      photos: parsed?.photos && typeof parsed.photos === 'object' ? parsed.photos : {},
      startedAt: typeof parsed?.startedAt === 'number' ? parsed.startedAt : undefined,
      updatedAt: typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { ...EMPTY_EXTRAS, notes: {}, skipped: [], photos: {} };
  }
}

export async function saveExtras(userId: string | undefined, recipeKey: string, data: StepExtras): Promise<void> {
  try {
    const photos = trimPhotos(data.photos);
    await AsyncStorage.setItem(extrasKey(userId ?? '', recipeKey), JSON.stringify({ ...data, photos, updatedAt: Date.now() }));
  } catch {
    /* Speichern darf nie stören */
  }
}

/** höchstens MAX_STEP_PHOTOS Bilder behalten (älteste zuerst raus) */
function trimPhotos(photos: Record<string, string>): Record<string, string> {
  const keys = Object.keys(photos);
  if (keys.length <= MAX_STEP_PHOTOS) return photos;
  const keep = keys.slice(-MAX_STEP_PHOTOS);
  const out: Record<string, string> = {};
  for (const k of keep) out[k] = photos[k];
  return out;
}

/** Zeitpunkt der letzten Aktivität (für "Wo war ich?" – Nr. 10). */
export async function markLastActive(userId: string | undefined, recipeKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(lastActiveKey(userId ?? '', recipeKey), String(Date.now()));
  } catch {
    /* egal */
  }
}

export async function lastActiveAt(userId: string | undefined, recipeKey: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(lastActiveKey(userId ?? '', recipeKey));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/* ── Zweites Gericht parallel kochen (Nr. 12) ─────────────────────────────── */
export type SecondRecipe = {
  recipeKey: string;
  title: string;
  steps: string[];
  index: number;
  done: number[];
};

export async function loadSecondRecipe(userId: string | undefined): Promise<SecondRecipe | null> {
  try {
    const raw = await AsyncStorage.getItem(secondKey(userId ?? ''));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.steps) || !p.steps.length) return null;
    return {
      recipeKey: String(p.recipeKey ?? p.title ?? 'second'),
      title: String(p.title ?? 'Second dish'),
      steps: p.steps.map((s: unknown) => String(s)),
      index: Math.max(0, Math.min(p.steps.length - 1, Number(p.index) || 0)),
      done: Array.isArray(p.done) ? p.done.filter((n: unknown) => typeof n === 'number') : [],
    };
  } catch {
    return null;
  }
}

export async function saveSecondRecipe(userId: string | undefined, recipe: SecondRecipe | null): Promise<void> {
  try {
    if (!recipe) await AsyncStorage.removeItem(secondKey(userId ?? ''));
    else await AsyncStorage.setItem(secondKey(userId ?? ''), JSON.stringify(recipe));
  } catch {
    /* egal */
  }
}
