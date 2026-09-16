-- 3.2.3: KI-Tageslimit für die App (3 Nutzungen pro Tag für alle Nutzer,
-- Moderatoren und Admins ausgenommen). Alle drei Chef-Funktionen zählen
-- zusammen, weil jede von ihnen hier durchläuft.

create table if not exists public.ai_usage (
  user_id uuid not null,
  day date not null default current_date,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Lesen darf jeder nur seine eigene Zeile; geschrieben wird ausschließlich
-- über die Funktionen unten (security definer).
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage
  for select using (auth.uid() = user_id);

create index if not exists ai_usage_day_idx on public.ai_usage (day);

-- Moderatoren/Admins haben kein Limit.
create or replace function public.spoonful_ai_is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_uid
      and lower(coalesce(u.role, '')) in ('admin', 'mod', 'moderator', 'owner')
  );
$$;

-- Eine Nutzung verbrauchen: allowed=false, wenn das Tageslimit erreicht ist.
create or replace function public.ai_usage_consume(p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(0, coalesce(p_limit, 3));
  v_used integer;
begin
  if v_uid is null then
    -- ohne Anmeldung nicht zählbar: die App verlangt ohnehin ein Konto
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', v_limit, 'remaining', v_limit, 'unlimited', true);
  end if;

  if public.spoonful_ai_is_staff(v_uid) then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'remaining', -1, 'unlimited', true);
  end if;

  select u.used into v_used
  from public.ai_usage u
  where u.user_id = v_uid and u.day = current_date
  for update;

  if v_used is null then
    insert into public.ai_usage (user_id, day, used)
    values (v_uid, current_date, 1)
    on conflict (user_id, day) do nothing;
    v_used := 1;
  elsif v_used < v_limit then
    update public.ai_usage
       set used = used + 1, updated_at = now()
     where user_id = v_uid and day = current_date;
    v_used := v_used + 1;
  else
    return jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit, 'remaining', 0, 'unlimited', false);
  end if;

  if v_used > v_limit then
    /* zwei Anfragen gleichzeitig: nie über das Limit hinausrechnen */
    update public.ai_usage set used = v_limit
     where user_id = v_uid and day = current_date;
    return jsonb_build_object('allowed', false, 'used', v_limit, 'limit', v_limit, 'remaining', 0, 'unlimited', false);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used),
    'unlimited', false
  );
end;
$$;

-- Zählerstand für die Anzeige im App-Kopf (ohne etwas zu verbrauchen).
create or replace function public.ai_usage_today(p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(0, coalesce(p_limit, 3));
  v_used integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('used', 0, 'limit', v_limit, 'remaining', v_limit, 'unlimited', true);
  end if;

  if public.spoonful_ai_is_staff(v_uid) then
    return jsonb_build_object('used', 0, 'limit', -1, 'remaining', -1, 'unlimited', true);
  end if;

  select coalesce(u.used, 0) into v_used
  from public.ai_usage u
  where u.user_id = v_uid and u.day = current_date;

  v_used := coalesce(v_used, 0);
  return jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used),
    'unlimited', false
  );
end;
$$;

grant execute on function public.ai_usage_consume(integer) to anon, authenticated;
grant execute on function public.ai_usage_today(integer) to anon, authenticated;
