/**
 * Ingredient nutrition engine.
 *
 * Every value in FOODS is the USDA/FoodData Central average for 100 g of the
 * ingredient as it is normally sold (raw meat, dry pasta, canned beans, ...).
 * Cup, tablespoon and piece weights are USDA household measures, so "1 cup
 * flour" becomes 120 g and not 240 g.
 *
 * The engine parses the amount written in the ingredient line, converts it to
 * grams and sums the macros. Only ingredients that cannot be recognised at all
 * fall back to a category guess, and those lower the reported coverage, which is
 * what the AI step uses to decide how much it is allowed to correct.
 */

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

export type AnalyzedIngredient = {
  line: string;
  food: string | null;
  grams: number;
  macros: Macros;
  confidence: number;
};

export type RecipeNutrition = {
  perServing: Macros;
  total: Macros;
  coverage: number;
  counted: number;
  unknown: string[];
  items: AnalyzedIngredient[];
};

type Food = {
  name: string;
  keys: string[];
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** grams for one piece ("2 eggs", "1 onion") */
  piece?: number;
  /** grams for one cup (US 240 ml for liquids) */
  cup?: number;
  tbsp?: number;
  tsp?: number;
  slice?: number;
  can?: number;
  /** grams per millilitre, for liquids that are not water-like */
  density?: number;
  /** values when the line says cooked/boiled */
  cooked?: [number, number, number, number];
};

const F = (
  name: string,
  keys: string[],
  kcal: number,
  p: number,
  c: number,
  f: number,
  extra: Partial<Food> = {},
): Food => ({ name, keys, kcal, p, c, f, ...extra });

