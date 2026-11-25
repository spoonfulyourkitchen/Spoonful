import { useEffect, useMemo, useState } from 'react';
import { translateLines, type TranslatedRecipe } from './recipe-translate';

const memory = new Map<string, TranslatedRecipe>();
const texts = new Map<string, string>();

const storeKey = (recipeKey: string, lang: string) => `${lang}::${recipeKey}`;
const textKey = (lang: string, text: string) => `${lang}::${text}`;

export function getRecipeTranslation(recipeKey: string, lang: string): TranslatedRecipe | null {
  if (!recipeKey || !lang || lang === 'en') return null;
  return memory.get(storeKey(recipeKey, lang)) ?? null;
}

export function rememberRecipeTranslation(
  recipeKey: string | null | undefined,
  lang: string,
  value: TranslatedRecipe | null | undefined,
): void {
  const key = String(recipeKey ?? '').trim();
  if (!key || !lang || lang === 'en' || !value) return;
  const title = String(value.title ?? '').trim();
  const steps = Array.isArray(value.steps) ? value.steps.map(String) : [];
  const ingredients = Array.isArray(value.ingredients) ? value.ingredients.map(String) : [];
  if (!title && !steps.length && !ingredients.length) return;
  memory.set(storeKey(key, lang), {
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    ingredients,
    steps,
  });
  if (memory.size > 400) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

function buildTitleMap(source: string[], lang: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const text of source) {
    const hit = texts.get(textKey(lang, text));
    if (hit) out[text] = hit;
  }
  return out;
}

export function useTranslatedTexts(source: string[], lang: string): Record<string, string> {
  const joined = source.join('\u0001');
  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of joined.split('\u0001')) {
      const value = String(raw ?? '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }, [joined]);

  const [stored, setStored] = useState(() => ({ joined, lang, map: buildTitleMap(unique, lang) }));
  const map = stored.lang === lang && stored.joined === joined ? stored.map : buildTitleMap(unique, lang);

  useEffect(() => {
    if (lang === 'en') {
      setStored({ joined, lang, map: {} });
      return;
    }
    const missing = unique.filter((text) => !texts.has(textKey(lang, text)));
    if (!missing.length) {
      setStored({ joined, lang, map: buildTitleMap(unique, lang) });
      return;
    }
    let alive = true;
    void translateLines(missing, lang)
      .then((translated) => {
        if (!alive) return;
        missing.forEach((text, index) => {
          const value = String(translated[index] ?? '').trim();
          if (value && value !== text) texts.set(textKey(lang, text), value);
        });
        setStored({ joined, lang, map: buildTitleMap(unique, lang) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [joined, lang, unique]);

  return map;
}
