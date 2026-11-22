

alter table public.users add column if not exists household_role text default 'member';

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.users where id = auth.uid();
$$;

grant execute on function public.my_household_id() to authenticated;

create or replace function public.household_members()
returns table (user_id uuid, name text, email text, image text, role text, household_role text, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select u.id,
           coalesce(u.name, split_part(coalesce(u.email, ''), '@', 1)) as name,
           u.email,
           u.image,
           u.role,
           coalesce(u.household_role, 'member') as household_role,
           (select max(c.updated_at) from public.household_cooking c where c.user_id = u.id) as last_seen
      from public.users u
     where u.household_id = public.my_household_id()
     order by (coalesce(u.household_role, 'member') = 'admin') desc, 2;
end;
$$;

grant execute on function public.household_members() to authenticated;

create or replace function public.set_household_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  my_role text;
begin
  hid := public.my_household_id();
  if hid is null then
    raise exception 'no household';
  end if;
  select coalesce(household_role, 'member') into my_role from public.users where id = auth.uid();
  if my_role <> 'admin' then
    raise exception 'only admins can change roles';
  end if;
  update public.users
     set household_role = case when p_role = 'admin' then 'admin' else 'member' end
   where id = p_user_id
     and household_id = hid;
end;
$$;

grant execute on function public.set_household_role(uuid, text) to authenticated;

create or replace function public.rename_household(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  hid := public.my_household_id();
  if hid is null then
    raise exception 'no household';
  end if;
  update public.households set name = left(coalesce(p_name, ''), 80) where id = hid;
end;
$$;

grant execute on function public.rename_household(text) to authenticated;

create or replace function public.household_stats()
returns table (members int, cooking_sessions int, tasks_open int, tasks_done int, expenses_sum numeric, pantry_items int, plan_entries int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  hid := public.my_household_id();
  if hid is null then
    return;
  end if;
  return query
    select
      (select count(*)::int from public.users u where u.household_id = hid),
      (select count(*)::int from public.household_cooking c where c.household_id = hid),
      (select count(*)::int from public.household_tasks t where t.household_id = hid and t.done = false),
      (select count(*)::int from public.household_tasks t where t.household_id = hid and t.done = true),
      (select coalesce(sum(e.amount), 0) from public.household_expenses e where e.household_id = hid),
      (select count(*)::int from public.household_pantry p where p.household_id = hid),
      (select count(*)::int from public.household_plan pl where pl.household_id = hid);
end;
$$;

grant execute on function public.household_stats() to authenticated;

create table if not exists public.household_notes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_name  text not null default '',
  body         text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.household_tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default '',
  done         boolean not null default false,
  assigned_to  uuid,
  assigned_name text,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);

create table if not exists public.household_plan (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  day          int  not null default 1,
  slot         text not null default 'dinner',
  title        text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.household_pantry (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default '',
  qty          text,
  expires_on   date,
  created_at   timestamptz not null default now()
);

create table if not exists public.household_expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payer_name   text not null default '',
  title        text not null default '',
  amount       numeric(10,2) not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.household_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  actor_name   text not null default '',
  kind         text not null default 'info',
  text         text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.household_shared_recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  recipe_key   text not null default '',
  title        text not null default '',
  image_url    text,
  created_at   timestamptz not null default now(),
  unique (household_id, recipe_key)
);

create index if not exists household_notes_hh_idx on public.household_notes (household_id, created_at desc);
create index if not exists household_tasks_hh_idx on public.household_tasks (household_id, done, created_at desc);
create index if not exists household_plan_hh_idx on public.household_plan (household_id, day);
create index if not exists household_pantry_hh_idx on public.household_pantry (household_id, created_at desc);
create index if not exists household_expenses_hh_idx on public.household_expenses (household_id, created_at desc);
create index if not exists household_events_hh_idx on public.household_events (household_id, created_at desc);
create index if not exists household_shared_hh_idx on public.household_shared_recipes (household_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'household_notes', 'household_tasks', 'household_plan',
    'household_pantry', 'household_expenses', 'household_events',
    'household_shared_recipes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (household_id = public.my_household_id() or user_id = auth.uid()) with check (user_id = auth.uid() and household_id = public.my_household_id())',
      t || '_hh_all', t
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';