// Order matters only for identical key lengths; longer keys always win, so
// "peanut butter" beats "butter" and "chicken broth" beats "chicken".
const FOODS: Food[] = [
  // fats and oils
  F('butter', ['butter'], 717, 0.85, 0.06, 81.1, { tbsp: 14.2, cup: 227, piece: 14 }),
  F('peanut butter', ['peanut butter', 'erdnussbutter', 'erdnussmus'], 588, 25, 20, 50, { tbsp: 16 }),
  F('ghee', ['ghee', 'butterschmalz'], 876, 0.3, 0, 99.5, { tbsp: 13 }),
  F('olive oil', ['olive oil', 'olivenöl', 'extra virgin'], 884, 0, 0, 100, { tbsp: 13.5, cup: 216, density: 0.918 }),
  F('sesame oil', ['sesame oil', 'sesamöl'], 884, 0, 0, 100, { tbsp: 13.6, density: 0.92 }),
  F('coconut oil', ['coconut oil', 'kokosöl'], 892, 0, 0, 100, { tbsp: 13.6, density: 0.92 }),
  F('oil', ['vegetable oil', 'sunflower oil', 'canola oil', 'rapeseed oil', 'avocado oil', 'oil', 'öl'], 884, 0, 0, 100, {
    tbsp: 13.6,
    cup: 218,
    density: 0.92,
  }),
  F('mayonnaise', ['mayonnaise', 'mayo', 'mayonnaise'], 680, 1, 0.6, 75, { tbsp: 13.8, cup: 220 }),
  F('pesto', ['pesto'], 440, 5, 6, 45, { tbsp: 16 }),

  // dairy
  F('heavy cream', ['heavy cream', 'double cream', 'heavy whipping cream', 'schlagsahne', 'sahne'], 340, 2.8, 2.8, 36.1, {
    cup: 240,
    tbsp: 15,
    density: 1.01,
  }),
  F('crème fraîche', ['crème fraîche', 'creme fraiche', 'crème fraiche'], 292, 2.4, 3.4, 30, { tbsp: 15 }),
  F('sour cream', ['sour cream', 'saure sahne', 'schmand'], 198, 2.4, 4.6, 19.4, { tbsp: 15, cup: 230 }),
  F('cream cheese', ['cream cheese', 'frischkäse', 'frischkaese'], 342, 6.2, 4.1, 34, { tbsp: 14.5 }),
  F('soft cheese', ['soft cheese', 'garlic and herb cream cheese', 'weichkäse'], 253, 6.2, 3.5, 23.5, { tbsp: 15 }),
  F('mascarpone', ['mascarpone'], 429, 4.6, 4, 44, { tbsp: 15 }),
  F('ricotta', ['ricotta'], 174, 11, 3, 13, { cup: 246 }),
  F('evaporated milk', ['evaporated milk', 'kondensmilch'], 134, 6.8, 10, 7.6, { cup: 252 }),
  F('condensed milk', ['condensed milk', 'gezuckerte kondensmilch'], 321, 7.9, 54.4, 8.7, { cup: 306 }),
  F('buttermilk', ['buttermilk', 'buttermilch'], 40, 3.3, 4.8, 0.9, { cup: 245 }),
  F('half and half', ['half and half', 'half-and-half'], 130, 3, 4.3, 11.5, { cup: 242 }),
  F('greek yogurt', ['greek yogurt', 'greek yoghurt', 'griechischer joghurt', 'griechisches joghurt'], 97, 9, 3.6, 5, {
    cup: 245,
  }),
  F('yogurt', ['yogurt', 'yoghurt', 'joghurt'], 61, 3.5, 4.7, 3.3, { cup: 245 }),
  F('whole milk', ['whole milk', 'vollmilch', 'milk', 'milch', 'lait', 'leche', 'latte', 'süt', 'leite', 'молоко'], 61, 3.2, 4.8, 3.3, {
    cup: 244,
  }),
  F('parmesan', ['parmesan', 'parmigiano', 'pecorino', 'grana padano'], 392, 35.8, 3.2, 25, { tbsp: 5, cup: 100 }),
  F('cheddar', ['cheddar', 'gouda', 'emmentaler', 'emmental'], 403, 24.9, 1.3, 33, { cup: 113, slice: 28 }),
  F('mozzarella', ['mozzarella'], 280, 28, 3.1, 17, { cup: 112 }),
  F('feta', ['feta'], 264, 14.2, 4.1, 21.3, { cup: 150 }),
  F('halloumi', ['halloumi'], 321, 22, 2.2, 25, { slice: 30 }),
  F('colby jack', ['colby jack', 'colby', 'monterey jack'], 384, 23, 1.5, 32, { cup: 113 }),
  F('fontina', ['fontina'], 389, 25, 1.5, 31, { cup: 108 }),
  F('gruyere', ['gruyère', 'gruyere', 'swiss cheese'], 413, 29.8, 0.4, 32.3, { cup: 108 }),
  F('blue cheese', ['blue cheese', 'gorgonzola', 'roquefort'], 353, 21.4, 2.3, 28.7, { cup: 135 }),
  F('cheese', ['cheese', 'käse', 'fromage', 'queso', 'formaggio', 'peynir', 'queijo', 'kaas', 'сыр', 'جبن'], 350, 22, 3, 28, {
    cup: 113,
    slice: 28,
  }),

  // eggs, meat, fish, protein
  F('egg white', ['egg white', 'eiweiß', 'eiweiss'], 52, 10.9, 0.7, 0.2, { piece: 33 }),
  F('egg', ['egg', 'eggs', 'eier', 'eigelb', 'egg yolk'], 143, 12.6, 0.7, 9.5, { piece: 50 }),
  F('chicken breast', ['chicken breast', 'chicken breasts', 'hähnchenbrust', 'hähnchenfilet', 'chicken fillet'], 165, 31, 0, 3.6, {
    piece: 174,
  }),
  F('chicken thigh', ['chicken thigh', 'chicken thighs', 'hähnchenschenkel', 'chicken leg'], 209, 26, 0, 10.9, { piece: 116 }),
  F('chicken', ['chicken', 'hähnchen', 'huhn', 'poultry', 'geflügel'], 190, 27, 0, 9, { piece: 170 }),
  F('turkey', ['turkey', 'pute', 'truthahn'], 189, 29, 0, 7, { piece: 150 }),
  F('ground beef', ['lean beef mince', 'lean ground beef', 'mageres hackfleisch'], 176, 20, 0, 10, { cup: 220 }),
  F('ground beef', ['ground beef', 'beef mince', 'minced beef', 'hackfleisch', 'ground meat', 'mince'], 217, 19, 0, 15, { cup: 220 }),
  F('beef', ['beef', 'steak', 'rind', 'rindfleisch', 'veal', 'kalb'], 271, 25, 0, 19, { piece: 200 }),
  F('pork', ['pork', 'schwein', 'schweinefleisch', 'pork chop'], 242, 27, 0, 14, { piece: 180 }),
  F('bacon', ['bacon', 'speck', 'pancetta'], 541, 37, 1.4, 42, { slice: 12 }),
  F('prosciutto', ['prosciutto', 'serrano', 'schinken', 'ham'], 195, 26, 1, 9, { slice: 15 }),
  F('lamb', ['lamb', 'lamm', 'lammfleisch'], 294, 25, 0, 21, { piece: 180 }),
  F('salmon', ['salmon', 'lachs'], 208, 20, 0, 13, { piece: 170 }),
  F('tuna', ['tuna', 'thunfisch'], 132, 28, 0, 1.3, { can: 142 }),
  F('cod', ['cod', 'kabeljau', 'white fish', 'haddock'], 82, 18, 0, 0.7, { piece: 170 }),
  F('shrimp', ['shrimp', 'prawn', 'garnele', 'garnelen'], 99, 24, 0.2, 0.3, { piece: 10 }),
  F('fish', ['fish', 'fisch', 'sardine', 'sardinen', 'mackerel'], 140, 22, 0, 6, { piece: 150 }),
  F('tofu', ['tofu', 'bohnenquark'], 144, 17, 3, 9, { piece: 120 }),
  F('tempeh', ['tempeh'], 192, 20, 8, 11),

  // grains, pasta, bread
  F('pasta', ['pasta', 'spaghetti', 'penne', 'fettuccine', 'rigatoni', 'macaroni', 'linguine', 'cavatappi', 'pastina', 'tagliatelle', 'nudeln', 'noodle', 'noodles'], 371, 13, 75, 1.5, {
    cup: 100,
    cooked: [158, 5.8, 31, 0.9],
  }),
  F('gnocchi', ['gnocchi'], 133, 3.5, 28, 0.5, { cup: 150 }),
  F('rice', ['rice', 'reis', 'basmati', 'jasmine rice', 'risotto rice', 'arborio'], 365, 7.1, 80, 0.7, {
    cup: 185,
    cooked: [130, 2.7, 28, 0.3],
  }),
  F('quinoa', ['quinoa'], 368, 14.1, 64, 6.1, { cup: 170, cooked: [120, 4.4, 21, 1.9] }),
  F('couscous', ['couscous'], 376, 12.8, 77, 0.6, { cup: 173 }),
  F('bulgur', ['bulgur'], 342, 12.3, 76, 1.3, { cup: 182 }),
  F('flour', ['flour', 'mehl', 'semolina', 'grieß', 'griess', "00 flour", 'type 00'], 364, 10.3, 76, 1, { cup: 120, tbsp: 8 }),
  F('cornstarch', ['cornstarch', 'starch', 'speisestärke', 'maisstärke'], 381, 0.3, 91, 0.1, { tbsp: 8 }),
  F('breadcrumbs', ['breadcrumbs', 'panko', 'paniermehl', 'semmelbrösel'], 395, 13, 72, 5, { cup: 108 }),
  F('oats', ['oats', 'oatmeal', 'haferflocken', 'rolled oats'], 389, 16.9, 66, 6.9, { cup: 90 }),
  F('bread', ['bread', 'brot', 'baguette', 'toast', 'sourdough', 'ciabatta'], 265, 9, 49, 3, { slice: 30 }),
  F('tortilla', ['tortilla', 'wrap', 'flour tortilla'], 300, 8, 49, 8, { piece: 45 }),
  F('pita', ['pita'], 275, 9, 55, 1.2, { piece: 60 }),
  F('pizza dough', ['pizza dough', 'pizzateig'], 250, 8.5, 48, 2, { piece: 250 }),

  // sweeteners, baking
  F('brown sugar', ['brown sugar', 'brauner zucker'], 380, 0, 98, 0, { cup: 220, tbsp: 13.8 }),
  F('sugar', ['sugar', 'zucker'], 387, 0, 100, 0, { cup: 200, tbsp: 12.5 }),
  F('honey', ['honey', 'honig'], 304, 0.3, 82, 0, { tbsp: 21, cup: 339 }),
  F('maple syrup', ['maple syrup', 'ahornsirup'], 260, 0, 67, 0, { tbsp: 20 }),
  F('jam', ['jam', 'marmelade', 'konfitüre', 'preserve'], 278, 0.4, 69, 0.1, { tbsp: 20 }),
  F('dark chocolate', ['dark chocolate', 'zartbitterschokolade', 'couverture'], 546, 7.8, 61, 31, { piece: 10 }),
  F('chocolate', ['chocolate', 'schokolade', 'chocolate chips', 'schokodrops'], 535, 7.6, 59, 30, { cup: 170 }),
  F('cocoa', ['cocoa', 'kakao'], 228, 19.6, 57.9, 13.7, { tbsp: 5, cup: 85 }),
  F('vanilla', ['vanilla', 'vanillezucker', 'vanille'], 288, 0.1, 12.7, 0.1, { tsp: 4 }),
  F('baking powder', ['baking powder', 'backpulver'], 53, 0, 28, 0, { tsp: 4 }),
  F('baking soda', ['bicarbonate', 'baking soda', 'natron', 'bicarb'], 0, 0, 0, 0, { tsp: 5 }),
  F('yeast', ['yeast', 'hefe'], 105, 13, 12, 1.5, { tsp: 3 }),

  // nuts, seeds, coconut
  F('almond', ['almond', 'mandel', 'mandeln'], 579, 21.2, 21.6, 49.9, { cup: 143 }),
  F('walnut', ['walnut', 'walnuss', 'walnüsse'], 654, 15.2, 13.7, 65.2, { cup: 117 }),
  F('cashew', ['cashew', 'cashews'], 553, 18.2, 30.2, 43.9, { cup: 137 }),
  F('pistachio', ['pistachio', 'pistazie'], 560, 20.2, 27.2, 45.3, { cup: 123 }),
  F('pine nuts', ['pine nuts', 'pinienkerne'], 673, 13.7, 13.1, 68.4, { tbsp: 9 }),
  F('sesame', ['sesame', 'sesam'], 573, 17.7, 23.4, 49.7, { tbsp: 9 }),
  F('tahini', ['tahini', 'tahin'], 595, 17, 21, 53.8, { tbsp: 15 }),
  F('nuts', ['nuts', 'nüsse', 'nut', 'hazelnut', 'haselnuss', 'pecan', 'pekannuss'], 600, 18, 20, 53, { cup: 130 }),
  F('coconut milk', ['coconut milk', 'kokosmilch'], 197, 2, 2.8, 21.3, { cup: 240, can: 400 }),
  F('coconut cream', ['coconut cream', 'kokoscreme'], 330, 3.6, 6.7, 34.7, { cup: 240 }),
  F('coconut', ['desiccated coconut', 'shredded coconut', 'kokosraspeln', 'coconut flakes'], 660, 6.9, 24, 64.5, { cup: 80 }),

  // vegetables
  F('potato', ['potato', 'potatoes', 'kartoffel', 'kartoffeln'], 77, 2, 17, 0.1, { piece: 170, cup: 150 }),
  F('sweet potato', ['sweet potato', 'süßkartoffel', 'suesskartoffel'], 86, 1.6, 20, 0.1, { piece: 200 }),
  F('onion', ['onion', 'onions', 'zwiebel', 'zwiebeln', 'red onion', 'rote zwiebel'], 40, 1.1, 9.3, 0.1, { piece: 110, cup: 160 }),
  F('shallot', ['shallot', 'schalotte'], 72, 2.5, 17, 0.1, { piece: 40 }),
  F('garlic', ['garlic', 'knoblauch', 'garlic clove', 'zehe'], 149, 6.4, 33, 0.5, { piece: 4 }),
  F('scallion', ['scallion', 'spring onion', 'frühlingszwiebel', 'lauchzwiebel'], 32, 1.8, 7.3, 0.2, { piece: 15 }),
  F('leek', ['leek', 'porree', 'lauch'], 61, 1.5, 14, 0.3, { piece: 90 }),
  F('tomato paste', ['tomato paste', 'tomatenmark'], 82, 4.3, 19, 0.5, { tbsp: 16, can: 170 }),
  F('passata', ['passata', 'tomato sauce', 'tomatensauce', 'tomato puree', 'tomatensoße'], 29, 1.6, 5.6, 0.2, { cup: 245 }),
  F('canned tomatoes', ['canned tomatoes', 'diced tomatoes', 'tinned tomatoes', 'gehackte tomaten', 'chopped tomatoes'], 32, 1.6, 5.4, 0.3, { can: 400 }),
  F('sun-dried tomatoes', ['sun-dried tomato', 'sundried tomato', 'getrocknete tomaten'], 258, 14.1, 55.8, 3, { piece: 3 }),
  F('cherry tomatoes', ['cherry tomato', 'cherry tomatoes', 'kirschtomaten'], 18, 0.9, 3.9, 0.2, { piece: 17 }),
  F('tomato', ['tomato', 'tomatoes', 'tomate', 'tomaten'], 18, 0.9, 3.9, 0.2, { piece: 123 }),
  F('ketchup', ['ketchup', 'tomato ketchup'], 101, 1, 26, 0.1, { tbsp: 17 }),
  F('sun-dried tomato paste', ['harissa'], 100, 4, 12, 4, { tbsp: 16 }),
  F('hot sauce', ['hot sauce', 'sriracha', 'tabasco', 'chili sauce', 'chilisauce'], 60, 1, 12, 0.5, { tbsp: 15 }),
  F('soy sauce', ['soy sauce', 'sojasauce', 'tamari'], 53, 8, 4.9, 0.6, { tbsp: 16 }),
  F('fish sauce', ['fish sauce', 'fischsauce'], 35, 5.1, 3.6, 0, { tbsp: 17 }),
  F('oyster sauce', ['oyster sauce', 'austernsauce'], 51, 1.4, 11, 0.3, { tbsp: 18 }),
  F('mustard', ['mustard', 'senf', 'dijon'], 66, 4, 5.8, 3.4, { tbsp: 16 }),
  F('vinegar', ['vinegar', 'essig', 'rice vinegar', 'balsamic'], 21, 0, 0.9, 0, { tbsp: 15 }),
  F('wine', ['white wine', 'red wine', 'wein', 'weißwein', 'rotwein'], 83, 0.1, 2.6, 0, { cup: 245 }),
  F('beer', ['beer', 'bier'], 43, 0.5, 3.6, 0, { cup: 244 }),
  F('chicken broth', ['chicken broth', 'chicken stock', 'hühnerbrühe', 'hähnchenbrühe'], 7, 1.1, 0.4, 0.2, { cup: 240 }),
  F('vegetable broth', ['vegetable broth', 'vegetable stock', 'gemüsebrühe', 'brühe', 'broth', 'stock', 'bouillon'], 8, 0.8, 0.6, 0.2, {
    cup: 240,
  }),
  F('water', ['water', 'wasser'], 0, 0, 0, 0, { cup: 240 }),
  F('curry paste', ['curry paste', 'currypaste'], 100, 3, 10, 5, { tbsp: 18 }),
  F('gochujang', ['gochujang'], 220, 5, 45, 2, { tbsp: 18 }),
  F('hoisin', ['hoisin', 'hoisinsauce'], 220, 2, 44, 3, { tbsp: 16 }),
  F('mirin', ['mirin', 'sake', 'reiswein'], 250, 0.2, 43, 0, { tbsp: 15 }),
  F('kimchi', ['kimchi'], 15, 1.1, 2.4, 0.5, { cup: 150 }),
  F('capers', ['capers', 'kapers'], 23, 2.4, 4.9, 0.9, { tbsp: 9 }),
  F('olives', ['olive', 'olives', 'oliven'], 115, 0.8, 6.3, 10.7, { piece: 4 }),
  F('pickles', ['pickle', 'pickles', 'gurke', 'gurken', 'cornichon'], 11, 0.3, 2.3, 0.2, { piece: 30 }),
  F('bell pepper', ['bell pepper', 'paprika', 'bell peppers', 'capsicum'], 31, 1, 6, 0.3, { piece: 120 }),
  F('chili', ['chili', 'chilli', 'chile', 'jalapeño', 'jalapeno', 'chili flakes', 'chili powder'], 60, 2, 10, 1.5, { piece: 15 }),
  F('carrot', ['carrot', 'karotte', 'karotten', 'möhre', 'möhren'], 41, 0.9, 9.6, 0.2, { piece: 61 }),
  F('celery', ['celery', 'sellerie', 'selleriestange'], 16, 0.7, 3, 0.2, { piece: 40 }),
  F('cucumber', ['cucumber', 'gurke'], 15, 0.7, 3.6, 0.1, { piece: 200 }),
  F('zucchini', ['zucchini', 'courgette', 'zucchino'], 17, 1.2, 3.1, 0.3, { piece: 200 }),
  F('aubergine', ['aubergine', 'eggplant', 'melanzane'], 25, 1, 5.9, 0.2, { piece: 250 }),
  F('broccoli', ['broccoli', 'brokkoli'], 34, 2.8, 6.6, 0.4, { cup: 91 }),
  F('cauliflower', ['cauliflower', 'blumenkohl'], 25, 1.9, 5, 0.3, { cup: 107 }),
  F('spinach', ['spinach', 'spinat'], 23, 2.9, 3.6, 0.4, { cup: 30 }),
  F('kale', ['kale', 'grünkohl'], 49, 4.3, 8.8, 0.9, { cup: 67 }),
  F('lettuce', ['lettuce', 'salat', 'rucola', 'arugula', 'rokka'], 15, 1.4, 2.9, 0.2, { cup: 47 }),
  F('cabbage', ['cabbage', 'kohl', 'weißkohl', 'rotkohl'], 25, 1.3, 5.8, 0.1, { cup: 89 }),
  F('brussels sprouts', ['brussels sprout', 'rosenkohl'], 43, 3.4, 9, 0.3, { piece: 19 }),
  F('mushroom', ['mushroom', 'mushrooms', 'champignon', 'champignons', 'pilze'], 22, 3.1, 3.3, 0.3, { piece: 18, cup: 70 }),
  F('corn', ['corn', 'mais', 'sweetcorn'], 86, 3.2, 19, 1.2, { cup: 154, can: 285 }),
  F('peas', ['peas', 'erbsen', 'green peas'], 81, 5.4, 14, 0.4, { cup: 145 }),
  F('green beans', ['green beans', 'grüne bohnen', 'haricots'], 31, 1.8, 7, 0.2, { cup: 100 }),
  F('asparagus', ['asparagus', 'spargel'], 20, 2.2, 3.9, 0.1, { piece: 20 }),
  F('pumpkin', ['pumpkin', 'kürbis', 'butternut', 'squash'], 26, 1, 6.5, 0.1, { cup: 116, piece: 800 }),
  F('leafy greens', ['leafy greens', 'greens', 'kale', 'chard', 'cavolo nero', 'grünzeug'], 30, 2.5, 4, 0.4, { cup: 40 }),
  F('stock cube', ['stock cube', 'stock pot', 'bouillon cube', 'brühwürfel', 'brühe cube'], 100, 8, 10, 2, { piece: 10 }),
  F('ginger', ['ginger', 'ingwer'], 80, 1.8, 18, 0.8, { tsp: 2 }),
  F('lemongrass', ['lemongrass', 'zitronengras'], 99, 1.8, 25, 0.5, { piece: 15 }),

  // herbs and spices
  F('basil', ['basil', 'basilikum'], 23, 3.2, 2.6, 0.6, { cup: 24, tbsp: 2.5 }),
  F('parsley', ['parsley', 'petersilie'], 36, 3, 6.3, 0.8, { cup: 60, tbsp: 4 }),
  F('cilantro', ['cilantro', 'coriander leaves', 'koriander'], 23, 2.1, 3.7, 0.5, { cup: 16 }),
  F('mint', ['mint', 'minze'], 44, 3.3, 8.4, 0.7, { tbsp: 1.6 }),
  F('dill', ['dill'], 43, 3.5, 7, 1.1, { tbsp: 1 }),
  F('rosemary', ['rosemary', 'rosmarin'], 131, 3.3, 20, 6, { tsp: 1.2 }),
  F('thyme', ['thyme', 'thymian'], 101, 5.6, 24, 1.7, { tsp: 1 }),
  F('spice blend', ['italian seasoning', 'oregano', 'paprika powder', 'smoked paprika', 'cumin', 'kreuzkümmel', 'coriander powder', 'curry powder', 'turmeric', 'garam masala', 'cinnamon', 'zimt', 'nutmeg', 'muskat', 'chili flakes', 'garlic powder', 'onion powder', 'seasoning', 'gewürz'], 282, 9, 50, 7, {
    tsp: 2.5,
    tbsp: 7,
  }),
  F('salt', ['salt', 'salz', 'pepper', 'pfeffer', 'sea salt', 'black pepper'], 0, 0, 0, 0, { tsp: 5 }),

  // fruit
  F('lemon juice', ['lemon juice', 'lime juice', 'zitronensaft', 'limettensaft'], 22, 0.4, 6.9, 0.2, { tbsp: 15, cup: 244 }),
  F('lemon', ['lemon', 'lime', 'zitrone', 'limette', 'zest', 'schale'], 29, 1.1, 9.3, 0.3, { piece: 60 }),
  F('avocado', ['avocado', 'avocados'], 160, 2, 8.5, 14.7, { piece: 150, cup: 150 }),
  F('apple', ['apple', 'apfel', 'äpfel'], 52, 0.3, 14, 0.2, { piece: 180 }),
  F('banana', ['banana', 'banane', 'bananen'], 89, 1.1, 23, 0.3, { piece: 120 }),
  F('berries', ['berries', 'blueberry', 'blueberries', 'strawberry', 'strawberries', 'raspberry', 'raspberries', 'himbeeren', 'erdbeeren', 'blaubeeren'], 50, 0.8, 11, 0.4, { cup: 145 }),
  F('raisins', ['raisin', 'raisins', 'rosine', 'sultanas'], 299, 3.1, 79, 0.5, { cup: 145 }),
  F('dates', ['date', 'dates', 'dattel', 'datteln'], 282, 2.5, 75, 0.4, { piece: 24 }),
  F('orange', ['orange', 'orange juice', 'orangensaft'], 47, 0.9, 12, 0.1, { piece: 140, cup: 248 }),
  F('mango', ['mango'], 60, 0.8, 15, 0.4, { piece: 200 }),
  F('pineapple', ['pineapple', 'ananas'], 50, 0.5, 13, 0.1, { cup: 165 }),
  F('fruit', ['fruit', 'obst', 'peach', 'pfirsich', 'pear', 'birne'], 55, 0.7, 13, 0.2, { piece: 150 }),

  F('ice cream', ['ice cream', 'eiscreme', 'vanilla ice'], 207, 3.5, 24, 11, { cup: 132 }),
  F('whipped cream', ['whipped cream', 'schlagobers'], 257, 2.8, 3.4, 26, { cup: 120 }),

  // --- more dairy ---
  F('cottage cheese', ['cottage cheese', 'hüttenkäse', 'huettenkaese'], 98, 11.1, 3.4, 4.3, { cup: 226 }),
  F('brie', ['brie'], 334, 20.8, 0.5, 27.7, { slice: 30 }),
  F('camembert', ['camembert'], 300, 19.8, 0.5, 24.3, { piece: 250 }),
  F('goat cheese', ['goat cheese', 'ziegenkäse', 'chèvre', 'chevre'], 364, 21.6, 0.1, 29.8, { slice: 28 }),
  F('provolone', ['provolone'], 351, 25.6, 2.1, 26.6, { slice: 28 }),
  F('paneer', ['paneer'], 296, 18.3, 3.6, 22, { cup: 150 }),
  F('skyr', ['skyr'], 63, 11, 4, 0.2, { cup: 245 }),
  F('kefir', ['kefir'], 61, 3.3, 4.7, 3.3, { cup: 243 }),
  F('oat milk', ['oat milk', 'hafermilch', 'oatly'], 46, 1, 6.7, 1.5, { cup: 240 }),
  F('soy milk', ['soy milk', 'soymilk', 'sojamilch'], 54, 3.3, 3.3, 1.8, { cup: 243 }),
  F('almond milk', ['almond milk', 'mandelmilch'], 17, 0.6, 0.6, 1.1, { cup: 240 }),
  F('coconut drink', ['coconut drink', 'kokosdrink'], 31, 0.2, 3.2, 2, { cup: 240 }),

  // --- more meat, fish, protein ---
  F('pork mince', ['pork mince', 'minced pork', 'schweinehack'], 263, 18.9, 0, 20.8, { cup: 220 }),
  F('lamb mince', ['lamb mince', 'minced lamb', 'lammhack'], 282, 16.6, 0, 23.4, { cup: 220 }),
  F('chorizo', ['chorizo'], 455, 24.1, 1.9, 38.3, { slice: 15 }),
  F('salami', ['salami'], 407, 22.6, 2.4, 33.7, { slice: 10 }),
  F('sausage', ['sausage', 'wurst', 'bratwurst', 'hot dog'], 301, 14.7, 1.6, 26.4, { piece: 70 }),
  F('duck', ['duck', 'ente', 'entenfleisch'], 337, 19, 0, 28.4, { piece: 200 }),
  F('anchovy', ['anchovy', 'anchovies', 'sardelle', 'sardellen'], 210, 20.4, 0, 14.1, { piece: 4, can: 50 }),
  F('smoked salmon', ['smoked salmon', 'räucherlachs', 'rauchlachs'], 117, 18.3, 0, 4.3, { slice: 20 }),
  F('trout', ['trout', 'forelle'], 141, 19.9, 0, 6.2, { piece: 170 }),
  F('crab', ['crab', 'krabbe', 'hummer'], 97, 19.4, 0, 1.5, { can: 120 }),
  F('mussels', ['mussel', 'mussels', 'muschel', 'muscheln'], 86, 11.9, 3.7, 2.2, { piece: 8 }),
  F('scallop', ['scallop', 'scallops', 'jakobsmuschel'], 111, 20.5, 5.4, 0.8, { piece: 15 }),
  F('seitan', ['seitan'], 370, 75, 14, 1.9, { cup: 150 }),
  F('edamame', ['edamame'], 121, 11.9, 8.9, 5.2, { cup: 155 }),
  F('jackfruit', ['jackfruit', 'jackfrucht'], 95, 1.7, 23, 0.6, { can: 565 }),

  // --- more grains and bakery ---
  F('puff pastry', ['puff pastry', 'blätterteig', 'blaetterteig'], 558, 7.4, 45, 38, { piece: 250 }),
  F('phyllo', ['phyllo', 'filo', 'yufka'], 317, 8.5, 56, 6, { piece: 20 }),
  F('shortcrust', ['shortcrust', 'mürbeteig', 'pie crust', 'tart shell'], 480, 5.7, 56, 25, { piece: 200 }),
  F('croissant', ['croissant'], 406, 8.2, 45, 21, { piece: 60 }),
  F('bagel', ['bagel'], 250, 10, 49, 1.5, { piece: 100 }),
  F('naan', ['naan'], 310, 8.7, 50, 7.6, { piece: 100 }),
  F('focaccia', ['focaccia'], 249, 8.8, 37, 7.9, { piece: 90 }),
  F('brioche', ['brioche'], 346, 8.5, 50, 12, { piece: 50 }),
  F('rice noodles', ['rice noodle', 'reisnudeln'], 364, 6, 82, 0.6, { cup: 100 }),
  F('soba', ['soba'], 336, 14, 67, 1.7, { cup: 114 }),
  F('ramen', ['ramen', 'instant noodles'], 380, 10, 52, 14, { piece: 85 }),
  F('polenta', ['polenta', 'maisgriess'], 360, 8.1, 76, 1.2, { cup: 160 }),
  F('barley', ['barley', 'gerste', 'graupen'], 354, 12.5, 73, 2.3, { cup: 184 }),
  F('farro', ['farro', 'dinkel', 'spelt'], 340, 15, 70, 2.5, { cup: 170 }),
  F('buckwheat', ['buckwheat', 'buchweizen'], 343, 13.3, 71.5, 3.4, { cup: 170 }),
  F('granola', ['granola', 'knuspermüsli'], 471, 10, 64, 20, { cup: 110 }),
  F('muesli', ['muesli', 'müsli', 'cereal', 'cornflakes', 'getreideflocken'], 360, 9, 66, 6, { cup: 85 }),

  // --- dips, sauces, condiments ---
  F('hummus', ['hummus', 'houmous'], 166, 7.9, 14.3, 9.6, { tbsp: 15 }),
  F('guacamole', ['guacamole'], 155, 2, 8.6, 13.5, { tbsp: 15 }),
  F('salsa', ['salsa'], 36, 1.5, 7, 0.2, { tbsp: 16 }),
  F('sauerkraut', ['sauerkraut', 'kimchi juice'], 19, 0.9, 4.3, 0.1, { cup: 142 }),
  F('miso', ['miso'], 199, 12.8, 26, 6, { tbsp: 17 }),
  F('worcestershire', ['worcestershire'], 78, 0, 19.5, 0, { tbsp: 17 }),
  F('barbecue sauce', ['barbecue sauce', 'bbq sauce'], 172, 0.8, 41, 0.6, { tbsp: 17 }),
  F('sweet chili sauce', ['sweet chili sauce', 'sweet chilli sauce', 'sweet chili', 'sweet chilli'], 200, 0.5, 49, 0.2, { tbsp: 17 }),
  F('nduja', ['nduja'], 400, 20, 2, 35, { slice: 10 }),
  F('labneh', ['labneh'], 150, 8, 5, 11, { tbsp: 15 }),
  F('teriyaki', ['teriyaki'], 89, 5.9, 15.6, 0.2, { tbsp: 18 }),
  F('sambal', ['sambal', 'chili crisp', 'chilli oil'], 400, 4, 20, 34, { tbsp: 15 }),
  F('ranch dressing', ['ranch', 'caesar dressing'], 430, 1.5, 6, 45, { tbsp: 15 }),
  F('gravy', ['gravy', 'soße', 'sauce mix'], 50, 1.5, 6, 2, { cup: 240 }),
  F('mayonnaise light', ['light mayonnaise', 'light mayo'], 240, 0.9, 9, 22, { tbsp: 15 }),

  // --- vegetables, fruit, extras ---
  F('bok choy', ['bok choy', 'pak choi', 'paksoi'], 13, 1.5, 2.2, 0.2, { piece: 150 }),
  F('beetroot', ['beetroot', 'beet', 'rote bete'], 43, 1.6, 9.6, 0.2, { piece: 120 }),
  F('radish', ['radish', 'radieschen', 'rettich'], 16, 0.7, 3.4, 0.1, { piece: 12 }),
  F('parsnip', ['parsnip', 'pastinake'], 75, 1.2, 18, 0.3, { piece: 130 }),
  F('celeriac', ['celeriac', 'knollensellerie'], 42, 1.5, 9.2, 0.3, { piece: 300 }),
  F('fennel', ['fennel', 'fenchel'], 31, 1.2, 7.3, 0.2, { piece: 230 }),
  F('okra', ['okra'], 33, 1.9, 7.5, 0.2, { cup: 100 }),
  F('plantain', ['plantain', 'kochbanane'], 122, 1.3, 32, 0.4, { piece: 180 }),
  F('artichoke', ['artichoke', 'artischocke'], 47, 3.3, 11, 0.2, { piece: 120 }),
  F('bamboo shoots', ['bamboo shoots', 'bambussprossen'], 19, 2.6, 1.9, 0.3, { can: 225 }),
  F('water chestnuts', ['water chestnut', 'wasserkastanie'], 49, 1.4, 12, 0.1, { can: 225 }),
  F('watercress', ['watercress', 'brunnenkresse'], 11, 2.3, 1.3, 0.1, { cup: 34 }),
  F('dried apricots', ['dried apricot', 'aprikose', 'aprikosen'], 241, 3.4, 63, 0.5, { piece: 8 }),
  F('prunes', ['prune', 'prunes', 'backpflaume'], 240, 2.2, 64, 0.4, { piece: 10 }),
  F('figs', ['fig', 'figs', 'feige', 'feigen'], 249, 3.3, 64, 0.9, { piece: 20 }),
  F('cranberries', ['cranberry', 'cranberries', 'cranberries getrocknet', 'preiselbeere'], 308, 0.1, 82, 0.1, { cup: 120 }),
  F('lemon curd', ['lemon curd', 'zitronencreme'], 283, 3.5, 61, 4.5, { tbsp: 20 }),
  F('almond butter', ['almond butter', 'mandelmus'], 614, 21, 18.8, 55.5, { tbsp: 16 }),
  F('white chocolate', ['white chocolate', 'weisse schokolade'], 539, 5.9, 59, 32, { piece: 10 }),
  F('marshmallow', ['marshmallow'], 318, 1.8, 81, 0.2, { piece: 7 }),
  F('marzipan', ['marzipan'], 458, 6.8, 50, 27, { piece: 15 }),

  // --- drinks and misc ---
  F('coffee', ['coffee', 'espresso', 'kaffee'], 2, 0.1, 0, 0, { cup: 240 }),
  F('tea', ['tea', 'tee'], 1, 0, 0.2, 0, { cup: 240 }),
  F('sparkling water', ['sparkling water', 'sprudelwasser', 'mineral water'], 0, 0, 0, 0, { cup: 240 }),
  F('apple juice', ['apple juice', 'apfelsaft'], 46, 0.1, 11.3, 0.1, { cup: 248 }),
  F('orange juice', ['orange juice', 'orangensaft'], 45, 0.7, 10.4, 0.2, { cup: 248 }),
  F('cola', ['cola', 'coca cola', 'soft drink', 'lemonade', 'limonade'], 42, 0, 10.6, 0, { cup: 240 }),
  F('nutritional yeast', ['nutritional yeast', 'hefeflocken'], 380, 50, 35, 5, { tbsp: 5 }),
  F('gelatin', ['gelatine', 'gelatin'], 335, 85.6, 0, 0.1, { tsp: 4 }),
  F('bay leaf', ['bay leaf', 'bay leaves', 'lorbeer'], 313, 7.6, 75, 8.4, { piece: 0.2 }),
  F('saffron', ['saffron', 'safran'], 310, 11.4, 65, 5.9, { tsp: 0.7 }),
  F('cardamom', ['cardamom', 'kardamom'], 311, 10.8, 68, 6.7, { tsp: 2 }),
  F('star anise', ['star anise', 'sternanis'], 337, 17.6, 50, 15.9, { piece: 1 }),
  F('fennel seeds', ['fennel seeds', 'fenchelsamen'], 345, 15.8, 52, 14.9, { tsp: 2 }),
  F('mustard seeds', ['mustard seeds', 'senfsaat', 'senfkörner'], 508, 26, 28, 36, { tsp: 3 }),
];

