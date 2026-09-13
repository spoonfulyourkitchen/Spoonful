-- Spoonful 3.0.0 — gemeinsam kochen im Haushalt
--
-- Verbindet den Kochmodus mit dem Haushalt: jeder sieht, bei welchem Schritt
-- die anderen gerade sind ("Familienmodus"), und kann dorthin springen.
-- Ohne Haushalt passiert nichts (dann ist household_id null).
--
-- Einmal im Supabase SQL Editor ausführen.

create table if not exists public.household_cooking (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  recipe_key   text        not null,
  title        text        not null default '',
  step_index   int         not null default 0,
  step_total   int         not null default 1,
  done_steps   int         not null default 0,
  updated_at   timestamptz not null default now(),
  unique (user_id)          -- eine aktive Koch-Session pro Nutzer
);

create index if not exists household_cooking_hh_idx on public.household_cooking (household_id, updated_at desc);

alter table public.household_cooking enable row level security;

-- Schreiben darf jeder nur seine eigene Zeile,
-- lesen darf man den eigenen Haushalt (und immer die eigene Zeile).
drop policy if exists household_cooking_write_own on public.household_cooking;
create policy household_cooking_write_own on public.household_cooking
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists household_cooking_read_household on public.household_cooking;
create policy household_cooking_read_household on public.household_cooking
  for select to authenticated
  using (
    user_id = auth.uid()
    or household_id = (select u.household_id from public.users u where u.id = auth.uid())
  );

-- Koch-Fortschritt setzen/aktualisieren
create or replace function public.set_cooking_state(
  p_recipe_key text,
  p_title text,
  p_step int,
  p_total int,
  p_done int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  select household_id into hid from public.users where id = auth.uid();
  if hid is null then
    raise exception 'no household';
  end if;

  insert into public.household_cooking (household_id, user_id, recipe_key, title, step_index, step_total, done_steps, updated_at)
  values (
    hid, auth.uid(),
    left(coalesce(p_recipe_key, ''), 120),
    left(coalesce(p_title, ''), 120),
    greatest(0, coalesce(p_step, 0)),
    greatest(1, coalesce(p_total, 1)),
    greatest(0, coalesce(p_done, 0)),
    now()
  )
  on conflict (user_id) do update set
    household_id = excluded.household_id,
    recipe_key   = excluded.recipe_key,
    title        = excluded.title,
    step_index   = excluded.step_index,
    step_total   = excluded.step_total,
    done_steps   = excluded.done_steps,
    updated_at   = now();
end;
$$;

grant execute on function public.set_cooking_state(text, text, int, int, int) to authenticated;

-- Wer kocht gerade was im Haushalt? (nur die letzten 12 Stunden)
create or replace function public.household_cooking_state()
returns table (
  user_id uuid, name text, recipe_key text, title text,
  step_index int, step_total int, done_steps int, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.user_id,
         coalesce(u.name, split_part(coalesce(u.email, ''), '@', 1)) as name,
         c.recipe_key, c.title, c.step_index, c.step_total, c.done_steps, c.updated_at
    from public.household_cooking c
    left join public.users u on u.id = c.user_id
   where c.updated_at > now() - interval '12 hours'
     and c.household_id = (select u2.household_id from public.users u2 where u2.id = auth.uid())
   order by c.updated_at desc;
$$;

grant execute on function public.household_cooking_state() to authenticated;

-- Koch-Session beenden (z. B. beim Verlassen des Kochmodus)
create or replace function public.stop_cooking_state()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.household_cooking where user_id = auth.uid();
$$;

grant execute on function public.stop_cooking_state() to authenticated;

notify pgrst, 'reload schema';
