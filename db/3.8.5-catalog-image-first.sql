CREATE OR REPLACE FUNCTION public.catalog_page(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := lower(coalesce(nullif(p->>'search', ''), ''));
  c text := lower(coalesce(nullif(p->>'cuisine', ''), ''));
  m text := lower(coalesce(nullif(p->>'mealType', ''), ''));
  diff text := lower(coalesce(nullif(p->>'difficulty', ''), ''));
  sort text := lower(coalesce(nullif(p->>'sort', ''), ''));
  tr text := coalesce(nullif(p->>'timeRange', ''), '');
  cr text := coalesce(nullif(p->>'calories', ''), '');
  terms text[] := coalesce((select array_agg(lower(t)) from jsonb_array_elements_text(coalesce(p->'terms', '[]'::jsonb)) t), '{}');
  minm int := greatest(1, coalesce((p->>'minMatch')::int, 1));
  lim int := greatest(1, coalesce((p->>'limit')::int, 24));
  off int := greatest(0, coalesce((p->>'offset')::int, 0));
  total bigint;
  items jsonb;
begin
  drop table if exists _cf;
  create temp table _cf on commit drop as
  select r.*, public.catalog_terms_match(r, terms) as match_score
  from public.recipes r
  where (q = ''
      or lower(r.title) like '%' || q || '%'
      or lower(coalesce(r.description, '')) like '%' || q || '%'
      or word_similarity(q, lower(r.title)) >= 0.6
      or exists (select 1 from jsonb_array_elements_text(coalesce(r.ingredients, '[]'::jsonb)) i
                 where lower(i) like '%' || q || '%' or word_similarity(q, lower(i)) >= 0.6)
      or exists (select 1 from jsonb_array_elements_text(coalesce(r.steps, '[]'::jsonb)) s
                 where lower(s) like '%' || q || '%' or word_similarity(q, lower(s)) >= 0.6))
    and (c = '' or lower(coalesce(r.cuisine, '')) = c)
    and (m = '' or lower(coalesce(r.meal_type, '')) = m)
    and (diff = '' or lower(coalesce(r.difficulty, 'medium')) = diff)
    and (array_length(terms, 1) is null or public.catalog_terms_match(r, terms) >= minm)
    and (
      coalesce(jsonb_array_length(coalesce(p->'diets', '[]'::jsonb)), 0) = 0
      or not exists (
        select 1 from jsonb_array_elements_text(coalesce(p->'diets', '[]'::jsonb)) sel
        where not exists (
          select 1 from jsonb_array_elements_text(r.dietary_restrictions) dr
          where lower(dr) = lower(sel)
        )
      )
    )
    and (
      tr = ''
      or (tr = 'under15' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) < 15)
      or (tr = '15-30' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) between 15 and 30)
      or (tr = 'over30' and (coalesce(r.prep_time, 0) + coalesce(r.cook_time, 0)) > 30)
    )
    and (
      cr = ''
      or (cr = '0-400' and coalesce(r.calories, 0) <= 400)
      or (cr = '400-700' and coalesce(r.calories, 0) > 400 and coalesce(r.calories, 0) <= 700)
      or (cr = 'over700' and coalesce(r.calories, 0) > 700)
    );

  select count(*) into total from _cf;
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into items
  from (
    select * from _cf
    order by
      case when coalesce(image_url, '') <> '' then 0 else 1 end asc,
      case when sort = 'match' then match_score end desc nulls last,
      case when sort = 'quick' then coalesce(prep_time, 0) + coalesce(cook_time, 0) end asc nulls last,
      case when sort = 'calories' then coalesce(calories, 99999) end asc nulls last,
      case when sort = 'newest' then extract(epoch from created_at) end desc nulls last,
      title asc, id asc
    limit lim offset off) x;

  return jsonb_build_object('items', items, 'total', total, 'offset', off, 'hasMore', (off + lim) < total);
end;
$function$
