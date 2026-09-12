-- Create the public.users row only AFTER the email address has been confirmed.
-- A new auth user stays in auth.users (unconfirmed) without a public profile,
-- so unconfirmed sign-ups never appear in admin user lists or the app.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.users (id, email, name, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'user',
    (extract(epoch from now()) * 1000)::bigint,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row when (new.email_confirmed_at is not null)
execute function public.handle_new_user();

-- Clean up any rows that were created before this fix (only users without data).
delete from public.users u
where exists (select 1 from auth.users a where a.id = u.id and a.email_confirmed_at is null)
  and not exists (select 1 from recipes r where r.user_id = u.id)
  and not exists (select 1 from saved_recipes s where s.user_id = u.id)
  and not exists (select 1 from calorie_entries c where c.user_id = u.id)
  and not exists (select 1 from shopping_list_items i where i.user_id = u.id)
  and not exists (select 1 from shared_recipes sh where sh.owner_id = u.id)
  and not exists (select 1 from collections co where co.user_id = u.id);
