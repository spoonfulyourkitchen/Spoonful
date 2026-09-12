-- Fix: owner_name column for shared recipes (used by share to community)
alter table public.shared_recipes add column if not exists owner_name text;
--SPLIT--
notify pgrst, 'reload schema';
--SPLIT--
-- Public recipe catalogue used by the Library tab.
create table if not exists public.library_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_key text not null unique,
  title text not null,
  description text not null default '',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  prep_time bigint not null default 0,
  cook_time bigint not null default 0,
  cuisine text,
  dietary_restrictions jsonb not null default '[]'::jsonb,
  image_url text,
  difficulty text not null default 'easy',
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  meal_type text,
  created_at bigint not null
);
alter table public.library_recipes enable row level security;
--SPLIT--
create policy "library_recipes_select_all" on public.library_recipes for select using (true);
create policy "library_recipes_admin_write" on public.library_recipes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists library_recipes_cuisine_idx on public.library_recipes (cuisine);
create index if not exists library_recipes_meal_type_idx on public.library_recipes (meal_type);
create index if not exists library_recipes_difficulty_idx on public.library_recipes (difficulty);
--SPLIT--
insert into public.library_recipes (recipe_key,title,description,ingredients,steps,prep_time,cook_time,cuisine,dietary_restrictions,image_url,difficulty,calories,protein,carbs,fat,meal_type,created_at) values
('pizza-margherita','Pizza Margherita','Classic pizza with tomato, mozzarella and basil.','["Pizza dough","Tomato sauce","Fresh mozzarella","Basil leaves","Olive oil"]'::jsonb,'["Roll out the dough","Spread tomato sauce over the base","Top with mozzarella and bake for 12 minutes","Finish with fresh basil"]'::jsonb,20,12,'Italian','["vegetarian"]'::jsonb,NULL,'easy',780,30,90,28,'dinner',1700000000000),
('creamy-tomato-pasta','Creamy Tomato Pasta','Silky tomato pasta ready in half an hour.','["Spaghetti","Tomato passata","Cream","Garlic","Parmesan"]'::jsonb,'["Boil the spaghetti","Soften garlic in olive oil","Add passata and simmer","Stir in cream and parmesan"]'::jsonb,5,20,'Italian','["vegetarian"]'::jsonb,NULL,'easy',640,18,90,22,'dinner',1700000000001),
('chicken-tikka-masala','Chicken Tikka Masala','Grilled chicken in a spiced tomato sauce.','["Chicken breast","Yogurt","Tikka spice","Tomato puree","Cream","Rice"]'::jsonb,'["Marinate chicken in yogurt and spices","Grill until charred","Simmer tomato puree with cream","Add chicken and serve with rice"]'::jsonb,25,35,'Indian','[]'::jsonb,NULL,'medium',720,48,60,28,'dinner',1700000000002),
('coconut-lentil-curry','Coconut Lentil Curry','Comforting dal with coconut milk and spinach.','["Red lentils","Coconut milk","Onion","Garlic","Curry powder","Spinach"]'::jsonb,'["Saute onion and garlic","Add curry powder and lentils","Pour in coconut milk and simmer","Fold in spinach"]'::jsonb,10,30,'Indian','["vegetarian","vegan","gluten-free"]'::jsonb,NULL,'easy',540,20,70,18,'dinner',1700000000003),
('beef-tacos','Beef Tacos','Weeknight tacos with seasoned beef.','["Ground beef","Taco seasoning","Corn tortillas","Lettuce","Tomato","Cheddar"]'::jsonb,'["Brown the beef","Add taco seasoning with water","Warm the tortillas","Fill with toppings"]'::jsonb,15,15,'Mexican','[]'::jsonb,NULL,'easy',610,32,45,30,'dinner',1700000000004),
('guacamole','Guacamole','Creamy avocado dip with lime and cilantro.','["Avocado","Lime","Red onion","Tomato","Cilantro","Salt"]'::jsonb,'["Mash the avocado","Stir in lime juice","Fold in onion tomato and cilantro","Season to taste"]'::jsonb,10,0,'Mexican','["vegetarian","vegan","gluten-free"]'::jsonb,NULL,'easy',230,3,12,20,'snack',1700000000005),
('veggie-sushi-rolls','Veggie Sushi Rolls','Fresh vegetable maki rolls.','["Sushi rice","Nori sheets","Cucumber","Avocado","Carrot","Soy sauce"]'::jsonb,'["Cook and season the rice","Lay nori on a mat","Spread rice and add vegetables","Roll tightly and slice"]'::jsonb,40,20,'Japanese','["vegetarian","vegan"]'::jsonb,NULL,'medium',380,8,72,5,'lunch',1700000000006),
('teriyaki-salmon','Teriyaki Salmon','Glazed salmon fillets with a sticky teriyaki sauce.','["Salmon fillets","Soy sauce","Mirin","Honey","Ginger","Broccoli"]'::jsonb,'["Mix the teriyaki glaze","Pan fry salmon skin side down","Glaze and caramelize","Serve with steamed broccoli"]'::jsonb,10,15,'Japanese','["high-protein","gluten-free"]'::jsonb,NULL,'easy',560,42,22,30,'dinner',1700000000007);
--SPLIT--
insert into public.library_recipes (recipe_key,title,description,ingredients,steps,prep_time,cook_time,cuisine,dietary_restrictions,image_url,difficulty,calories,protein,carbs,fat,meal_type,created_at) values
('french-omelette','French Omelette','Soft and creamy folded omelette.','["Eggs","Butter","Chives","Salt","Pepper"]'::jsonb,'["Whisk the eggs","Melt butter in a pan","Cook low and slow","Fold and serve"]'::jsonb,3,6,'French','["vegetarian","gluten-free"]'::jsonb,NULL,'easy',320,20,2,26,'breakfast',1700000000008),
('shakshuka','Shakshuka','Eggs poached in a spiced tomato and pepper sauce.','["Eggs","Tomatoes","Bell pepper","Onion","Paprika","Cumin"]'::jsonb,'["Soften onion and pepper","Add tomatoes and spices","Simmer into a sauce","Poach the eggs on top"]'::jsonb,10,20,'Middle Eastern','["vegetarian","gluten-free"]'::jsonb,NULL,'easy',310,16,22,17,'breakfast',1700000000009),
('greek-salad','Greek Salad','Crisp salad with feta, olives and oregano.','["Cucumber","Tomato","Red onion","Kalamata olives","Feta","Olive oil","Oregano"]'::jsonb,'["Chop the vegetables","Add olives and feta","Drizzle with olive oil","Finish with oregano"]'::jsonb,12,0,'Greek','["vegetarian","gluten-free","low-carb"]'::jsonb,NULL,'easy',290,9,14,22,'lunch',1700000000010),
('banana-oat-pancakes','Banana Oat Pancakes','Fluffy pancakes made with banana and oats.','["Banana","Oats","Eggs","Milk","Baking powder","Maple syrup"]'::jsonb,'["Blend all ingredients","Rest the batter","Cook pancakes in a pan","Serve with maple syrup"]'::jsonb,10,12,'American','["vegetarian"]'::jsonb,NULL,'easy',430,16,64,12,'breakfast',1700000000011),
('caesar-salad','Chicken Caesar Salad','Crisp romaine with grilled chicken and creamy dressing.','["Chicken breast","Romaine lettuce","Parmesan","Croutons","Caesar dressing"]'::jsonb,'["Grill and slice the chicken","Tear the romaine","Toss with dressing","Top with parmesan and croutons"]'::jsonb,15,12,'American','["high-protein"]'::jsonb,NULL,'easy',480,40,18,26,'lunch',1700000000012),
('thai-green-curry','Thai Green Curry','Aromatic coconut curry with chicken and vegetables.','["Chicken thigh","Green curry paste","Coconut milk","Eggplant","Thai basil","Jasmine rice"]'::jsonb,'["Fry the curry paste","Add coconut milk","Simmer chicken and eggplant","Finish with basil and serve with rice"]'::jsonb,15,25,'Thai','["gluten-free"]'::jsonb,NULL,'medium',690,36,58,34,'dinner',1700000000013),
('mushroom-risotto','Mushroom Risotto','Creamy rice dish with mushrooms and parmesan.','["Arborio rice","Mushrooms","Vegetable stock","White wine","Onion","Parmesan"]'::jsonb,'["Saute mushrooms and onion","Toast the rice","Add wine then hot stock slowly","Stir in parmesan"]'::jsonb,15,30,'Italian','["vegetarian"]'::jsonb,NULL,'hard',560,16,76,18,'dinner',1700000000014),
('blueberry-muffins','Blueberry Muffins','Soft muffins packed with blueberries.','["Flour","Sugar","Blueberries","Eggs","Butter","Milk","Baking powder"]'::jsonb,'["Mix dry ingredients","Fold in wet ingredients","Add blueberries","Bake at 190c for 20 minutes"]'::jsonb,15,20,'American','["vegetarian"]'::jsonb,NULL,'medium',380,6,54,15,'dessert',1700000000015);


