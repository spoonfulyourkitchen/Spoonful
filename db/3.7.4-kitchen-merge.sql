-- 3.7.4: My Kitchen keeps step coaching tips and the AI note when a
-- library recipe is copied or edited.

alter table public.user_recipes
  add column if not exists tips jsonb not null default '[]'::jsonb;

alter table public.user_recipes
  add column if not exists ai_note text;

notify pgrst, 'reload schema';
