-- Household safety: leaving removes your own household data, and a household
-- without members is deleted with everything that belongs to it.
-- Schema tolerant: columns are detected before they are used.

create or replace function public.hh_has_column(p_table text, p_column text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  );
$$;

create or replace function public.household_member_count(p_household uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.users where household_id = p_household;
$$;

create or replace function public.household_purge_member(p_household uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'household_id'
      and tb.table_type = 'BASE TABLE'
      and c.table_name <> 'users'
  loop
    if public.hh_has_column(t, 'user_id') then
      execute format('delete from public.%I where household_id = $1 and user_id = $2', t)
        using p_household, p_user;
    elsif public.hh_has_column(t, 'created_by') then
      execute format('delete from public.%I where household_id = $1 and created_by = $2', t)
        using p_household, p_user;
    elsif public.hh_has_column(t, 'author_id') then
      execute format('delete from public.%I where household_id = $1 and author_id = $2', t)
        using p_household, p_user;
    end if;
  end loop;
end;
$$;

create or replace function public.household_purge_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'household_id'
      and tb.table_type = 'BASE TABLE'
      and c.table_name <> 'users'
  loop
    execute format('delete from public.%I where household_id = $1', t) using p_household;
  end loop;

  delete from public.households where id = p_household;
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
  v_remaining int;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select household_id into v_household from public.users where id = v_user;
  if v_household is null then
    return;
  end if;

  perform public.household_purge_member(v_household, v_user);

  update public.users set household_id = null where id = v_user;

  select public.household_member_count(v_household) into v_remaining;

  if v_remaining = 0 then
    perform public.household_purge_household(v_household);
  end if;
end;
$$;

grant execute on function public.leave_household() to authenticated;

revoke all on function public.household_purge_member(uuid, uuid) from public;
revoke all on function public.household_purge_household(uuid) from public;
grant execute on function public.household_purge_member(uuid, uuid) to service_role;
grant execute on function public.household_purge_household(uuid) to service_role;
