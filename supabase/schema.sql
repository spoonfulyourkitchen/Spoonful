-- ============================================================================
-- Spoonful – Supabase Schema (Migration von Convex)
-- Ausgangsbasis: src/convex/schema.ts + exportierte Tabellenstruktur
-- In Supabase ausführen: SQL Editor → dieses Skript einfügen → Run
-- ============================================================================

create extension if not exists pgcrypto;

-- Rollen: admin | mod | user | member   (mod ist NEU für Moderatoren)
do $$ begin
  create type public.app_role as enum ('admin','mod','user','member');
exception when duplicate_object then null; end $$;

-- PROFILES  (≙ Convex users; Auth kommt von Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  image text,
  email text,
  email_verification_time timestamptz,
  is_anonymous boolean default false,
  role public.app_role not null default 'user',
  cooking_experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

-- COLLECTIONS  (≙ Convex collections)
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists collections_user_idx on public.collections (user_id);

-- RECIPES  (≙ Convex recipes – „Meine Rezepte")
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  prep_time integer not null default 0,
  cook_time integer,
  cuisine text,
  dietary_restrictions jsonb not null default '[]',
  image_url text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_user_idx on public.recipes (user_id);

-- SAVED_RECIPES  (≙ Convex savedRecipes)
-- recipe_key = z. B. „library-xyz", „community-xyz", eigener uuid-String
create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_key text not null,
  title text not null,
  description text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  prep_time integer not null default 0,
  cook_time integer not null default 0,
  cuisine text,
  dietary_restrictions jsonb not null default '[]',
  image_url text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  notes text,
  favorite boolean not null default false,
  collection_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_key)
);
create index if not exists saved_recipes_user_idx on public.saved_recipes (user_id);

-- SHARED_RECIPES  (≙ Convex sharedRecipes – Community)
-- status: pending | approved | rejected
create table if not exists public.shared_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  share_key text not null,
  title text not null,
  description text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  prep_time integer not null default 0,
  cook_time integer,
  cuisine text,
  dietary_restrictions jsonb not null default '[]',
  image_url text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  calories integer,
  protein numeric,
  carbs numeric,
  fat numeric,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  rejection_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_recipes_status_idx on public.shared_recipes (status);
create index if not exists shared_recipes_owner_idx on public.shared_recipes (owner_id);

-- RECIPE_LIKES  (NEU – Community „Liken")
create table if not exists public.recipe_likes (
  shared_recipe_id uuid not null references public.shared_recipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shared_recipe_id, user_id)
);
create index if not exists recipe_likes_user_idx on public.recipe_likes (user_id);

-- RECIPE_REVIEWS  (≙ Convex recipeReviews)
create table if not exists public.recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  shared_recipe_id uuid not null references public.shared_recipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shared_recipe_id, user_id)
);
create index if not exists recipe_reviews_shared_idx on public.recipe_reviews (shared_recipe_id);

-- CALORIE_ENTRIES  (≙ Convex calorieEntries – Tracker)
create table if not exists public.calorie_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_key text,
  title text not null,
  calories integer not null default 0,
  protein numeric,
  carbs numeric,
  fat numeric,
  servings integer not null default 1,
  source text not null default 'manual'
    check (source in ('recipe','library','saved','community','assistant','manual')),
  eaten_at timestamptz not null default now()
);
create index if not exists calorie_entries_user_idx on public.calorie_entries (user_id);
create index if not exists calorie_entries_user_date_idx on public.calorie_entries (user_id, eaten_at);

-- SHOPPING_LIST_ITEMS  (≙ Convex shoppingListItems)
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  recipe_key text,
  recipe_title text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_user_idx on public.shopping_list_items (user_id);

-- FEEDBACK  (≙ Convex feedback)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  user_email text,
  rating integer,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feedback_read_idx on public.feedback (read);
create index if not exists feedback_created_idx on public.feedback (created_at);

-- IMAGE_REPORTS  (≙ Convex imageReports)
create table if not exists public.image_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_key text not null,
  recipe_title text,
  image_url text,
  reason text not null,
  message text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists image_reports_status_idx on public.image_reports (status);
create index if not exists image_reports_created_idx on public.image_reports (created_at);

-- LIBRARY OVERRIDES  (≙ Convex libraryImageOverrides / libraryCategoryOverrides)
create table if not exists public.library_image_overrides (
  recipe_key text primary key,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_category_overrides (
  recipe_key text primary key,
  meal_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SYSTEM_CONFIG  (≙ Convex systemConfig)
create table if not exists public.system_config (
  key text primary key,
  value text not null
);

-- ============================================================================
-- ROW LEVEL SECURITY (Grundregeln – wird beim App-Umbau je Feature verfeinert)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.recipes enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.shared_recipes enable row level security;
alter table public.recipe_likes enable row level security;
alter table public.recipe_reviews enable row level security;
alter table public.calorie_entries enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.feedback enable row level security;
alter table public.image_reports enable row level security;

-- profiles: jeder kann lesen (für Namen/Bilder), nur selbst schreiben
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Eigene Daten: nur Besitzer
create policy "collections_own" on public.collections for all using (auth.uid() = user_id);
create policy "recipes_own" on public.recipes for all using (auth.uid() = user_id);
create policy "saved_recipes_own" on public.saved_recipes for all using (auth.uid() = user_id);
create policy "calorie_entries_own" on public.calorie_entries for all using (auth.uid() = user_id);
create policy "shopping_own" on public.shopping_list_items for all using (auth.uid() = user_id);

-- Community: approved für alle lesbar, rest nur für Eigentümer/Admin/Mod
create policy "shared_recipes_read_approved" on public.shared_recipes for select
  using (status = 'approved' or auth.uid() = owner_id
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','mod')));
create policy "shared_recipes_write_owner" on public.shared_recipes for insert with check (auth.uid() = owner_id);
create policy "shared_recipes_update_owner" on public.shared_recipes for update using (auth.uid() = owner_id);
create policy "shared_recipes_delete_owner" on public.shared_recipes for delete using (auth.uid() = owner_id);
create policy "shared_recipes_moderate" on public.shared_recipes for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','mod'))
);

-- Likes & Reviews
create policy "likes_all" on public.recipe_likes for select using (true);
create policy "likes_write_own" on public.recipe_likes for all using (auth.uid() = user_id);
create policy "reviews_read" on public.recipe_reviews for select using (true);
create policy "reviews_write_own" on public.recipe_reviews for all using (auth.uid() = user_id);

-- Feedback & Reports: Erstellen erlaubt, Lesen nur admin/mod
create policy "feedback_insert" on public.feedback for insert with check (auth.uid() = user_id);
create policy "image_reports_insert" on public.image_reports for insert with check (auth.uid() = user_id);
create policy "feedback_read_admin" on public.feedback for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','mod'))
);
create policy "image_reports_read_admin" on public.image_reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','mod'))
);

-- ============================================================================
-- TRIGGER: updated_at automatisch pflegen
-- ============================================================================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_recipes_updated on public.recipes;
create trigger trg_recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
drop trigger if exists trg_saved_updated on public.saved_recipes;
create trigger trg_saved_updated before update on public.saved_recipes for each row execute function public.set_updated_at();
drop trigger if exists trg_shared_updated on public.shared_recipes;
create trigger trg_shared_updated before update on public.shared_recipes for each row execute function public.set_updated_at();
