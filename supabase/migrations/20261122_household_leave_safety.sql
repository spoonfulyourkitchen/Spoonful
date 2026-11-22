-- Household lifecycle: leaving removes your own household data, and a
-- household without members is deleted with everything that belongs to it.
-- Tables household_* have no foreign key on household_id, so cleanup is explicit.

create or replace function public.household_row_count(p_household uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select (select count(*) from household_members where household_id = p_household)::int;
$$;

create or replace function public.household_purge_member(p_household uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from household_tasks where household_id = p_household and user_id = p_user;
  delete from household_plan where household_id = p_household and user_id = p_user;
  delete from household_notes where household_id = p_household and user_id = p_user;
  delete from household_expenses where household_id = p_household and user_id = p_user;
  delete from household_pantry where household_id = p_household and user_id = p_user;
  delete from household_lists where household_id = p_household and user_id = p_user;
  delete from household_events where household_id = p_household and user_id = p_user;
  delete from household_cooking where household_id = p_household and user_id = p_user;
  delete from household_shared_recipes where household_id = p_household and user_id = p_user;
  delete from household_invites where household_id = p_household and created_by = p_user;
end;
$$;

create or replace function public.household_purge_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from household_tasks where household_id = p_household;
  delete from household_plan where household_id = p_household;
  delete from household_notes where household_id = p_household;
  delete from household_expenses where household_id = p_household;
  delete from household_pantry where household_id = p_household;
  delete from household_lists where household_id = p_household;
  delete from household_events where household_id = p_household;
  delete from household_cooking where household_id = p_household;
  delete from household_shared_recipes where household_id = p_household;
  delete from household_invites where household_id = p_household;
  delete from household_members where household_id = p_household;
  delete from households where id = p_household;
end;
$$;

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select household_id into v_household
  from household_members where user_id = v_user
  order by joined_at nulls last limit 1;

  if v_household is null then
    select household_id into v_household from users where id = v_user;
  end if;

  if v_household is not null then
    perform household_purge_member(v_household, v_user);
    delete from household_members where household_id = v_household and user_id = v_user;
    if household_row_count(v_household) = 0 then
      perform household_purge_household(v_household);
    end if;
  end if;

  delete from household_members where user_id = v_user;
  update users set household_id = null, household_role = null where id = v_user;
  update shopping_list_items set household_id = null where user_id = v_user;

end;
$$;

create or replace function public.join_household(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_invite household_invites;
  v_count integer;
  v_current uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if v_code = '' then
    raise exception 'code required';
  end if;

  select * into v_invite from household_invites where code = v_code;
  if v_invite.household_id is null then
    raise exception 'invite not found';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < (extract(epoch from now()) * 1000)::bigint then
    raise exception 'invite expired';
  end if;

  select household_row_count(v_invite.household_id) into v_count;
  if v_count = 0 then
    perform household_purge_household(v_invite.household_id);
    raise exception 'invite not found';
  end if;

  select household_id into v_current from household_members
  where user_id = v_user order by joined_at nulls last limit 1;

  if v_current is not null and v_current <> v_invite.household_id then
    perform leave_household();
  end if;

  insert into household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user, 'member')
  on conflict (household_id, user_id) do nothing;

  delete from household_members
  where user_id = v_user and household_id <> v_invite.household_id;

  update users set household_id = v_invite.household_id where id = v_user;
  update shopping_list_items set household_id = v_invite.household_id where user_id = v_user;

  return jsonb_build_object('household_id', v_invite.household_id, 'joined', true);
end;
$$;

create or replace function public.create_household(p_name text default 'My household')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
  v_previous uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select household_id into v_previous from household_members
  where user_id = v_user order by joined_at nulls last limit 1;

  if v_previous is not null then
    perform leave_household();
  end if;

  insert into households (name, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'My household'), v_user)
  returning id into v_household;

  insert into household_members (household_id, user_id, role)
  values (v_household, v_user, 'owner');

  update users set household_id = v_household, household_role = 'owner' where id = v_user;
  update shopping_list_items set household_id = v_household where user_id = v_user;

  return jsonb_build_object('household_id', v_household, 'created', true);
end;
$$;

create or replace function public.my_household()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'created_at', h.created_at,
      'owner_id', h.owner_id,
      'is_owner', h.owner_id = auth.uid(),
      'member_count', (select count(*) from household_members m where m.household_id = h.id),
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', u.name, 'role', m.role) order by m.joined_at), '[]'::jsonb)
        from household_members m
        left join users u on u.id = m.user_id
        where m.household_id = h.id
      )
    )
    from households h
    join household_members me on me.household_id = h.id and me.user_id = auth.uid()
    limit 1
  ), null::jsonb);
$$;

create or replace function public.make_household_invite()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
  v_code text;
  v_tries integer := 0;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select household_id into v_household from household_members
  where user_id = v_user order by joined_at nulls last limit 1;

  if v_household is null then
    raise exception 'no household yet';
  end if;

  loop
    v_tries := v_tries + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from household_invites where code = v_code);
    if v_tries > 5 then
      raise exception 'could not create invite';
    end if;
  end loop;

  delete from household_invites
  where household_id = v_household
    and (expires_at is not null and expires_at < (extract(epoch from now()) * 1000)::bigint);

  insert into household_invites (code, household_id, created_by, created_at, expires_at)
  values (v_code, v_household, v_user, (extract(epoch from now()) * 1000)::bigint,
          (extract(epoch from now()) * 1000)::bigint + 7 * 24 * 60 * 60 * 1000);

  return jsonb_build_object('code', v_code, 'household_id', v_household, 'expires_in_days', 7);
end;
$$;

grant execute on function public.leave_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.my_household() to authenticated;
grant execute on function public.make_household_invite() to authenticated;

revoke all on function public.household_purge_member(uuid, uuid) from public;
revoke all on function public.household_purge_household(uuid) from public;
revoke all on function public.household_row_count(uuid) from public;
grant execute on function public.household_purge_member(uuid, uuid) to service_role;
grant execute on function public.household_purge_household(uuid) to service_role;
grant execute on function public.household_row_count(uuid) to service_role;
