-- AI Chef fixes for 3.7.3:
-- 1. Admins listed in admin_emails count as staff, not only users.role.
-- 2. One tap consumes one AI request even when the client retries with the same request id.
-- 3. Tips and the "watch out" note survive saving.

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
      )
      or exists (
        select 1
        from public.admin_emails a
        join public.users u on lower(u.email) = lower(a.email)
        where u.id = p_uid
      );
$$;

alter table public.ai_usage add column if not exists last_request_id text;

drop function if exists public.ai_usage_consume(integer);

create or replace function public.ai_usage_consume(p_limit integer default 3, p_request_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(0, coalesce(p_limit, 3));
  v_used integer;
  v_replay boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', v_limit, 'remaining', v_limit, 'unlimited', true);
  end if;

  if public.spoonful_ai_is_staff(v_uid) then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'remaining', -1, 'unlimited', true);
  end if;

  if p_request_id is not null and length(p_request_id) between 8 and 80 then
    select true, u.used into v_replay, v_used
    from public.ai_usage u
    where u.user_id = v_uid and u.day = current_date and u.last_request_id = p_request_id;

    if coalesce(v_replay, false) then
      return jsonb_build_object(
        'allowed', true,
        'used', v_used,
        'limit', v_limit,
        'remaining', greatest(0, v_limit - v_used),
        'unlimited', false
      );
    end if;
  end if;

  select u.used into v_used
  from public.ai_usage u
  where u.user_id = v_uid and u.day = current_date
  for update;

  if v_used is null then
    insert into public.ai_usage (user_id, day, used, last_request_id)
    values (v_uid, current_date, 1, p_request_id)
    on conflict (user_id, day) do nothing;
    v_used := 1;
  elsif v_used < v_limit then
    update public.ai_usage
       set used = used + 1, updated_at = now(), last_request_id = p_request_id
     where user_id = v_uid and day = current_date;
    v_used := v_used + 1;
  else
    return jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit, 'remaining', 0, 'unlimited', false);
  end if;

  if v_used > v_limit then
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

grant execute on function public.ai_usage_consume(integer, text) to anon, authenticated;

alter table public.saved_recipes add column if not exists tips jsonb not null default '[]'::jsonb;
alter table public.saved_recipes add column if not exists ai_note text;
