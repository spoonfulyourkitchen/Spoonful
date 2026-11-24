-- 3.8.1 worldwide product catalog
-- The catalog grows from the German set to one million products from all
-- countries, German products first. The updated_at index is not used by any
-- query and is dropped to keep room for the larger table.

drop index if exists public.product_catalog_updated_idx;

create index if not exists product_catalog_brand_trgm on public.product_catalog using gin (lower(brand) gin_trgm_ops);

analyze public.product_catalog;
