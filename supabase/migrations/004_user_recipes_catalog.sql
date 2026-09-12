-- Split user recipes from the imported catalogue (public.recipes is now read-only catalogue).
create table if not exists public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  prep_time bigint not null default 0,
  cook_time bigint not null default 0,
  cuisine text,
  dietary_restrictions jsonb not null default '[]'::jsonb,
  image_url text,
  difficulty text not null default 'easy',
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  created_at bigint not null,
  updated_at bigint not null
);
alter table public.user_recipes enable row level security;
--SPLIT--
create policy "user_recipes_insert_own" on public.user_recipes for insert with check (user_id = auth.uid());
create policy "user_recipes_select_own" on public.user_recipes for select using (user_id = auth.uid());
create policy "user_recipes_update_own" on public.user_recipes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_recipes_delete_own" on public.user_recipes for delete using (user_id = auth.uid());
--SPLIT--
-- Server-side recipe catalogue search with offset pagination + exact total.
create or replace function public.catalog_page(p jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  q text := lower(coalesce(nullif(p->>'search', ''), ''));
  c text := lower(coalesce(nullif(p->>'cuisine', ''), ''));
  m text := lower(coalesce(nullif(p->>'mealType', ''), ''));
  diff text := lower(coalesce(nullif(p->>'difficulty', ''), ''));
  tr text := coalesce(nullif(p->>'timeRange', ''), '');
  cr text := coalesce(nullif(p->>'calories', ''), '');
  lim int := greatest(1, coalesce((p->>'limit')::int, 24));
  off int := greatest(0, coalesce((p->>'offset')::int, 0));
  total bigint;
  items jsonb;
  mins int;
begin
  create temp table _cf on commit drop as
  select r.*
  from public.recipes r
  where (q = '' or lower(r.title) like '%' || q || '%' or lower(coalesce(r.description, '')) like '%' || q || '%')
    and (c = '' or lower(coalesce(r.cuisine, '')) = c)
    and (m = '' or lower(coalesce(r.meal_type, '')) = m)
    and (diff = '' or lower(coalesce(r.difficulty, 'medium')) = diff)
    and (
      not coalesce(jsonb_array_length(coalesce(p->'diets', '[]'::jsonb)), 0) > 0
      or not exists (
        select 1 from jsonb_array_elements_text(coalesce(p->'diets', '[]'::jsonb)) sel
        where not exists (
          select 1 from jsonb_array_elements_text(r.dietary_restrictions) dr
          where lower(dr) = lower(sel)
        )
      )
    )
    and (
      tr = ''
      or (tr = 'under15' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) < 15)
      or (tr = '15-30' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) between 15 and 30)
      or (tr = 'over30' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) > 30)
    )
    and (
      cr = ''
      or (cr = '0-400' and coalesce(r.calories, 0) <= 400)
      or (cr = '400-700' and coalesce(r.calories, 0) > 400 and coalesce(r.calories, 0) <= 700)
      or (cr = 'over700' and coalesce(r.calories, 0) > 700)
    );

  select count(*) into total from _cf;
  select coalesce(jsonb_agg(row_to_json(x) order by x.title), '[]'::jsonb) into items
  from (select * from _cf order by title limit lim offset off) x;

  return jsonb_build_object(
    'items', items,
    'total', total,
    'offset', off,
    'hasMore', (off + lim) < total
  );
end;
$$;
--SPLIT--
-- Server-cached recipe translations (keyed by recipe + language).
create table if not exists public.recipe_translations (
  recipe_key text not null,
  language text not null,
  title text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  updated_at bigint not null,
  primary key (recipe_key, language)
);
alter table public.recipe_translations enable row level security;
--SPLIT--
create policy "recipe_translations_select_all" on public.recipe_translations for select using (true);
create policy "recipe_translations_write" on public.recipe_translations
  for all to authenticated using (true) with check (true);
--SPLIT--
create or replace function public.save_translation(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.recipe_translations (recipe_key, language, title, description, ingredients, steps, updated_at)
  values (
    p->>'recipeKey', p->>'language', p->>'title', p->>'description',
    coalesce(p->'ingredients', '[]'::jsonb), coalesce(p->'steps', '[]'::jsonb),
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (recipe_key, language)
  do update set title = excluded.title, description = excluded.description,
    ingredients = excluded.ingredients, steps = excluded.steps, updated_at = excluded.updated_at;
end;
$$;
--SPLIT--
-- Remove the temporary demo catalogue rows from the previous migration.
drop table if exists public.library_recipes;
--SPLIT--
notify pgrst, 'reload schema';
