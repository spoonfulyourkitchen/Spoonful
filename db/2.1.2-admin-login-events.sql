-- Spoonful 2.1.2 — admin-only login notifications
--
-- Run once in the Supabase SQL editor (project gmfkleugoxafmvprqatk).
--
-- Role separation:
--   * every signed-in user may INSERT their own login row through the RPC,
--   * only rows of admins are returned: `admin_login_events()` checks
--     public.is_admin() and returns an empty set for everyone else,
--   * the table itself has no SELECT policy for normal users (RLS default deny),
--     so even a manual query cannot read somebody else's logins.

create table if not exists public.login_events (
  id          bigserial primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text,
  email       text,
  device      text,
  platform    text,
  app_version text,
  logged_at   timestamptz not null default now(),
  seen        boolean     not null default false
);

create index if not exists login_events_time_idx on public.login_events (logged_at desc);

alter table public.login_events enable row level security;

-- Admins may read (and mark as seen) - normal users get nothing.
drop policy if exists login_events_admin_read on public.login_events;
create policy login_events_admin_read on public.login_events
  for select using (public.is_admin());

drop policy if exists login_events_admin_update on public.login_events;
create policy login_events_admin_update on public.login_events
  for update using (public.is_admin()) with check (public.is_admin());

-- Inserts only through the security-definer RPC below (no direct insert policy).

-- 1) called by the app right after a successful sign-in ------------------------
create or replace function public.log_login_event(
  p_device text default '',
  p_platform text default '',
  p_app_version text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;                     -- guests are not logged
  end if;

  insert into public.login_events (user_id, name, email, device, platform, app_version)
  select uid,
         coalesce(u.name, split_part(coalesce(u.email, ''), '@', 1)),
         u.email,
         left(coalesce(p_device, ''), 120),
         left(coalesce(p_platform, ''), 40),
         left(coalesce(p_app_version, ''), 20)
    from (select id, name, email from public.users where id = uid) as u
   limit 1;

  if not found then
    insert into public.login_events (user_id, name, email, device, platform, app_version)
    values (uid, null, null, left(coalesce(p_device, ''), 120), left(coalesce(p_platform, ''), 40), left(coalesce(p_app_version, ''), 20));
  end if;
end;
$$;

grant execute on function public.log_login_event(text, text, text) to authenticated;

-- 2) admin feed: newest logins, empty for non-admins ---------------------------
create or replace function public.admin_login_events(p_limit int default 30)
returns table (
  id bigint, user_id uuid, name text, email text, device text,
  platform text, app_version text, logged_at timestamptz, seen boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.user_id, e.name, e.email, e.device, e.platform, e.app_version, e.logged_at, e.seen
    from public.login_events e
   where public.is_admin()
   order by e.logged_at desc
   limit greatest(1, least(200, coalesce(p_limit, 30)));
$$;

grant execute on function public.admin_login_events(int) to authenticated;

-- 3) "mark all as read" -------------------------------------------------------
create or replace function public.admin_mark_login_events_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.login_events set seen = true where public.is_admin() and seen = false;
$$;

grant execute on function public.admin_mark_login_events_seen() to authenticated;
