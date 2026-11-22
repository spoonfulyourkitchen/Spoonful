-- Household data is shared inside a household: every member can read, add,
-- tick and remove entries that belong to the household. Own rows stay writable
-- for a member who is not in a household any more.
-- The old policies checked user_id = auth.uid() for updates too, so one member
-- could not tick another member's task.

do $$
declare
  t text;
begin
  foreach t in array array[
    'household_tasks','household_plan','household_notes','household_expenses',
    'household_pantry','household_lists','household_cooking','household_events',
    'household_shared_recipes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_hh_delete', t);

    execute format(
      'create policy %I on public.%I for select using (household_id = public.my_household_id() or user_id = auth.uid())',
      t || '_hh_select', t);
    execute format(
      'create policy %I on public.%I for insert with check (user_id = auth.uid() and household_id = public.my_household_id())',
      t || '_hh_insert', t);
    execute format(
      'create policy %I on public.%I for update using (household_id = public.my_household_id()) with check (household_id = public.my_household_id())',
      t || '_hh_update', t);
    execute format(
      'create policy %I on public.%I for delete using (household_id = public.my_household_id() or user_id = auth.uid())',
      t || '_hh_delete', t);
  end loop;
end $$;

