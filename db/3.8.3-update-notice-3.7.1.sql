-- 3.8.3 update notice for 3.7.1
-- Clients on older builds see it at start, clients on 3.7.1 do not.
-- No description on purpose: title, version and the release link only.

insert into public.update_notices (version, title, release_url, active)
select
  '3.7.1',
  'Spoonful 3.7.1 is ready',
  'https://github.com/spoonfulyourkitchen/Spoonful/releases/tag/v3.7.1',
  true
where not exists (
  select 1 from public.update_notices where version = '3.7.1'
);
