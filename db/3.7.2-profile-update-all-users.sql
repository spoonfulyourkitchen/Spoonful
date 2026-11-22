-- 3.7.2 profile update for every current user
-- The same announcement row, now delivered to all signed-in accounts.
-- Complete profiles see it once, incomplete profiles get it again each day.
-- No APK and no web build involved.

alter table public.announcements
  add column if not exists repeat_until_complete boolean not null default false;

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
        when repeat_until_complete and state.incomplete
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
      and state.signed_in
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

update public.announcements
set
  title = 'A few details make it fit better',
  body = E'Spoonful now works with goal, body data, activity, allergies, diet, cooking experience, household size, cooking time and cuisines.\n\nIf any of these are still missing, the app asks for them in a short flow of about two minutes at the next start. Your name stays and existing answers are kept.\n\nThis message comes back on the next start until the profile is complete.',
  audience = 'all',
  repeat_until_complete = true,
  active = true
where id = '3f0a9d42-8c1b-4f5e-9a7d-2b6c1e4f8a10';

insert into public.announcements (id, title, body, active, audience, repeat_until_complete, created_at)
values (
  '3f0a9d42-8c1b-4f5e-9a7d-2b6c1e4f8a10',
  'A few details make it fit better',
  E'Spoonful now works with goal, body data, activity, allergies, diet, cooking experience, household size, cooking time and cuisines.\n\nIf any of these are still missing, the app asks for them in a short flow of about two minutes at the next start. Your name stays and existing answers are kept.\n\nThis message comes back on the next start until the profile is complete.',
  true,
  'all',
  true,
  (extract(epoch from now()) * 1000)::bigint
)
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  active = true,
  audience = excluded.audience,
  repeat_until_complete = excluded.repeat_until_complete;
