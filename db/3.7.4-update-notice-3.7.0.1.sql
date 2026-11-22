-- 3.7.4 update notice for the new 3.7.0 build
-- Clients on 3.7.0 see it at start, clients on 3.7.0.1 do not.

insert into public.update_notices (version, title, body, release_url, active)
select
  '3.7.0.1',
  'Install the new 3.7.0 build',
  E'A new build of 3.7.0 is ready and has to be installed. It adds the profile update at start: the app asks for the details it now uses, a single tap accepts it and opens the short flow, and the close button appears after 12 seconds.\n\nInstall it over your current version. Account, recipes, tracker and lists stay as they are.',
  'https://github.com/spoonfulyourkitchen/Spoonful/releases/tag/v3.7.0',
  true
where not exists (
  select 1 from public.update_notices where version = '3.7.0.1'
);
