-- 3.3.1: echte Rezeptzahl der Bibliothek — auch ohne Anmeldung abfragbar
-- (die Landing-Seite zeigt damit die echte Zahl statt einer festen Angabe).
create or replace function public.library_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*) from public.recipes;
$fn$;

grant execute on function public.library_count() to anon, authenticated;