const CATEGORY_FALLBACK: { keys: string[]; values: [number, number, number, number] }[] = [
  { keys: ['sauce', 'sauce', 'dressing', 'dip', 'mayo', 'pesto'], values: [180, 2, 8, 15] },
  { keys: ['syrup', 'sirup', 'glaze', 'icing', 'frosting'], values: [300, 0, 75, 5] },
  { keys: ['sausage', 'wurst', 'chorizo', 'salami', 'meatball'], values: [300, 15, 3, 25] },
  { keys: ['seafood', 'muschel', 'scallop', 'jakobsmuschel', 'calamari', 'squid'], values: [100, 18, 2, 2] },
  { keys: ['bean', 'bohne', 'lentil', 'linse', 'chickpea', 'kichererbse'], values: [130, 8, 22, 1] },
  { keys: ['seed', 'samen', 'chia', 'flax', 'leinsamen', 'hemp'], values: [500, 20, 25, 35] },
  { keys: ['juice', 'saft', 'smoothie'], values: [45, 0.5, 11, 0.1] },
  { keys: ['cracker', 'biscuit', 'cookie', 'keks', 'cake', 'kuchen', 'muffin'], values: [450, 6, 60, 20] },
];

const isLetter = (ch: string | undefined) => !!ch && /[\p{L}]/u.test(ch);

