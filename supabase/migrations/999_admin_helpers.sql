create or replace function public.guard_admin()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied for admin operation';
  end if;
end;
$$;
--SPLIT--
create or replace function public.admin_list_users()
returns setof public.users
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  return query select * from public.users order by created_at desc;
end;
$$;
--SPLIT--
create or replace function public.admin_list_feedback()
returns table (id uuid, user_name text, user_email text, rating bigint, text text, read boolean, created_at bigint)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  return query
    select f.id, f.user_name, f.user_email, f.rating, f.text, f.read, f.created_at
    from public.feedback f
    order by f.created_at desc;
end;
$$;
--SPLIT--
create or replace function public.admin_list_image_reports()
returns table (id uuid, recipe_key text, recipe_title text, image_url text, reason text, message text, status text, created_at bigint, reporter_name text, reporter_email text)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  return query
    select r.id, r.recipe_key, r.recipe_title, r.image_url, r.reason, r.message, r.status, r.created_at,
           u.name as reporter_name, u.email as reporter_email
    from public.image_reports r
    left join public.users u on u.id = r.user_id
    order by r.created_at desc;
end;
$$;
--SPLIT--
create or replace function public.admin_open_report_count()
returns bigint
language plpgsql security definer set search_path = public
as $$
declare n bigint;
begin
  perform public.guard_admin();
  select count(*) into n from public.image_reports where status = 'open';
  return n;
end;
$$;
create or replace function public.admin_toggle_admin(target_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  update public.users
     set role = case when role = 'admin' then 'user' else 'admin' end,
         updated_at = (extract(epoch from now()) * 1000)::bigint
   where id = target_user_id;
end;
$$;
--SPLIT--
create or replace function public.admin_add_email(em text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  insert into public.admin_emails (email)
  values (lower(trim(em)))
  on conflict (email) do nothing;
end;
$$;
--SPLIT--
create or replace function public.admin_remove_email(em text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_admin();
  delete from public.admin_emails where lower(email) = lower(trim(em));
end;
$$;
--SPLIT--
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic']::text[])
on conflict (id) do update set public = true, file_size_limit = 5242880;
--SPLIT--
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'recipe_images_insert_own') then
    create policy "recipe_images_insert_own" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'recipe_images_update_own') then
    create policy "recipe_images_update_own" on storage.objects
      for update to authenticated
      using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

