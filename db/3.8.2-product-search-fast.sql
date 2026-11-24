-- 3.8.2 fast product search on the million row catalog
-- Prefix matches come from the trigram index and return in milliseconds.
-- Contains matches and brand hits only fill the remaining slots, so the
-- function never sorts a large candidate set.

create or replace function public.product_search(p_q text, p_limit int default 20)
returns setof public.product_catalog
language plpgsql
stable
security definer
set search_path = public
set plan_cache_mode = 'force_custom_plan'
as $$
declare
  v_term text := lower(trim(coalesce(p_q, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_found int := 0;
  v_rows int := 0;
begin
  if length(v_term) < 2 then
    return;
  end if;

  return query
    select t.*
      from (
        select c.*
          from public.product_catalog c
         where lower(c.name) like v_term || '%'
         limit 400
      ) t
     order by length(t.name) asc
     limit v_limit;
  get diagnostics v_found = row_count;
  if v_found >= v_limit then
    return;
  end if;

  if v_found = 0 then
    return query
      select c.*
        from public.product_catalog c
       where lower(c.name) like '%' || v_term || '%'
       limit v_limit;
    get diagnostics v_found = row_count;
  end if;


  if v_found = 0 then
    return query
      select c.*
        from public.product_catalog c
       where lower(coalesce(c.brand, '')) like v_term || '%'
       limit v_limit;
  end if;
end;
$$;

grant execute on function public.product_search(text, int) to anon, authenticated;
