-- 3.7.3 server switch for the profile refresh
-- Every account that exists before this migration is due once, new accounts are not.
-- The app reads the flag through profile_refresh_due() and clears it with
-- complete_profile_refresh() when the refresh is finished.

do $$
declare had_column boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'profile_refresh_version'
  ) into had_column;

  if not had_column then
    alter table public.users
      add column profile_refresh_version integer not null default 1;
    update public.users set profile_refresh_version = 0;
  end if;
end $$;

create or replace function public.profile_refresh_due()
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select profile_refresh_version < 1 from users where id = auth.uid()),
    false
  );
$function$;

create or replace function public.complete_profile_refresh()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  update users set profile_refresh_version = 1 where id = uid;
  return true;
end
$function$;

grant execute on function public.profile_refresh_due() to anon, authenticated;
grant execute on function public.complete_profile_refresh() to authenticated;
