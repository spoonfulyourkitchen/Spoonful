set threads=2;
set preserve_insertion_order=false;

copy (
  select
    code,
    name,
    brand,
    kcal,
    protein,
    carbs,
    fat,
    serving,
    serving_grams,
    quantity,
    package_grams
  from (
    select
      code,
      name,
      brand,
      round(coalesce(
        kcal_raw,
        kj_raw / 4.184,
        case when protein is not null and carbs is not null and fat is not null
             then 4 * protein + 4 * carbs + 9 * fat end
      ), 1) as kcal,
      protein,
      carbs,
      fat,
      serving,
      serving_grams,
      quantity,
      package_grams
    from (
      select
        code,
        nullif(trim(product_name), '') as name,
        nullif(trim(brands), '') as brand,
        try_cast("energy-kcal_100g" as double) as kcal_raw,
        try_cast("energy-kj_100g" as double) as kj_raw,
        round(try_cast(proteins_100g as double), 1) as protein,
        round(try_cast(carbohydrates_100g as double), 1) as carbs,
        round(try_cast(fat_100g as double), 1) as fat,
        nullif(trim(serving_size), '') as serving,
        round(try_cast(serving_quantity as double), 1) as serving_grams,
        nullif(trim(quantity), '') as quantity,
        round(try_cast(product_quantity as double), 1) as package_grams
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
        and (
          countries_en ilike '%germany%'
          or regexp_matches(coalesce(brands, ''), '(edeka|gut ?& ?g[üu]nstig|rewe|ja!|lidl|milbona|pilos|freeway|alesto|deluxe|snack day|chef select|vitakrone|sondey|combino|aldi|gut bio|mamia|goldino|bellarom|moser roth|kaufland|k-classic|k-bio|bevola|penny|netto|norma|alnatura|tegut|marktkauf|k[äa]fer|denn.s|denns|alverde|denkmit|enerbio|rossmann|babydream|globus|\\bhit\\b|beste wahl|vita d.or|\\baro\\b|g[üu]nstig)', 'i')
        )
    ) raw
  ) b
  where name is not null
    and kcal is not null
    and kcal > 0
    and kcal < 950
) to 'D:/Spoonful/_store_products.csv' (format csv, header true);
