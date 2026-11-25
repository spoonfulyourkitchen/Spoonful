-- 3.7.3: keep the complete profile, onboarding answers and app preferences on the account,
-- so a reinstall or a new phone restores them after sign-in.

alter table public.users add column if not exists onboarding jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists prefs jsonb not null default '{}'::jsonb;

-- Merge answers/prefs into the signed-in user's row and mirror the columns the app reads.
create or replace function public.save_my_account_data(p_onboarding jsonb default null, p_prefs jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  merged_onboarding jsonb;
  merged_prefs jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;

  update users set
    onboarding = coalesce(onboarding, '{}'::jsonb) || coalesce(p_onboarding, '{}'::jsonb),
    prefs = coalesce(prefs, '{}'::jsonb) || coalesce(p_prefs, '{}'::jsonb),
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where id = uid
  returning onboarding, prefs into merged_onboarding, merged_prefs;

  update users set
    name = coalesce(nullif(merged_onboarding->>'name', ''), name),
    goal = coalesce(nullif(merged_onboarding->>'goal', ''), goal),
    diet = coalesce(nullif(merged_onboarding->>'diet', ''), diet),
    cooking_experience = coalesce(nullif(merged_onboarding->>'experience', ''), cooking_experience),
    allergies = coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(merged_onboarding->'allergies', '[]'::jsonb))),
      allergies
    ),
    onboarded_at = coalesce(
      nullif(merged_onboarding->>'completedAt', '')::bigint,
      nullif(merged_onboarding->>'onboardedAt', '')::bigint,
      onboarded_at
    )
  where id = uid;

  return jsonb_build_object('onboarding', merged_onboarding, 'prefs', merged_prefs);
end
$function$;

grant execute on function public.save_my_account_data(jsonb, jsonb) to authenticated;

-- Export now includes the full onboarding answers, preferences and profile fields.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select jsonb_build_object(
    'format', 'spoonful-export-v2',
    'exported_at', (extract(epoch from now()) * 1000)::bigint,
    'user_id', uid,
    'profile', (select to_jsonb(p) from (select id, name, email, role, goal, diet, allergies,
        cooking_experience, onboarded_at, water_goal_ml, created_at from users where id = uid) p),
    'onboarding', (select onboarding from users where id = uid),
    'prefs', (select prefs from users where id = uid),
    'saved_recipes', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from saved_recipes s where s.user_id = uid),
    'my_recipes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from user_recipes r where r.user_id = uid),
    'collections', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from collections c where c.user_id = uid),
    'calorie_entries', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from calorie_entries c where c.user_id = uid),
    'weight_logs', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from weight_logs w where w.user_id = uid),
    'shopping_list', (select coalesce(jsonb_agg(to_jsonb(sl)), '[]'::jsonb) from shopping_list_items sl where sl.user_id = uid),
    'shared_recipes', (select coalesce(jsonb_agg(to_jsonb(sr)), '[]'::jsonb) from shared_recipes sr where sr.owner_id = uid),
    'comments', (select coalesce(jsonb_agg(to_jsonb(sc)), '[]'::jsonb) from share_comments sc where sc.user_id = uid),
    'photos', (select coalesce(jsonb_agg(to_jsonb(sp)), '[]'::jsonb) from share_photos sp where sp.user_id = uid),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(rv)), '[]'::jsonb) from recipe_reviews rv where rv.user_id = uid),
    'likes', (select coalesce(jsonb_agg(to_jsonb(rl)), '[]'::jsonb) from recipe_likes rl where rl.user_id = uid),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from feedback f where f.user_id = uid)
  ) into result;
  return result;
end
$function$;

