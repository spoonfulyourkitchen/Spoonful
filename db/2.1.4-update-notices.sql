

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

drop policy if exists update_notices_read on public.update_notices;
create policy update_notices_read on public.update_notices for select using (true);

drop policy if exists update_notices_admin_write on public.update_notices;
create policy update_notices_admin_write on public.update_notices
  for all using (public.is_admin()) with check (public.is_admin());

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

notify pgrst, 'reload schema';

