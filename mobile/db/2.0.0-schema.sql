-- Spoonful 2.0.0 database schema (batch 1)
-- Onboarding profile, household/shared shopping list, community extras,
-- water logs, shopping extras, fuzzy catalog search.
-- Documented from the live Supabase project (eu-west-1) so the schema can be recreated.

-- New columns
alter table public.shopping_list_items add column if not exists category text;
alter table public.shopping_list_items add column if not exists course text;
alter table public.shopping_list_items add column if not exists have boolean;
alter table public.shopping_list_items add column if not exists household_id uuid;
alter table public.shopping_list_items add column if not exists price numeric;
alter table public.users add column if not exists allergies ARRAY;
alter table public.users add column if not exists diet text;
alter table public.users add column if not exists goal text;
alter table public.users add column if not exists household_id uuid;
alter table public.users add column if not exists onboarded_at bigint;
alter table public.users add column if not exists region text;
alter table public.users add column if not exists water_goal_ml integer;

-- Row level security policies
-- policy challenge_entries_delete (DELETE) on challenge_entries
-- policy challenge_entries_read (SELECT) on challenge_entries
-- policy challenge_entries_write (INSERT) on challenge_entries
-- policy challenges_insert (INSERT) on challenges
-- policy challenges_read (SELECT) on challenges
-- policy challenges_update (UPDATE) on challenges
-- policy household_invites_read (SELECT) on household_invites
-- policy household_members_leave (DELETE) on household_members
-- policy household_members_read (SELECT) on household_members
-- policy households_delete (DELETE) on households
-- policy households_read (SELECT) on households
-- policy households_write (UPDATE) on households
-- policy reposts_delete (DELETE) on recipe_reposts
-- policy reposts_read (SELECT) on recipe_reposts
-- policy reposts_write (INSERT) on recipe_reposts
-- policy shopping_items_household (ALL) on shopping_list_items
-- policy shopping_list_delete_own (DELETE) on shopping_list_items
-- policy shopping_list_insert_own (INSERT) on shopping_list_items
-- policy shopping_list_select_own (SELECT) on shopping_list_items
-- policy shopping_list_update_own (UPDATE) on shopping_list_items
-- policy corrections_insert (INSERT) on translation_corrections
-- policy corrections_read (SELECT) on translation_corrections
-- policy blocks_own (ALL) on user_blocks
-- policy water_logs_own (ALL) on water_logs