function containsWord(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? undefined : haystack[at - 1];
    const rest = haystack.slice(at + needle.length);
    // plurals: "pecans", "courgettes", "tomatoes", "potatoes"
    const plural = /^(?:s|es|n)\b/.test(rest) && !isLetter(rest.replace(/^(?:s|es|n)/, '')[0]);
    if (!isLetter(before) && (!isLetter(rest[0]) || plural)) return true;
    from = at + 1;
  }
}

function lookup(text: string): Food | null {
  let best: Food | null = null;
  let bestLength = 0;
  for (const food of FOODS) {
    for (const key of food.keys) {
      if (key.length <= bestLength) continue;
      if (containsWord(text, key)) {
        best = food;
        bestLength = key.length;
      }
    }
  }
  return best;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': ' 1/2',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
};

/** "1½", "1 1/2", "3-4" and "1 to 2" all become a single usable number. */
export function normalizeAmounts(line: string): string {
  let text = String(line ?? '');
  text = text.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (f) => UNICODE_FRACTIONS[f] ?? ' ');
  // "1 1/2" -> 1.5, "1/2" -> 0.5
  text = text.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_m, whole: string, num: string, den: string) =>
    ` ${(Number(whole) + Number(num) / Number(den)).toFixed(3)} `,
  );
  text = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num: string, den: string) => ` ${(Number(num) / Number(den)).toFixed(3)} `);
  // "2 x 400 g tins" -> "800 g"
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|cl|dl|oz|lb|lbs|gramm)\b/gi,
    (_m, count: string, size: string, unit: string) => ` ${(Number(count) * Number(size)).toFixed(1)} ${unit} `,
  );
  // ranges "3-4", "3–4", "3 to 4", "3 or 4" -> middle value
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to|bis|or|oder)\s*(\d+(?:\.\d+)?)(?!\s*(?:g|kg|ml|l|cl|dl)\b)/g,
    (_m, a: string, b: string) => ` ${((Number(a) + Number(b)) / 2).toFixed(3)} `,
  );
  return text.replace(/,(\d)/g, '.$1');
}

