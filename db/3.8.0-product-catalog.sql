-- 3.8.0 product catalog for barcode lookup and food search
-- Seeded with the German Open Food Facts products, grows from app lookups.

create extension if not exists pg_trgm;

create table if not exists public.product_catalog (
  code           text primary key,
  name           text not null,
  brand          text,
  kcal           numeric,
  protein        numeric,
  carbs          numeric,
  fat            numeric,
  serving        text,
  serving_grams  numeric,
  quantity       text,
  package_grams  numeric,
  source         text not null default 'off',
  updated_at     timestamptz not null default now()
);

create index if not exists product_catalog_name_trgm on public.product_catalog using gin (lower(name) gin_trgm_ops);
create index if not exists product_catalog_brand_trgm on public.product_catalog using gin (lower(brand) gin_trgm_ops);
create index if not exists product_catalog_updated_idx on public.product_catalog (updated_at desc);

alter table public.product_catalog enable row level security;

drop policy if exists product_catalog_read on public.product_catalog;
create policy product_catalog_read on public.product_catalog for select using (true);

drop policy if exists product_catalog_admin_write on public.product_catalog;
create policy product_catalog_admin_write on public.product_catalog
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.product_lookup(p_code text)
returns setof public.product_catalog
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.product_catalog
   where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g')
   limit 1;
$$;

create or replace function public.product_search(p_q text, p_limit int default 20)
returns setof public.product_catalog
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select lower(trim(coalesce(p_q, ''))) as term
  )
  select c.*
    from public.product_catalog c, q
   where length(q.term) >= 2
     and (
       lower(c.name) like '%' || q.term || '%'
       or lower(coalesce(c.brand, '')) like '%' || q.term || '%'
     )
   order by
     case when lower(c.name) like q.term || '%' then 0 else 1 end,
     similarity(lower(c.name), q.term) desc,
     length(c.name) asc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.product_remember(
  p_code text,
  p_name text,
  p_brand text default null,
  p_kcal numeric default null,
  p_protein numeric default null,
  p_carbs numeric default null,
  p_fat numeric default null,
  p_serving text default null,
  p_serving_grams numeric default null,
  p_quantity text default null,
  p_package_grams numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
  if length(clean) < 6 or length(trim(coalesce(p_name, ''))) < 2 then
    return;
  end if;

  insert into public.product_catalog (
    code, name, brand, kcal, protein, carbs, fat, serving, serving_grams, quantity, package_grams, source
  ) values (
    clean,
    left(trim(p_name), 160),
    nullif(left(trim(coalesce(p_brand, '')), 80), ''),
    p_kcal, p_protein, p_carbs, p_fat,
    nullif(left(trim(coalesce(p_serving, '')), 40), ''),
    p_serving_grams,
    nullif(left(trim(coalesce(p_quantity, '')), 40), ''),
    p_package_grams,
    'app'
  )
  on conflict (code) do update
     set name = excluded.name,
         brand = coalesce(excluded.brand, product_catalog.brand),
         kcal = coalesce(excluded.kcal, product_catalog.kcal),
         protein = coalesce(excluded.protein, product_catalog.protein),
         carbs = coalesce(excluded.carbs, product_catalog.carbs),
         fat = coalesce(excluded.fat, product_catalog.fat),
         serving = coalesce(excluded.serving, product_catalog.serving),
         serving_grams = coalesce(excluded.serving_grams, product_catalog.serving_grams),
         quantity = coalesce(excluded.quantity, product_catalog.quantity),
         package_grams = coalesce(excluded.package_grams, product_catalog.package_grams),
         updated_at = now()
   where product_catalog.source = 'app';
end;
$$;

grant execute on function public.product_lookup(text) to anon, authenticated;
grant execute on function public.product_search(text, int) to anon, authenticated;
grant execute on function public.product_remember(text, text, text, numeric, numeric, numeric, numeric, text, numeric, text, numeric) to authenticated;
