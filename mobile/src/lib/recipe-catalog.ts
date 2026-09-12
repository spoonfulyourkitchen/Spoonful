import { api } from './api';
import { COUNTRIES, type Country } from './countries';
import { supabase } from './supabase';

/**
 * Recipe catalogue for scaling to **100 recipes per country** (2.1.2).
 *
 * The screen side is already paged: `recipes.libraryPage` calls the Supabase RPC
 * `catalog_page` with `limit`/`offset` and returns `{ items, total, hasMore }`,
 * and `LibraryScreen` appends the next page when the list end comes into view
 * (lazy loading, no full download).
 *
 * This module adds the *plan*: every country has exactly 100 slots, so the
 * content pipeline can fill them country by country.
 *
 *   ── How to add recipes ────────────────────────────────────────────────────
 *   1. generate the recipes with the prompts in `Recipe-AI-Prompt.md`
 *      (schema, formats, quality gate),
 *   2. upload them with the SQL template in
 *      `db/2.1.2-catalog-100-per-country.sql` (one INSERT per recipe, the
 *      `cuisine` column must be the English country name from `countries.ts`),
 *   3. mark the slots as seeded (same file, table `catalog_slots`),
 *   4. nothing else to do: the app picks the new rows up automatically through
 *      `catalog_page`, the filter list and the A–Z country ordering.
 *
 * Never fill all 100 slots by hand — work in batches of 10 per country and keep
 * the photos/nutrition consistent.
 */
export const RECIPES_PER_COUNTRY = 100;

export type CatalogSlotStatus = 'empty' | 'planned' | 'seeded';

export type CatalogSlot = {
  country: string;
  /** 1 … RECIPES_PER_COUNTRY */
  index: number;
  status: CatalogSlotStatus;
  /** Set once the recipe exists in the catalogue. */
  recipeId?: string;
};

/** All 100 slots of one country (deterministic, no data needed). */
export function catalogSlots(country: string, seeded = 0): CatalogSlot[] {
  const safe = Math.max(0, Math.min(RECIPES_PER_COUNTRY, Math.floor(seeded)));
  return Array.from({ length: RECIPES_PER_COUNTRY }, (_, i) => ({
    country,
    index: i + 1,
    status: i < safe ? 'seeded' : 'planned',
  }));
}

/** Progress of one country: how many of the 100 slots are filled. */
export function catalogProgress(seededPerCountry: Record<string, number>) {
  const rows = COUNTRIES.map((c) => ({
    ...c,
    seeded: Math.max(0, Math.min(RECIPES_PER_COUNTRY, seededPerCountry[c.name] ?? 0)),
  }));
  const totalSeeded = rows.reduce((sum, r) => sum + r.seeded, 0);
  const totalSlots = COUNTRIES.length * RECIPES_PER_COUNTRY;
  return {
    rows,
    totalSeeded,
    totalSlots,
    percent: totalSlots ? Math.round((totalSeeded / totalSlots) * 100) : 0,
    /** Countries that cannot be selected in the filter yet. */
    empty: rows.filter((r) => r.seeded === 0),
  };
}

/** Page size used by the library (kept in sync with the screen). */
export const CATALOG_PAGE_SIZE = 24;

export type CatalogPage<T> = { items: T[]; total: number; hasMore: boolean; offset: number };

/**
 * One lazy page of the catalogue for a country (or all countries when the
 * country is empty/'all'). Used by the library screen; the RPC already pages on
 * the server, so a country with 100 recipes never loads more than one page at a
 * time.
 */
export async function loadCatalogPage(args: {
  country?: string;
  search?: string;
  offset?: number;
  limit?: number;
  sort?: string;
}): Promise<CatalogPage<any>> {
  const offset = Math.max(0, Math.floor(args.offset ?? 0));
  const limit = Math.max(1, Math.min(60, Math.floor(args.limit ?? CATALOG_PAGE_SIZE)));
  const res: any = await (api.recipes as any).libraryPage({
    search: args.search ?? '',
    cuisine: args.country && args.country !== 'all' ? args.country : 'all',
    limit,
    offset,
    sort: args.sort ?? 'title',
  });
  return {
    items: res?.items ?? [],
    total: Number(res?.total ?? 0),
    hasMore: !!res?.hasMore,
    offset: Number(res?.offset ?? offset),
  };
}

/** Counts the recipes per country directly in the database (admin view). */
export async function fetchCatalogCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase.rpc('catalog_counts' as any, {} as any);
    if (error) return {};
    const rows = Array.isArray(data) ? data : (data as any)?.catalog_counts ?? [];
    const out: Record<string, number> = {};
    for (const row of rows) {
      const key = String(row?.cuisine ?? '').trim();
      if (key) out[key] = Number(row?.recipes ?? 0);
    }
    return out;
  } catch {
    return {};
  }
}

/** Countries that still need content (used by the admin panel / roadmap view). */
export function countriesWithoutContent(seededPerCountry: Record<string, number>): Country[] {
  return COUNTRIES.filter((c) => (seededPerCountry[c.name] ?? 0) === 0);
}