type UnitKind = 'mass' | 'volume' | 'count';

const UNITS: { keys: string[]; kind: UnitKind; grams?: number; ml?: number; count?: 'piece' | 'clove' | 'slice' | 'can' | 'pack' | 'bunch' | 'pinch' }[] = [
  { keys: ['kg', 'kilogramm', 'kilogram'], kind: 'mass', grams: 1000 },
  { keys: ['mg'], kind: 'mass', grams: 0.001 },
  { keys: ['g', 'gr', 'gramm', 'gram', 'grams', 'grm'], kind: 'mass', grams: 1 },
  { keys: ['oz', 'ounce', 'ounces'], kind: 'mass', grams: 28.35 },
  { keys: ['lb', 'lbs', 'pound', 'pounds', 'pfund'], kind: 'mass', grams: 453.6 },
  { keys: ['ml', 'milliliter', 'millilitre'], kind: 'volume', ml: 1 },
  { keys: ['cl'], kind: 'volume', ml: 10 },
  { keys: ['dl'], kind: 'volume', ml: 100 },
  { keys: ['l', 'liter', 'litre'], kind: 'volume', ml: 1000 },
  { keys: ['fl oz', 'fluid ounce'], kind: 'volume', ml: 29.6 },
  { keys: ['cup', 'cups', 'tasse', 'tassen'], kind: 'volume', ml: 240 },
  { keys: ['tbsp', 'tablespoon', 'tablespoons', 'el', 'esslöffel', 'essloeffel'], kind: 'volume', ml: 15 },
  { keys: ['tsp', 'teaspoon', 'teaspoons', 'tl', 'teelöffel', 'teeloeffel'], kind: 'volume', ml: 5 },
  { keys: ['pint'], kind: 'volume', ml: 473 },
  { keys: ['quart'], kind: 'volume', ml: 946 },
  { keys: ['clove', 'cloves', 'zehe', 'zehen'], kind: 'count', count: 'clove' },
  { keys: ['slice', 'slices', 'scheibe', 'scheiben'], kind: 'count', count: 'slice' },
  { keys: ['can', 'cans', 'tin', 'tins', 'dose', 'dosen', 'büchse'], kind: 'count', count: 'can' },
  { keys: ['package', 'packet', 'pack', 'packung', 'päckchen', 'paquet'], kind: 'count', count: 'pack' },
  { keys: ['bunch', 'bund', 'handful', 'handvoll'], kind: 'count', count: 'bunch' },
  { keys: ['pinch', 'prise'], kind: 'count', count: 'pinch' },
  { keys: ['piece', 'pieces', 'stück', 'stueck', 'stk', 'pcs', 'pc'], kind: 'count', count: 'piece' },
];

