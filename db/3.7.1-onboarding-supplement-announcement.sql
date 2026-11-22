-- 3.7.1 onboarding supplement announcement
-- Delivered through the app announcement channel, so installed 3.7.0 builds
-- show it without a new APK or web deploy.

alter table public.announcements
  add column if not exists audience text not null default 'all';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'announcements_audience_check'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_audience_check
      check (audience in ('all', 'incomplete_profile'));
  end if;
end $$;

create or replace function public.latest_announcement()
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  with me as (
    select goal, cooking_experience, onboarded_at
    from users
    where id = auth.uid()
  ),
  state as (
    select
      auth.uid() is not null as signed_in,
      case
        when not exists (select 1 from me) then auth.uid() is not null
        else exists (
          select 1 from me
          where coalesce(btrim(goal), '') = ''
             or coalesce(btrim(cooking_experience), '') = ''
             or onboarded_at is null
        )
      end as incomplete
  )
  select to_jsonb(a) from (
    select
      case
        when audience = 'incomplete_profile'
          then md5(
            id::text || '|' || coalesce(auth.uid()::text, 'guest') || '|' || to_char(now() at time zone 'utc', 'YYYY-MM-DD')
          )::uuid
        else id
      end as id,
      title,
      body,
      created_at
    from announcements, state
    where active
      and (
        audience = 'all'
        or (audience = 'incomplete_profile' and state.incomplete)
      )
    order by
      (audience = 'incomplete_profile' and state.incomplete) desc,
      created_at desc
    limit 1
  ) a;
$function$;

insert into public.announcements (id, title, body, active, audience, created_at)
values (
  '3f0a9d42-8c1b-4f5e-9a7d-2b6c1e4f8a10',
  'A few details are still missing',
  E'Your profile is still missing a few details: goal, body data, activity, allergies, diet, cooking experience, household size, cooking time and cuisines.\n\nRecipes, library, daily plan and AI Chef can only fit you when they know these. The app asks for them in a short flow of about two minutes, your name stays and existing answers are kept.\n\nUntil the details are there, this reminder comes back on your next start and stays until the profile is complete.',
  true,
  'incomplete_profile',
  (extract(epoch from now()) * 1000)::bigint
)
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  active = true,
  audience = excluded.audience;
