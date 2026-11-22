

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ml integer not null check (ml > 0 and ml <= 5000),
  logged_at timestamptz not null default now()
);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, logged_at desc);
alter table public.water_logs enable row level security;
create policy "water_logs_own" on public.water_logs for all using (auth.uid() = user_id);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 400),
  logged_at timestamptz not null default now()
);
create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, logged_at desc);
alter table public.weight_logs enable row level security;
create policy "weight_logs_own" on public.weight_logs for all using (auth.uid() = user_id);

create or replace function public.tracker_water_today(p_user_id uuid)
returns table (total_ml integer) language plpgsql security definer set search_path = public as $$
begin
  return query
  select coalesce(sum(ml), 0)::integer as total_ml
  from public.water_logs
  where user_id = tracker_water_today.p_user_id
    and logged_at >= date_trunc('day', now())
    and logged_at < date_trunc('day', now()) + interval '1 day';
end; $$;

create or replace function public.tracker_add_water(p_user_id uuid, p_ml integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.water_logs (user_id, ml, logged_at)
  values (tracker_add_water.p_user_id, tracker_add_water.p_ml, now());
end; $$;

create or replace function public.tracker_remove_water(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.water_logs
  where user_id = tracker_remove_water.p_user_id
    and logged_at >= date_trunc('day', now())
    and logged_at < date_trunc('day', now()) + interval '1 day';
end; $$;

create or replace function public.tracker_weights(p_user_id uuid, p_limit integer default 60)
returns table (
  id uuid,
  weight_kg numeric,
  logged_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select id, weight_kg, logged_at
  from public.weight_logs
  where user_id = tracker_weights.p_user_id
  order by logged_at desc
  limit tracker_weights.p_limit;
end; $$;

create or replace function public.tracker_add_weight(p_user_id uuid, p_weight_kg numeric, p_logged_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.weight_logs (user_id, weight_kg, logged_at)
  values (tracker_add_weight.p_user_id, tracker_add_weight.p_weight_kg, tracker_add_weight.p_logged_at);
end; $$;

grant execute on function public.tracker_water_today(uuid) to authenticated;
grant execute on function public.tracker_add_water(uuid, integer) to authenticated;
grant execute on function public.tracker_remove_water(uuid) to authenticated;
grant execute on function public.tracker_weights(uuid, integer) to authenticated;
grant execute on function public.tracker_add_weight(uuid, numeric, timestamptz) to authenticated;

grant select, insert, delete on public.water_logs to authenticated;
grant select, insert on public.weight_logs to authenticated;