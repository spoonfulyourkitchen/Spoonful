import { api } from './api';
import { COUNTRIES, type Country } from './countries';
import { supabase } from './supabase';

export const RECIPES_PER_COUNTRY = 100;

export type CatalogSlotStatus = 'empty' | 'planned' | 'seeded';

export type CatalogSlot = {
  country: string;
  
  index: number;
  status: CatalogSlotStatus;
  
  recipeId?: string;
};

export function catalogSlots(country: string, seeded = 0): CatalogSlot[] {
  const safe = Math.max(0, Math.min(RECIPES_PER_COUNTRY, Math.floor(seeded)));
  return Array.from({ length: RECIPES_PER_COUNTRY }, (_, i) => ({
    country,
    index: i + 1,
    status: i < safe ? 'seeded' : 'planned',
  }));
}

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
    
    empty: rows.filter((r) => r.seeded === 0),
  };
}

export const CATALOG_PAGE_SIZE = 24;

export type CatalogPage<T> = { items: T[]; total: number; hasMore: boolean; offset: number };

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

export function countriesWithoutContent(seededPerCountry: Record<string, number>): Country[] {
  return COUNTRIES.filter((c) => (seededPerCountry[c.name] ?? 0) === 0);
}
