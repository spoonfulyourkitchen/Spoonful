-- 3.7.2 in-app announcement: reinstall required after the signing key was lost.

insert into public.announcements (id, title, body, active, audience, repeat_until_complete, created_at)
values (
  'b7c2f4a1-3d5e-4f60-9a8b-1c2d3e4f5a60',
  'Spoonful 3.7.2: reinstall required',
  E'We lost the signing key of the old versions, so Android cannot update the app that is on your phone. Delete Spoonful and install 3.7.2 again from GitHub.\n\nYour account, saved recipes, tracker entries and lists stay on the server. Local drafts and step photos stored only on the phone are removed with the app.\n\nhttps://github.com/spoonfulyourkitchen/Spoonful/releases/tag/v3.7.2',
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
