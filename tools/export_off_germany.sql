set threads=1;
set preserve_insertion_order=false;
install httpfs;
load httpfs;

copy (
  select
    code,
    coalesce(
      (list_filter(product_name, x -> x.lang = 'de'))[1].text,
      (list_filter(product_name, x -> x.lang = 'en'))[1].text,
      (list_filter(product_name, x -> x.lang = 'xx'))[1].text,
      (product_name)[1].text
    ) as name,
    nullif(trim(brands), '') as brand,
    round((list_filter(nutriments, x -> x.name = 'energy-kcal')[1]."100g")::double, 1) as kcal,
    round((list_filter(nutriments, x -> x.name = 'proteins')[1]."100g")::double, 1) as protein,
    round((list_filter(nutriments, x -> x.name = 'carbohydrates')[1]."100g")::double, 1) as carbs,
    round((list_filter(nutriments, x -> x.name = 'fat')[1]."100g")::double, 1) as fat,
    nullif(trim(serving_size), '') as serving,
    try_cast(regexp_extract(serving_quantity, '([0-9]+([.][0-9]+)?)', 1) as double) as serving_grams,
    nullif(trim(quantity), '') as quantity,
    try_cast(regexp_extract(product_quantity, '([0-9]+([.][0-9]+)?)', 1) as double) as package_grams
  from read_parquet('https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet')
  where list_contains(countries_tags, 'en:germany')
    and length(code) between 8 and 14
    and coalesce(
      (list_filter(product_name, x -> x.lang = 'de'))[1].text,
      (list_filter(product_name, x -> x.lang = 'en'))[1].text,
      (list_filter(product_name, x -> x.lang = 'xx'))[1].text,
      (product_name)[1].text
    ) is not null
    and (list_filter(nutriments, x -> x.name = 'energy-kcal')[1]."100g") is not null
) to 'D:/Spoonful/_de_products.csv' (format csv, header true);