-- Functions
CREATE OR REPLACE FUNCTION public.catalog_page(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := lower(coalesce(nullif(p->>'search', ''), ''));
  c text := lower(coalesce(nullif(p->>'cuisine', ''), ''));
  m text := lower(coalesce(nullif(p->>'mealType', ''), ''));
  diff text := lower(coalesce(nullif(p->>'difficulty', ''), ''));
  sort text := lower(coalesce(nullif(p->>'sort', ''), ''));
  tr text := coalesce(nullif(p->>'timeRange', ''), '');
  cr text := coalesce(nullif(p->>'calories', ''), '');
  terms text[] := coalesce((select array_agg(lower(t)) from jsonb_array_elements_text(coalesce(p->'terms', '[]'::jsonb)) t), '{}');
  minm int := greatest(1, coalesce((p->>'minMatch')::int, 1));
  lim int := greatest(1, coalesce((p->>'limit')::int, 24));
  off int := greatest(0, coalesce((p->>'offset')::int, 0));
  total bigint;
  items jsonb;
begin
  drop table if exists _cf;
  create temp table _cf on commit drop as
  select r.*, public.catalog_terms_match(r, terms) as match_score
  from public.recipes r
  where (q = ''
      or lower(r.title) like '%' || q || '%'
      or lower(coalesce(r.description, '')) like '%' || q || '%'
      or word_similarity(q, lower(r.title)) >= 0.6
      or exists (select 1 from jsonb_array_elements_text(coalesce(r.ingredients, '[]'::jsonb)) i
                 where lower(i) like '%' || q || '%' or word_similarity(q, lower(i)) >= 0.6)
      or exists (select 1 from jsonb_array_elements_text(coalesce(r.steps, '[]'::jsonb)) s
                 where lower(s) like '%' || q || '%' or word_similarity(q, lower(s)) >= 0.6))
    and (c = '' or lower(coalesce(r.cuisine, '')) = c)
    and (m = '' or lower(coalesce(r.meal_type, '')) = m)
    and (diff = '' or lower(coalesce(r.difficulty, 'medium')) = diff)
    and (array_length(terms, 1) is null or public.catalog_terms_match(r, terms) >= minm)
    and (
      coalesce(jsonb_array_length(coalesce(p->'diets', '[]'::jsonb)), 0) = 0
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
  from (
    select * from _cf
    order by
      case when sort = 'match' then match_score end desc nulls last,
      case when sort = 'quick' then coalesce(prep_time, 0) + coalesce(cook_time, 0) end asc nulls last,
      case when sort = 'calories' then coalesce(calories, 99999) end asc nulls last,
      case when sort = 'newest' then extract(epoch from created_at) end desc nulls last,
      title asc, id asc
    limit lim offset off) x;

  return jsonb_build_object('items', items, 'total', total, 'offset', off, 'hasMore', (off + lim) < total);
end;
$function$;

CREATE OR REPLACE FUNCTION public.catalog_terms_match(rec recipes, terms text[])
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce((
    select count(*) from unnest(terms) as t(term)
    where lower(coalesce(rec.title, '')) like '%' || term || '%'
       or lower(coalesce(rec.description, '')) like '%' || term || '%'
       or exists (select 1 from jsonb_array_elements_text(coalesce(rec.ingredients, '[]'::jsonb)) i where lower(i) like '%' || term || '%')
       or exists (select 1 from jsonb_array_elements_text(coalesce(rec.steps, '[]'::jsonb)) s where lower(s) like '%' || term || '%')
  ), 0);
$function$;

CREATE OR REPLACE FUNCTION public.community_page(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sort text := lower(coalesce(nullif(p->>'sort', ''), 'newest'));
  region text := lower(coalesce(nullif(p->>'region', ''), ''));
  lim int := greatest(1, coalesce((p->>'limit')::int, 20));
  off int := greatest(0, coalesce((p->>'offset')::int, 0));
  q text := lower(coalesce(nullif(p->>'search', ''), ''));
  uid uuid := auth.uid();
  total bigint;
  items jsonb;
begin
  drop table if exists _cr;
  create temp table _cr on commit drop as
  select sr.*, coalesce(u.region, '') as owner_region,
         (select count(*) from share_comments c where c.shared_recipe_id = sr.id) as comment_count,
         (select count(*) from share_photos ph where ph.shared_recipe_id = sr.id) as photo_count,
         (select count(*) from recipe_reviews rv where rv.shared_recipe_id = sr.id) as review_count
  from public.shared_recipes sr
  left join public.users u on u.id = sr.owner_id
  where coalesce(sr.status, 'approved') = 'approved'
    and (q = '' or lower(sr.title) like '%' || q || '%' or lower(coalesce(sr.description, '')) like '%' || q || '%')
    and not exists (select 1 from public.user_blocks b where b.user_id = uid and b.blocked_id = sr.owner_id);

  select count(*) into total from _cr;
  select coalesce(jsonb_agg(row_to_json(x) order by x.title), '[]'::jsonb) into items
  from (
    select * from _cr
    order by
      case when sort = 'rating' then coalesce(rating_average, 0) end desc nulls last,
      case when sort = 'likes' then coalesce(likes_count, 0) end desc nulls last,
      case when sort = 'near' and region <> '' and lower(owner_region) = region then 0 else 1 end asc,
      created_at desc nulls last,
      title asc
    limit lim offset off) x;

  return jsonb_build_object('items', items, 'total', total, 'offset', off, 'hasMore', (off + lim) < total);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_household(p_name text DEFAULT 'My household'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); hid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id into hid from household_members where user_id = uid limit 1;
  if hid is not null then return jsonb_build_object('household_id', hid, 'created', false); end if;
  insert into households (name, owner_id) values (coalesce(nullif(p_name, ''), 'My household'), uid) returning id into hid;
  insert into household_members (household_id, user_id, role) values (hid, uid, 'owner');
  update users set household_id = hid where id = uid;
  update shopping_list_items set household_id = hid where user_id = uid;
  return jsonb_build_object('household_id', hid, 'created', true);
end $function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from share_comments where user_id = uid;
  delete from share_photos where user_id = uid;
  delete from content_reports where reporter_id = uid;
  delete from cook_follows where follower_id = uid or following_id = uid;
  delete from recipe_likes where user_id = uid;
  delete from recipe_reviews where user_id = uid;
  delete from calorie_entries where user_id = uid;
  delete from shopping_list_items where user_id = uid;
  delete from weight_logs where user_id = uid;
  delete from collections where user_id = uid;
  delete from saved_recipes where user_id = uid;
  delete from user_recipes where user_id = uid;
  delete from feedback where user_id = uid;
  delete from shared_recipes where owner_id = uid;
  delete from users where id = uid;
  delete from auth.users where id = uid;
end $function$;

CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select jsonb_build_object(
    'exported_at', (extract(epoch from now())*1000)::bigint,
    'user_id', uid,
    'profile', (select to_jsonb(p) from (select id, name, email, role, cooking_experience, created_at from users where id = uid) p),
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
end $function$;

CREATE OR REPLACE FUNCTION public.is_household_member(hid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select hid is not null and exists (select 1 from household_members m where m.household_id = hid and m.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.join_household(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); inv record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from household_invites where code = upper(trim(p_code));
  if inv is null then raise exception 'invite not found'; end if;
  if inv.expires_at is not null and inv.expires_at < (extract(epoch from now()) * 1000)::bigint then
    raise exception 'invite expired';
  end if;
  insert into household_members (household_id, user_id, role) values (inv.household_id, uid, 'member')
    on conflict (household_id, user_id) do nothing;
  update users set household_id = inv.household_id where id = uid;
  update shopping_list_items set household_id = inv.household_id where user_id = uid;
  return jsonb_build_object('household_id', inv.household_id, 'joined', true);
end $function$;

CREATE OR REPLACE FUNCTION public.leave_household()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); hid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id into hid from household_members where user_id = uid limit 1;
  delete from household_members where user_id = uid;
  update users set household_id = null where id = uid;
  update shopping_list_items set household_id = null where user_id = uid;
  if hid is not null and not exists (select 1 from household_members where household_id = hid) then
    delete from households where id = hid;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.make_household_invite()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); hid uuid; code text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select household_id into hid from household_members where user_id = uid limit 1;
  if hid is null then raise exception 'no household yet'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into household_invites (code, household_id, created_by, expires_at)
  values (code, hid, uid, (extract(epoch from now()) * 1000)::bigint + 7 * 24 * 60 * 60 * 1000);
  return jsonb_build_object('code', code, 'household_id', hid);
end $function$;

CREATE OR REPLACE FUNCTION public.my_household()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'owner_id', h.owner_id,
      'is_owner', h.owner_id = auth.uid(),
      'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', u.name, 'role', m.role)), '[]'::jsonb)
                  from household_members m left join users u on u.id = m.user_id where m.household_id = h.id)
    )
    from households h
    join household_members me on me.household_id = h.id and me.user_id = auth.uid()
    limit 1
  ), null::jsonb);
$function$;