-- Import an export file back into the signed-in account. Safe to run twice:
-- recipes and entries that already exist are skipped instead of duplicated.
create or replace function public.import_my_data(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  counts jsonb := '{}'::jsonb;
  added int;
  rec jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid import file'; end if;

  if p_data ? 'onboarding' or p_data ? 'prefs' then
    perform public.save_my_account_data(p_data->'onboarding', p_data->'prefs');
  end if;

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'collections', '[]'::jsonb)) loop
    if coalesce(rec->>'name', '') = '' then continue; end if;
    insert into collections (id, user_id, name, created_at)
    values (
      coalesce(nullif(rec->>'id', '')::uuid, gen_random_uuid()),
      uid,
      left(rec->>'name', 60),
      coalesce(nullif(rec->>'created_at', '')::bigint, now_ms)
    )
    on conflict (id) do nothing;
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('collections', added);

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'saved_recipes', '[]'::jsonb)) loop
    if coalesce(rec->>'title', '') = '' then continue; end if;
    if exists (
      select 1 from saved_recipes s
      where s.user_id = uid
        and s.title = rec->>'title'
        and coalesce(s.recipe_key, '') = coalesce(rec->>'recipe_key', '')
    ) then continue; end if;
    insert into saved_recipes (
      user_id, recipe_key, title, description, ingredients, steps, guides,
      prep_time, cook_time, cuisine, dietary_restrictions, image_url, difficulty,
      calories, protein, carbs, fat, notes, favorite, collection_ids, created_at, updated_at
    ) values (
      uid,
      coalesce(rec->>'recipe_key', ''),
      rec->>'title',
      coalesce(rec->>'description', ''),
      coalesce(rec->'ingredients', '[]'::jsonb),
      coalesce(rec->'steps', '[]'::jsonb),
      coalesce(rec->'guides', '[]'::jsonb),
      coalesce(nullif(rec->>'prep_time', '')::int, 0),
      coalesce(nullif(rec->>'cook_time', '')::int, 0),
      coalesce(rec->>'cuisine', ''),
      coalesce(rec->'dietary_restrictions', '[]'::jsonb),
      nullif(rec->>'image_url', ''),
      coalesce(nullif(rec->>'difficulty', ''), 'easy'),
      nullif(rec->>'calories', '')::numeric,
      nullif(rec->>'protein', '')::numeric,
      nullif(rec->>'carbs', '')::numeric,
      nullif(rec->>'fat', '')::numeric,
      coalesce(rec->>'notes', ''),
      coalesce((rec->>'favorite')::boolean, false),
      coalesce(rec->'collection_ids', '[]'::jsonb),
      coalesce(nullif(rec->>'created_at', '')::bigint, now_ms),
      coalesce(nullif(rec->>'updated_at', '')::bigint, now_ms)
    );
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('saved_recipes', added);

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'my_recipes', '[]'::jsonb)) loop
    if coalesce(rec->>'title', '') = '' then continue; end if;
    if exists (
      select 1 from user_recipes r
      where r.user_id = uid
        and r.title = rec->>'title'
        and r.created_at = coalesce(nullif(rec->>'created_at', '')::bigint, 0)
    ) then continue; end if;
    insert into user_recipes (
      user_id, title, description, ingredients, steps, guides,
      prep_time, cook_time, cuisine, dietary_restrictions, image_url, difficulty,
      calories, protein, carbs, fat, created_at, updated_at
    ) values (
      uid,
      rec->>'title',
      coalesce(rec->>'description', ''),
      coalesce(rec->'ingredients', '[]'::jsonb),
      coalesce(rec->'steps', '[]'::jsonb),
      coalesce(rec->'guides', '[]'::jsonb),
      coalesce(nullif(rec->>'prep_time', '')::int, 0),
      coalesce(nullif(rec->>'cook_time', '')::int, 0),
      coalesce(rec->>'cuisine', ''),
      coalesce(rec->'dietary_restrictions', '[]'::jsonb),
      nullif(rec->>'image_url', ''),
      coalesce(nullif(rec->>'difficulty', ''), 'easy'),
      nullif(rec->>'calories', '')::numeric,
      nullif(rec->>'protein', '')::numeric,
      nullif(rec->>'carbs', '')::numeric,
      nullif(rec->>'fat', '')::numeric,
      coalesce(nullif(rec->>'created_at', '')::bigint, now_ms),
      coalesce(nullif(rec->>'updated_at', '')::bigint, now_ms)
    );
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('my_recipes', added);

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'calorie_entries', '[]'::jsonb)) loop
    if exists (
      select 1 from calorie_entries c
      where c.user_id = uid
        and c.title = coalesce(rec->>'title', 'Meal')
        and c.eaten_at = coalesce(nullif(rec->>'eaten_at', '')::bigint, 0)
    ) then continue; end if;
    insert into calorie_entries (
      user_id, recipe_key, title, calories, protein, carbs, fat, servings, source, eaten_at
    ) values (
      uid,
      nullif(rec->>'recipe_key', ''),
      coalesce(rec->>'title', 'Meal'),
      coalesce(nullif(rec->>'calories', '')::numeric, 0),
      nullif(rec->>'protein', '')::numeric,
      nullif(rec->>'carbs', '')::numeric,
      nullif(rec->>'fat', '')::numeric,
      coalesce(nullif(rec->>'servings', '')::numeric, 1),
      coalesce(nullif(rec->>'source', ''), 'import'),
      coalesce(nullif(rec->>'eaten_at', '')::bigint, now_ms)
    );
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('calorie_entries', added);

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'weight_logs', '[]'::jsonb)) loop
    if coalesce(rec->>'weight_kg', '') = '' then continue; end if;
    if exists (
      select 1 from weight_logs w
      where w.user_id = uid
        and w.logged_at = coalesce(nullif(rec->>'logged_at', '')::bigint, 0)
    ) then continue; end if;
    insert into weight_logs (user_id, weight_kg, logged_at)
    values (uid, (rec->>'weight_kg')::numeric, coalesce(nullif(rec->>'logged_at', '')::bigint, now_ms));
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('weight_logs', added);

  added := 0;
  for rec in select value from jsonb_array_elements(coalesce(p_data->'shopping_list', '[]'::jsonb)) loop
    if coalesce(rec->>'name', '') = '' then continue; end if;
    if exists (
      select 1 from shopping_list_items s
      where s.user_id = uid and lower(s.name) = lower(rec->>'name')
    ) then continue; end if;
    insert into shopping_list_items (
      user_id, name, recipe_key, recipe_title, checked, created_at, price, have, category, course
    ) values (
      uid,
      rec->>'name',
      nullif(rec->>'recipe_key', ''),
      nullif(rec->>'recipe_title', ''),
      coalesce((rec->>'checked')::boolean, false),
      coalesce(nullif(rec->>'created_at', '')::bigint, now_ms),
      nullif(rec->>'price', '')::numeric,
      coalesce((rec->>'have')::boolean, false),
      nullif(rec->>'category', ''),
      nullif(rec->>'course', '')
    );
    added := added + 1;
  end loop;
  counts := counts || jsonb_build_object('shopping_list', added);

  return counts;
end
$function$;

grant execute on function public.import_my_data(jsonb) to authenticated;

-- Let a user redo the advanced onboarding, e.g. after switching phones.
create or replace function public.restart_profile_refresh()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  update users set profile_refresh_version = 0 where id = uid;
  return true;
end
$function$;

grant execute on function public.restart_profile_refresh() to authenticated;
