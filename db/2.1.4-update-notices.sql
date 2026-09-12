-- Spoonful 2.1.4 — version-gated update notices ("new update" box in the admin panel)
--
-- Run once in the Supabase SQL editor (project gmfkleugoxafmvprqatk).
--
-- How it works
--   * the admin posts a notice with the NEW version (e.g. 2.1.4) and the GitHub
--     release link,
--   * `latest_update_notice(p_client_version)` only returns it when the client is
--     OLDER than that version — users who already updated get nothing,
--   * the app shows it as a popup with an "Open the release" button. The popup
--     comes back on EVERY app start while the version is older, and disappears
--     on its own once the user has updated (newer clients get an empty result).
--
-- NOTE: if the app reports "Could not find the function
-- public.post_update_notice in the schema cache", this script has not been run
-- (or was run before this file was saved). Run the whole file and the reload at
-- the end refreshes the PostgREST schema cache; alternatively use
-- Dashboard → Project Settings → API → "Reload schema cache".

create table if not exists public.update_notices (
  id          bigserial primary key,
  version     text        not null,
  title       text        not null default 'New update',
  body        text,
  release_url text        not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id) on delete set null
);

create index if not exists update_notices_active_idx on public.update_notices (active, created_at desc);

alter table public.update_notices enable row level security;

-- everyone may read; only admins may write
drop policy if exists update_notices_read on public.update_notices;
create policy update_notices_read on public.update_notices for select using (true);

drop policy if exists update_notices_admin_write on public.update_notices;
create policy update_notices_admin_write on public.update_notices
  for all using (public.is_admin()) with check (public.is_admin());

-- 1) compare two dotted versions: version_gt('2.1.4', '2.1.3') -> true ----------
create or replace function public.version_gt(p_a text, p_b text)
returns boolean
language plpgsql
immutable
as $$
declare
  a text[] := string_to_array(regexp_replace(coalesce(p_a, '0'), '[^0-9.]', '', 'g'), '.');
  b text[] := string_to_array(regexp_replace(coalesce(p_b, '0'), '[^0-9.]', '', 'g'), '.');
  i int;
begin
  for i in 1..greatest(array_length(a, 1), array_length(b, 1)) loop
    if coalesce(nullif(a[i], '')::int, 0) > coalesce(nullif(b[i], '')::int, 0) then return true; end if;
    if coalesce(nullif(a[i], '')::int, 0) < coalesce(nullif(b[i], '')::int, 0) then return false; end if;
  end loop;
  return false;
end;
$$;

-- 2) the app asks: is there a notice for ME? (empty for up-to-date users) ------
create or replace function public.latest_update_notice(p_client_version text default '0')
returns table (
  id bigint, version text, title text, body text, release_url text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.version, n.title, n.body, n.release_url, n.created_at
    from public.update_notices n
   where n.active
     and public.version_gt(n.version, coalesce(nullif(p_client_version, ''), '0'))
   order by n.created_at desc
   limit 1;
$$;

grant execute on function public.latest_update_notice(text) to anon, authenticated;

-- 3) admin: publish a notice ---------------------------------------------------
create or replace function public.post_update_notice(
  p_version text,
  p_url text,
  p_title text default 'New update',
  p_body text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  if coalesce(trim(p_version), '') = '' or coalesce(trim(p_url), '') = '' then
    raise exception 'version and release link are required';
  end if;

  insert into public.update_notices (version, title, body, release_url, created_by)
  values (trim(p_version), coalesce(nullif(trim(p_title), ''), 'New update'), nullif(trim(p_body), ''), trim(p_url), auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.post_update_notice(text, text, text, text) to authenticated;

-- 4) admin: list / deactivate ---------------------------------------------------
create or replace function public.list_update_notices()
returns table (
  id bigint, version text, title text, body text, release_url text, active boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.version, n.title, n.body, n.release_url, n.active, n.created_at
    from public.update_notices n
   where public.is_admin()
   order by n.created_at desc
   limit 30;
$$;

grant execute on function public.list_update_notices() to authenticated;

create or replace function public.deactivate_update_notice(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.update_notices set active = false where id = p_id and public.is_admin();
$$;

grant execute on function public.deactivate_update_notice(bigint) to authenticated;

-- 5) make the new functions visible to the REST API right away ------------------
notify pgrst, 'reload schema';

-- 6) quick self-test: every line must return true ---------------------------------
-- select to_regprocedure('public.latest_update_notice(text)') is not null as has_latest,
--        to_regprocedure('public.post_update_notice(text,text,text,text)') is not null as has_post,
--        to_regprocedure('public.list_update_notices()') is not null as has_list,
--        to_regprocedure('public.deactivate_update_notice(bigint)') is not null as has_deactivate;

-- 7) example: publish the current release (fill in the real tag) ---------------
-- select public.post_update_notice(
--   '2.1.4',
--   'https://github.com/spoonfulyourkitchen/Spoonful/releases/tag/v2.1.4',
--   'New update',
--   'All screens translated, 10 languages, RTL Arabic, update notices.'
-- );
