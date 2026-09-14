-- Spoonful 3.2.0 — geteilte Einkaufslisten im Haushalt (max. 2)
--
-- Eine Person tippt in ihrer Einkaufsliste auf "Zum Haushalt": ihre Posten
-- wandern in eine Haushalts-Liste, die alle sehen und abhaken können. Pro
-- Haushalt sind höchstens ZWEI solche Listen erlaubt.
--
-- Einmal im Supabase SQL Editor ausführen. Fehlt das SQL, bleibt die App
-- benutzbar - "Zum Haushalt" meldet dann nur, dass es nicht geklappt hat.

create table if not exists public.household_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  owner_name   text not null default '',
  title        text not null default '',
  -- [{ "name": "Milch", "checked": false }, ...]
  items        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists household_lists_hh_idx on public.household_lists (household_id, created_at desc);

alter table public.household_lists enable row level security;

drop policy if exists household_lists_hh_all on public.household_lists;
create policy household_lists_hh_all on public.household_lists
  for all to authenticated
  using (household_id = public.my_household_id() or user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.my_household_id());

/* ── Liste teilen (prüft das Limit von 2) ─────────────────────────────────── */
create or replace function public.share_household_list(p_title text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  count_lists int;
  new_id uuid;
  my_name text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  hid := public.my_household_id();
  if hid is null then
    raise exception 'no household';
  end if;

  select count(*) into count_lists from public.household_lists where household_id = hid;
  if count_lists >= 2 then
    raise exception 'household list limit reached';
  end if;

  select coalesce(name, split_part(coalesce(email, ''), '@', 1)) into my_name from public.users where id = auth.uid();

  insert into public.household_lists (household_id, user_id, owner_name, title, items, updated_at)
  values (hid, auth.uid(), coalesce(my_name, ''), left(coalesce(p_title, ''), 80), coalesce(p_items, '[]'::jsonb), now())
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.share_household_list(text, jsonb) to authenticated;

/* ── Alle Listen des Haushalts ───────────────────────────────────────────── */
create or replace function public.household_lists_state()
returns table (id uuid, user_id uuid, owner_name text, title text, items jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select l.id, l.user_id, l.owner_name, l.title, l.items, l.created_at
      from public.household_lists l
     where l.household_id = public.my_household_id()
     order by l.created_at desc;
end;
$$;

grant execute on function public.household_lists_state() to authenticated;

/* ── Liste ändern (abhaken / löschen) ────────────────────────────────────── */
create or replace function public.update_household_list(p_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.household_lists
     set items = coalesce(p_items, '[]'::jsonb),
         updated_at = now()
   where id = p_id
     and household_id = public.my_household_id();
end;
$$;

grant execute on function public.update_household_list(uuid, jsonb) to authenticated;

create or replace function public.remove_household_list(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.household_lists
   where id = p_id
     and (household_id = public.my_household_id() or user_id = auth.uid());
end;
$$;

grant execute on function public.remove_household_list(uuid) to authenticated;

notify pgrst, 'reload schema';
