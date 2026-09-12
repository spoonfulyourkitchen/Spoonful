-- Spoonful 2.1.2 — catalogue scaffold: 100 recipes per country
--
-- Run this once in the Supabase SQL editor (project gmfkleugoxafmvprqatk).
-- It only *prepares* the structure - it does not invent recipes. Fill the slots
-- with the pipeline described in mobile/src/lib/recipe-catalog.ts and
-- Recipe-AI-Prompt.md.
--
-- `cuisine` is the English country name from mobile/src/lib/countries.ts, so the
-- library filter can show every country A → Z.

-- 1) slot table: 100 rows per country -----------------------------------------
create table if not exists public.catalog_slots (
  id           bigserial primary key,
  country      text    not null,
  slot         int     not null check (slot between 1 and 100),
  status       text    not null default 'planned' check (status in ('planned', 'seeded')),
  recipe_id    bigint  references public.recipes(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (country, slot)
);

create index if not exists catalog_slots_country_idx on public.catalog_slots (country, status);

-- 2) fill 100 slots for every country of the app list -------------------------
--    (paste the country names from mobile/src/lib/countries.ts)
create or replace function public.seed_catalog_slots(p_countries text[])
returns int
language plpgsql
security definer
as $$
declare
  c text;
  i int;
  inserted int := 0;
begin
  foreach c in array p_countries loop
    for i in 1..100 loop
      insert into public.catalog_slots (country, slot)
      values (c, i)
      on conflict (country, slot) do nothing;
      inserted := inserted + 1;
    end loop;
  end loop;
  return inserted;
end;
$$;

-- 3) how full is each country? (admin view + filter hints) --------------------
create or replace function public.catalog_counts()
returns table (cuisine text, recipes bigint)
language sql
stable
as $$
  select coalesce(nullif(trim(r.cuisine), ''), 'Other') as cuisine, count(*)::bigint as recipes
  from public.recipes r
  where r.is_public is true            -- only the shared catalogue
  group by 1
  order by 1;
$$;

-- 4) attach an uploaded recipe to its slot ------------------------------------
create or replace function public.catalog_attach(p_country text, p_recipe_id bigint)
returns void
language sql
security definer
as $$
  update public.catalog_slots s
     set status = 'seeded', recipe_id = p_recipe_id, updated_at = now()
   where s.id = (
     select id from public.catalog_slots
      where country = p_country and status = 'planned'
      order by slot
      limit 1
   );
$$;

-- 5) A–Z bookkeeping: keep the country list available for the filter ----------
--    The app sorts client-side with localeCompare('en'); this view is handy for
--    SQL-side checks that the ordering matches.
create or replace view public.catalog_countries_az as
  select cuisine as country,
         count(*)::bigint as recipes
    from public.recipes
   where is_public is true
   group by 1
   order by lower(cuisine) asc;

-- 6) RLS: the catalogue is public read, writes stay with the admin role -------
alter table public.catalog_slots enable row level security;

drop policy if exists catalog_slots_read on public.catalog_slots;
create policy catalog_slots_read on public.catalog_slots
  for select using (true);

drop policy if exists catalog_slots_admin_write on public.catalog_slots;
create policy catalog_slots_admin_write on public.catalog_slots
  for all using (public.is_admin()) with check (public.is_admin());

-- 7) seed run (uncomment and paste the country names you want to plan) --------
-- select public.seed_catalog_slots(array[
--   'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
--   'Belgium','Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia',
--   'Croatia','Cuba','Cyprus','Czechia','Denmark','Ecuador','Egypt','Estonia',
--   'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary',
--   'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan',
--   'Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon','Libya','Lithuania',
--   'Luxembourg','Malaysia','Malta','Mexico','Moldova','Mongolia','Montenegro',
--   'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway',
--   'Oman','Pakistan','Palestine','Panama','Paraguay','Peru','Philippines','Poland',
--   'Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore',
--   'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sudan',
--   'Sweden','Switzerland','Syria','Taiwan','Tanzania','Thailand','Tunisia',
--   'Türkiye','Ukraine','United Arab Emirates','United Kingdom','United States',
--   'Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
-- ]);

-- 8) count of seeded recipes per country (for the 100/100 progress) -----------
create or replace function public.catalog_seeded_counts()
returns table (country text, seeded bigint)
language sql
stable
as $$
  select country, count(*) filter (where status = 'seeded')::bigint as seeded
    from public.catalog_slots
   group by country
   order by lower(country) asc;
$$;