const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(?:(fl oz|fluid ounce|[a-zäöüß]+)\b\.?)?/gi;

type ParsedAmount = { grams: number; confidence: number; unit: string };

/** "4 chicken breasts (about 450 g)": the stated total beats four guessed pieces. */
function explicitTotal(text: string): number | null {
  const bracketed = /\(\s*(?:about|approx\.?|around|ca\.?|rund)?\s*(\d+(?:\.\d+)?)\s*(kg|g|oz|lb|lbs)\s*\)/.exec(text);
  const approx = /\b(?:about|approx\.?|around|ca\.?|rund)\s+(\d+(?:\.\d+)?)\s*(kg|g|oz|lb|lbs)\b/.exec(text);
  const hit = bracketed ?? approx;
  if (!hit) return null;
  const value = Number(hit[1]);
  const unit = hit[2];
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === 'kg') return value * 1000;
  if (unit === 'oz') return value * 28.35;
  if (unit === 'lb' || unit === 'lbs') return value * 453.6;
  return value;
}

function sizeFactor(text: string): number {
  if (/\b(?:large|x-large|xl|big|grosse|große|grosser|großer)\b/.test(text)) return 1.4;
  if (/\b(?:small|klein|kleine|kleiner)\b/.test(text)) return 0.7;
  return 1;
}

