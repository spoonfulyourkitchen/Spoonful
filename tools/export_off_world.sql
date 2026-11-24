set threads=2;
set preserve_insertion_order=false;

copy (
  with base as (
    select
      code,
      nullif(trim(product_name), '') as name,
      nullif(trim(brands), '') as brand,
      round(try_cast("energy-kcal_100g" as double), 1) as kcal,
      round(try_cast(proteins_100g as double), 1) as protein,
      round(try_cast(carbohydrates_100g as double), 1) as carbs,
      round(try_cast(fat_100g as double), 1) as fat,
      nullif(trim(serving_size), '') as serving,
      round(try_cast(serving_quantity as double), 1) as serving_grams,
      nullif(trim(quantity), '') as quantity,
      round(try_cast(product_quantity as double), 1) as package_grams,
      case when countries_en ilike '%germany%' then 0 else 1 end as prio
    from read_csv(
      'C:/Users/salem/AppData/Local/Temp/off.csv.gz',
      delim = '\t',
      header = true,
      quote = '"',
      escape = '"',
      ignore_errors = true,
      sample_size = 200000
    )
    where length(code) between 8 and 14
      and product_name is not null
      and length(trim(product_name)) > 1
      and try_cast("energy-kcal_100g" as double) is not null
  )
  select code, name, brand, kcal, protein, carbs, fat, serving, serving_grams, quantity, package_grams
    from base
   order by prio, code
   limit 1000000
) to 'D:/Spoonful/_all_products.csv' (format csv, header true);
