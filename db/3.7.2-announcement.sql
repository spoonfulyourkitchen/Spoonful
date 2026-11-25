-- 3.7.2 in-app announcement, title only, no body.

insert into public.announcements (id, title, body, active, audience, repeat_until_complete, created_at)
values (
  'b7c2f4a1-3d5e-4f60-9a8b-1c2d3e4f5a60',
  'New update 3.7.2',
  '',
  true,
  'all',
  false,
  (extract(epoch from now()) * 1000)::bigint
)
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  active = true,
  audience = excluded.audience,
  repeat_until_complete = false;