function amountGrams(line: string, food: Food | null): ParsedAmount | null {
  const text = normalizeAmounts(line).toLowerCase();
  const density = food?.density ?? 1;

  const total = explicitTotal(text);
  if (total) return { grams: total, confidence: 1, unit: 'stated total' };

  if (!/\d/.test(text)) {
    if (/\b(?:bunch|handful|bund|handvoll)\b/.test(text)) return { grams: 30, confidence: 0.6, unit: 'bunch' };
    // "a few basil leaves", "parsley to serve": real, but only a trace
    if (food && food.kcal <= 400) return { grams: 3, confidence: 0.5, unit: 'trace' };
    return null;
  }

  const scale = sizeFactor(text);
  AMOUNT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_RE.exec(text))) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    // skip percentages ("35 % cream"), sizes ("23 cm tin") and times
    const after = text.slice(AMOUNT_RE.lastIndex);
    if (/^\s*(?:%|percent|prozent)/.test(after)) continue;
    if (/^\s*(?:cm\b|mm\b|inch\b|in\b|minutes?\b|mins?\b|hours?\b|sek\b)/.test(after)) continue;
    const word = (match[2] ?? '').toLowerCase();
    const unit = UNITS.find((u) => u.keys.includes(word));

    if (unit?.kind === 'mass') return { grams: value * (unit.grams ?? 1), confidence: 1, unit: word };
    if (unit?.kind === 'volume') {
      const ml = value * (unit.ml ?? 0);
      if (word.startsWith('cup') || word.startsWith('tasse')) {
        return { grams: value * (food?.cup ?? (unit.ml ?? 240) * density), confidence: 1, unit: word };
      }
      if (word.includes('tbsp') || word === 'el' || word.includes('essl')) {
        return { grams: value * (food?.tbsp ?? 15 * density), confidence: 1, unit: word };
      }
      if (word.includes('tsp') || word === 'tl' || word.includes('teel')) {
        return { grams: value * (food?.tsp ?? 5 * density), confidence: 1, unit: word };
      }
      return { grams: ml * density, confidence: 1, unit: word };
    }
    if (unit?.kind === 'count') {
      switch (unit.count) {
        case 'clove':
          return { grams: value * (food?.piece ?? 4), confidence: 0.85, unit: word };
        case 'slice':
          return { grams: value * (food?.slice ?? 30), confidence: 0.8, unit: word };
        case 'can':
          return { grams: value * (food?.can ?? 400), confidence: 0.8, unit: word };
        case 'pack':
          return { grams: value * (food?.piece ?? 250), confidence: 0.6, unit: word };
        case 'bunch':
          return { grams: value * 30, confidence: 0.6, unit: word };
        case 'pinch':
          return { grams: value * 0.5, confidence: 0.5, unit: word };
        case 'piece':
          return { grams: value * (food?.piece ?? 100), confidence: food?.piece ? 0.85 : 0.6, unit: word };
      }
    }

    // No recognised unit: "2 eggs", "1 large onion", "4 ripe bananas".
    // A trailing word that is not a unit is a description ("onion", "ripe"),
    // so the count is what matters.
    if (value >= 30 && !word) return { grams: value, confidence: 0.7, unit: '' };
    if (food?.piece) return { grams: value * food.piece * scale, confidence: word ? 0.75 : 0.85, unit: word || 'piece' };
    if (value >= 30) return { grams: value, confidence: 0.7, unit: '' };
    return { grams: value * 100 * scale, confidence: word ? 0.4 : 0.5, unit: '' };
  }
  return null;
}

