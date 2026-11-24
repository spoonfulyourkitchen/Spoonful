

export type FoodHit = {
  code: string;
  name: string;
  brand?: string;
  
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  
  serving?: string;
  
  servingGrams?: number;
  
  packageGrams?: number;
  
  quantity?: string;
};

export type PortionMode = 'serving' | 'hundred' | 'package' | 'custom';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,product_quantity,quantity';

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
};

function parseGrams(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|cl)?/);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = m[2] ?? 'g';
  if (unit === 'kg' || unit === 'l') return Math.round(value * 1000);
  if (unit === 'cl') return Math.round(value * 10);
  return Math.round(value);
}

function normalize(p: any, fallbackCode?: string): FoodHit | null {
  if (!p || typeof p !== 'object') return null;
  const n: any = p.nutriments ?? {};
  const brand = p.brands ? String(p.brands).split(',')[0].trim() : undefined;

  
  const candidates = [
    p.product_name,
    p.product_name_de,
    p.product_name_en,
    p.generic_name,
    p.generic_name_de,
    p.generic_name_en,
    p.abbreviated_product_name,
  ];
  let name = candidates.map((c) => (c ? String(c).trim() : '')).find((c) => c.length > 1) ?? '';
  if (!name && brand) name = `${brand}${p.quantity ? ` ${String(p.quantity)}` : ''}`;
  if (!name) return null;

  
  const hasEnergy = (n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n.proteins_100g) != null;
  if (!hasEnergy) return null;

  const serving = p.serving_size ? String(p.serving_size) : undefined;
  return {
    code: String(p.code ?? p._id ?? fallbackCode ?? ''),
    name: name.slice(0, 120),
    brand,
    kcal: num(n['energy-kcal_100g'] ?? n['energy-kcal']),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    serving,
    servingGrams: num(p.serving_quantity) ?? parseGrams(serving),
    packageGrams: num(p.product_quantity) ?? parseGrams(p.quantity),
    quantity: p.quantity ? String(p.quantity) : undefined,
  };
}

