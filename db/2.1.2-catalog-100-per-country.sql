

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

create or replace function public.catalog_counts()
returns table (cuisine text, recipes bigint)
language sql
stable
as $$
  select coalesce(nullif(trim(r.cuisine), ''), 'Other') as cuisine, count(*)::bigint as recipes
  from public.recipes r
  where r.is_public is true            
  group by 1
  order by 1;
$$;

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

create or replace view public.catalog_countries_az as
  select cuisine as country,
         count(*)::bigint as recipes
    from public.recipes
   where is_public is true
   group by 1
   order by lower(cuisine) asc;

alter table public.catalog_slots enable row level security;

drop policy if exists catalog_slots_read on public.catalog_slots;
create policy catalog_slots_read on public.catalog_slots
  for select using (true);

drop policy if exists catalog_slots_admin_write on public.catalog_slots;
create policy catalog_slots_admin_write on public.catalog_slots
  for all using (public.is_admin()) with check (public.is_admin());

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
