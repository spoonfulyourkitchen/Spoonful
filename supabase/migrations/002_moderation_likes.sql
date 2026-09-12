-- Spoonful community moderation + likes + moderators
alter table public.shared_recipes add column if not exists status text not null default 'pending';
alter table public.shared_recipes add column if not exists rejection_reason text;
alter table public.shared_recipes add column if not exists rejection_note text;
alter table public.shared_recipes add column if not exists reviewed_at bigint;
alter table public.shared_recipes add column if not exists likes_count bigint not null default 0;
--SPLIT--
create table if not exists public.recipe_likes (
  shared_recipe_id uuid not null references public.shared_recipes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at bigint not null,
  primary key (shared_recipe_id, user_id)
);
alter table public.recipe_likes enable row level security;
--SPLIT--
create policy "recipe_likes_select_all" on public.recipe_likes for select using (true);
create policy "recipe_likes_insert_own" on public.recipe_likes for insert with check (user_id = auth.uid());
create policy "recipe_likes_delete_own" on public.recipe_likes for delete using (user_id = auth.uid());
--SPLIT--
create or replace function public.is_mod()
returns boolean
language sql security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'mod'
  );
$$;
--SPLIT--
drop policy if exists "shared_recipes_select_all" on public.shared_recipes;
create policy "shared_recipes_select_all" on public.shared_recipes
  for select using (status = 'approved');
create policy "shared_recipes_select_own" on public.shared_recipes
  for select using (owner_id = auth.uid());
create policy "shared_recipes_select_mod" on public.shared_recipes
  for select to authenticated using (public.is_mod());
--SPLIT--
drop policy if exists "feedback_select_own_or_admin" on public.feedback;
drop policy if exists "feedback_update_admin" on public.feedback;
drop policy if exists "feedback_delete_admin" on public.feedback;
create policy "feedback_select_own_or_admin" on public.feedback
  for select using ((user_id = auth.uid()) or public.is_mod());
create policy "feedback_update_mod" on public.feedback
  for update to authenticated using (public.is_mod());
create policy "feedback_delete_mod" on public.feedback
  for delete to authenticated using (public.is_mod());
--SPLIT--
drop policy if exists "image_reports_select_own_or_admin" on public.image_reports;
drop policy if exists "image_reports_update_admin" on public.image_reports;
drop policy if exists "image_reports_delete_admin" on public.image_reports;
create policy "image_reports_select_own_or_mod" on public.image_reports
  for select using ((user_id = auth.uid()) or public.is_mod());
create policy "image_reports_update_mod" on public.image_reports
  for update to authenticated using (public.is_mod());
create policy "image_reports_delete_mod" on public.image_reports
  for delete to authenticated using (public.is_mod());
--SPLIT--
create or replace function public.admin_list_pending_shares()
returns setof public.shared_recipes
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_mod() then
    raise exception 'permission denied';
  end if;
  return query select * from public.shared_recipes
   where status = 'pending'
   order by created_at asc;
end;
$$;
--SPLIT--
create or replace function public.admin_review_share(share_id uuid, approved boolean, reason text default null, note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_mod() then
    raise exception 'permission denied';
  end if;
  update public.shared_recipes
     set status = case when approved then 'approved' else 'rejected' end,
         rejection_reason = case when approved then null else coalesce(reason, 'other') end,
         rejection_note = case when approved then null else note end,
         reviewed_at = (extract(epoch from now()) * 1000)::bigint,
         updated_at = (extract(epoch from now()) * 1000)::bigint
   where id = share_id;
end;
$$;
--SPLIT--
create or replace function public.share_like(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.recipe_likes (shared_recipe_id, user_id, created_at)
  values (target, auth.uid(), (extract(epoch from now()) * 1000)::bigint)
  on conflict do nothing;
  update public.shared_recipes s
     set likes_count = (select count(*) from public.recipe_likes l where l.shared_recipe_id = s.id)
   where s.id = target;
end;
$$;
--SPLIT--
create or replace function public.share_unlike(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.recipe_likes where shared_recipe_id = target and user_id = auth.uid();
  update public.shared_recipes s
     set likes_count = (select count(*) from public.recipe_likes l where l.shared_recipe_id = s.id)
   where s.id = target;
end;
$$;