export function portionGrams(hit: FoodHit, mode: PortionMode, custom?: number): number | null {
  if (mode === 'hundred') return 100;
  if (mode === 'serving') return hit.servingGrams ?? 100;
  if (mode === 'package') return hit.packageGrams ?? null;
  const value = Number(custom);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function scaleToPortion(hit: FoodHit, grams: number) {
  const f = grams / 100;
  const round1 = (v?: number) => (v == null ? undefined : Math.round(v * f * 10) / 10);
  return {
    calories: hit.kcal != null ? Math.round(hit.kcal * f) : 0,
    protein: round1(hit.protein),
    carbs: round1(hit.carbs),
    fat: round1(hit.fat),
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const BARCODE_CACHE = 'spoonful:barcode:';
const BARCODE_TTL = 30 * 24 * 60 * 60 * 1000;
const CATALOG_MS = 2500;

async function withTimeout<T>(url: string, ms = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Spoonful/2.0 (Android; recipe app)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function r1(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
}

function fromRow(row: any): FoodHit | null {
  const code = String(row?.code ?? '').replace(/\D/g, '');
  const name = String(row?.name ?? '').trim();
  if (code.length < 6 || name.length < 2) return null;
  const hit: FoodHit = {
    code,
    name: name.slice(0, 120),
    brand: row?.brand ? String(row.brand) : undefined,
    kcal: r1(row?.kcal),
    protein: r1(row?.protein),
    carbs: r1(row?.carbs),
    fat: r1(row?.fat),
    serving: row?.serving ? String(row.serving) : undefined,
    servingGrams: r1(row?.serving_grams),
    packageGrams: r1(row?.package_grams),
    quantity: row?.quantity ? String(row.quantity) : undefined,
  };
  return hit;
}

async function rpcRows(fn: string, args: Record<string, unknown>, ms = CATALOG_MS): Promise<any[] | null> {
  try {
    const call: any = supabase.rpc(fn as any, args as any);
    const result: any = await Promise.race([
      Promise.resolve(call),
      new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
    if (!result || result.error) return null;
    const data = result.data;
    if (!data) return null;
    return Array.isArray(data) ? data : [data];
  } catch {
    return null;
  }
}

async function catalogByCode(code: string): Promise<FoodHit | null> {
  const rows = await rpcRows('product_lookup', { p_code: code });
  const hit = rows && rows.length ? fromRow(rows[0]) : null;
  return hit && hit.kcal != null ? hit : null;
}

async function catalogSearch(q: string, limit: number): Promise<FoodHit[]> {
  const rows = await rpcRows('product_search', { p_q: q, p_limit: limit }, 3000);
  return (rows ?? []).map(fromRow).filter((x): x is FoodHit => !!x && x.kcal != null);
}

function remember(hit: FoodHit) {
  try {
    void Promise.resolve(
      supabase.rpc('product_remember' as any, {
        p_code: hit.code,
        p_name: hit.name,
        p_brand: hit.brand ?? null,
        p_kcal: hit.kcal ?? null,
        p_protein: hit.protein ?? null,
        p_carbs: hit.carbs ?? null,
        p_fat: hit.fat ?? null,
        p_serving: hit.serving ?? null,
        p_serving_grams: hit.servingGrams ?? null,
        p_quantity: hit.quantity ?? null,
        p_package_grams: hit.packageGrams ?? null,
      } as any),
    ).catch(() => {});
  } catch {}
}

async function offByCode(code: string): Promise<FoodHit | null> {
  const v2 = await withTimeout<{ status?: number; product?: any }>(
    `${PRODUCT_URL}${code}.json?fields=${FIELDS},product_name_de,product_name_en,generic_name,generic_name_de,generic_name_en,abbreviated_product_name`,
    5000,
  );
  const hitV2 = v2 && v2.status !== 0 ? normalize(v2.product, code) : null;
  if (hitV2) return hitV2;

  const v0 = await withTimeout<{ status?: number; product?: any }>(
    `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    4000,
  );
  return v0 && v0.status !== 0 ? normalize(v0.product, code) : null;
}

export async function searchFoods(query: string, limit = 12): Promise<FoodHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const local = await catalogSearch(q, limit);
  if (local.length >= Math.min(limit, 6)) return local.slice(0, limit);

  const url =
    `${SEARCH_URL}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1` +
    `&page_size=${limit}&fields=${FIELDS}`;
  const data = await withTimeout<{ products?: any[] }>(url, 7000);
  const remote = (data?.products ?? []).map((p: any) => normalize(p)).filter((x): x is FoodHit => !!x);

  const seen = new Set(local.map((h) => h.code));
  const merged = [...local];
  for (const hit of remote) {
    if (seen.has(hit.code)) continue;
    seen.add(hit.code);
    merged.push(hit);
    if (merged.length >= limit) break;
  }
  return merged;
}

export async function productByBarcode(barcode: string): Promise<FoodHit | null> {
  const digits = String(barcode ?? '').replace(/\D/g, '');
  if (digits.length < 6) return null;

  try {
    const raw = await AsyncStorage.getItem(BARCODE_CACHE + digits);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.at && Date.now() - cached.at < BARCODE_TTL) return cached.hit as FoodHit;
    }
  } catch {}

  const known = await catalogByCode(digits);
  if (known) {
    AsyncStorage.setItem(BARCODE_CACHE + digits, JSON.stringify({ hit: known, at: Date.now() })).catch(() => {});
    return known;
  }

  const variants: string[] = [digits];
  if (digits.length === 12) variants.push(`0${digits}`);
  if (digits.length === 13 && digits.startsWith('0')) variants.push(digits.slice(1));
  if (digits.length === 14 && digits.startsWith('0')) variants.push(digits.slice(1));

  const codes = Array.from(new Set(variants));
  const results = await Promise.all(codes.map((code) => offByCode(code).catch(() => null)));
  const hit = results.find((x): x is FoodHit => !!x) ?? null;
  if (!hit) return null;

  hit.code = digits;
  AsyncStorage.setItem(BARCODE_CACHE + digits, JSON.stringify({ hit, at: Date.now() })).catch(() => {});
  remember(hit);
  return hit;
}