function macrosFor(food: Food | null, line: string, grams: number): [number, number, number, number] {
  if (food) {
    const cooked = /cooked|boiled|gekocht|al dente|rest/i.test(line) ? food.cooked : undefined;
    const [k, p, c, f] = cooked ?? [food.kcal, food.p, food.c, food.f];
    const factor = grams / 100;
    return [k * factor, p * factor, c * factor, f * factor];
  }
  const text = line.toLowerCase();
  const fallback = CATEGORY_FALLBACK.find((entry) => entry.keys.some((k) => containsWord(text, k)));
  const [k, p, c, f] = fallback?.values ?? [150, 5, 15, 6];
  const factor = grams / 100;
  return [k * factor, p * factor, c * factor, f * factor];
}

const NEGLIGIBLE = /^(?:salt|pepper|water|ice|salz|pfeffer|wasser|eis)\b/i;

/**
 * Analyses a whole ingredient list. `coverage` is the share of the recipes
 * weight that was matched to a known food with a confidently parsed amount.
 *
 * `known` carries real per-100 g values from the product catalogue (scanned or
 * searched products in the tracker), keyed by the exact ingredient line. Those
 * beat the generic table because they describe the actual product.
 */
export function analyzeRecipeNutrition(
  ingredients: string[] | undefined,
  servings = 4,
  known?: Record<string, [number, number, number, number]>,
): RecipeNutrition | null {
  const list = (ingredients ?? []).map((i) => String(i ?? '').trim()).filter(Boolean);
  if (!list.length) return null;

  const items: AnalyzedIngredient[] = [];
  let totalGrams = 0;
  let knownGrams = 0;
  const unknown: string[] = [];

  for (const line of list) {
    const food = lookup(line.toLowerCase());
    let parsed = amountGrams(line, food);
    // Deep-frying oil is not eaten: only about a tenth sticks to the food.
    if (parsed && food && /oil|öl|ghee|fett/.test(food.name) && parsed.grams >= 100) {
      const frying = /fry|frying|fritier|frittier|deep-fry|deep fry|zum ausbacken/i.test(line);
      if (frying) parsed = { ...parsed, grams: parsed.grams * 0.1, confidence: 0.6 };
    }
    if (!parsed) {
      // "salt to taste", "freshly ground pepper": exists, but weighs nothing
      if (NEGLIGIBLE.test(line)) {
        items.push({ line, food: food?.name ?? null, grams: 0, macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, confidence: 1 });
        totalGrams += 1;
        knownGrams += 1;
      } else {
        unknown.push(line);
      }
      continue;
    }
    const product = !food ? known?.[line] : undefined;
    const [k, p, c, f] = product
      ? [(product[0] * parsed.grams) / 100, (product[1] * parsed.grams) / 100, (product[2] * parsed.grams) / 100, (product[3] * parsed.grams) / 100]
      : macrosFor(food, line, parsed.grams);
    items.push({
      line,
      food: food?.name ?? (product ? 'product' : null),
      grams: parsed.grams,
      macros: { calories: k, protein: p, carbs: c, fat: f },
      confidence: parsed.confidence,
    });
    totalGrams += parsed.grams;
    knownGrams += parsed.grams * parsed.confidence * (food || product ? 1 : 0.35);
    if (!food && !product) unknown.push(line);
  }

  const counted = items.filter((item) => item.grams > 0).length;
  if (counted < 1) return null;

  const total = items.reduce<Macros>(
    (acc, item) => ({
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  if (total.calories <= 0) return null;

  const per = Math.max(1, servings || 4);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const perServing = {
    calories: Math.round(total.calories / per),
    protein: round1(total.protein / per),
    carbs: round1(total.carbs / per),
    fat: round1(total.fat / per),
  };

  return {
    perServing,
    total: { ...total, calories: Math.round(total.calories) },
    coverage: totalGrams > 0 ? Math.min(1, knownGrams / totalGrams) : 0,
    counted,
    unknown,
    items,
  };
}

/**
 * Atwater sanity check. A model can return macros that do not add up to the
 * calories it wrote (or the other way round); then the macros win, because
 * they are what the eaters track. Nothing is invented - only the energy value
 * is brought back in line with 4*protein + 4*carbs + 9*fat.
 */
export function consistent(macros: Macros): Macros {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const protein = Math.max(0, macros.protein || 0);
  const carbs = Math.max(0, macros.carbs || 0);
  const fat = Math.max(0, macros.fat || 0);
  const atwater = 4 * protein + 4 * carbs + 9 * fat;
  const calories = macros.calories > 0 ? macros.calories : atwater;
  const off = atwater > 0 ? Math.abs(calories - atwater) / atwater : 0;
  return {
    calories: Math.round(off > 0.15 ? atwater : calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };
}
