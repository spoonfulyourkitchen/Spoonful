/**
 * Spoonful recipe translator (offline, phrase-based, no AI).
 *
 * 1. Whole phrases are replaced first (longest match) so instructions read
 *    naturally instead of word-by-word.
 * 2. Remaining words fall back to a large term list (ingredients, actions,
 *    tools, adjectives, units) for 10 languages.
 * 3. Quantities and units are preserved; the result is tidied up.
 * The first translation is stored server-side in `recipe_translations`.
 */

import { EXTRA_TERMS } from './recipe-translate-extra';

export type RecipeContent = {
  title?: string;
  description?: string;
  ingredients: string[];
  steps: string[];
};

export type TranslatedRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
};

type Dict = Record<string, string>;

const de: Dict = {
  'until golden brown':'bis goldbraun','until golden':'bis goldbraun','until tender':'bis zart','until cooked through':'bis gar gegart',
  'until fragrant':'bis duftend','until soft':'bis weich','until smooth':'bis glatt','until reduced':'bis reduziert',
  'over medium heat':'bei mittlerer Hitze','over high heat':'bei starker Hitze','over low heat':'bei schwacher Hitze',
  'on both sides':'auf beiden Seiten','in a large bowl':'in einer großen Schüssel','in a bowl':'in einer Schüssel','in a pan':'in einer Pfanne',
  'in a pot':'in einem Topf','in a saucepan':'in einem kleinen Topf','in the oven':'im Ofen','season to taste':'nach Geschmack würzen',
  'season with':'würzen mit','stir in':'einrühren','fold in':'unterheben','pour in':'eingießen','mix together':'vermengen','whisk together':'verquirlen',
  'bring to a boil':'zum Kochen bringen','reduce the heat':'Hitze reduzieren','set aside':'beiseitestellen','drain and rinse':'abgießen und abspülen',
  'serve with':'servieren mit','garnish with':'garnieren mit','sprinkle with':'bestreuen mit','spread over':'verteilen auf','top with':'belegen mit',
  'cover with':'bedecken mit','remove from heat':'vom Herd nehmen','let it rest':'ruhen lassen','preheat the oven':'Ofen vorheizen',
  'cut into cubes':'in Würfel schneiden','cut into slices':'in Scheiben schneiden','finely chopped':'fein gehackt','roughly chopped':'grob gehackt',
  'for about':'für etwa','a pinch of':'eine Prise','a handful of':'eine Handvoll','a clove of':'eine Zehe',
  'olive oil':'Olivenöl','vegetable oil':'Pflanzenöl','sesame oil':'Sesamöl','soy sauce':'Sojasauce','tomato sauce':'Tomatensauce','tomato paste':'Tomatenmark',
  'coconut milk':'Kokosmilch','brown sugar':'brauner Zucker','black pepper':'schwarzer Pfeffer','chili flakes':'Chiliflocken','bay leaf':'Lorbeerblatt',
  'spring onion':'Frühlingszwiebel','green onion':'Frühlingszwiebel','bell pepper':'Paprika','sweet potato':'Süßkartoffel','cherry tomatoes':'Kirschtomaten',
  'chicken breast':'Hähnchenbrust','chicken thigh':'Hähnchenschenkel','ground beef':'Hackfleisch','lamb':'Lamm','pork':'Schweinefleisch','bacon':'Speck',
  'salmon':'Lachs','tuna':'Thunfisch','shrimp':'Garnelen','prawns':'Garnelen','cod':'Kabeljau','tofu':'Tofu','tempeh':'Tempeh',
  'chickpeas':'Kichererbsen','black beans':'schwarze Bohnen','lentils':'Linsen','peas':'Erbsen','corn':'Mais','broccoli':'Brokkoli',
  'cauliflower':'Blumenkohl','cabbage':'Kohl','carrot':'Karotte','carrots':'Karotten','celery':'Sellerie','zucchini':'Zucchini','cucumber':'Gurke',
  'eggplant':'Aubergine','aubergine':'Aubergine','mushroom':'Pilz','mushrooms':'Pilze','onion':'Zwiebel','onions':'Zwiebeln','shallot':'Schalotte',
  'garlic':'Knoblauch','ginger':'Ingwer','potato':'Kartoffel','potatoes':'Kartoffeln','tomato':'Tomate','tomatoes':'Tomaten','spinach':'Spinat','kale':'Grünkohl',
  'lettuce':'Salat','arugula':'Rucola','parsley':'Petersilie','cilantro':'Koriander','coriander':'Koriander','basil':'Basilikum','mint':'Minze','dill':'Dill',
  'thyme':'Thymian','rosemary':'Rosmarin','oregano':'Oregano','sage':'Salbei','cinnamon':'Zimt','nutmeg':'Muskatnuss','cumin':'Kreuzkümmel',
  'paprika powder':'Paprikapulver','curry powder':'Currypulver','turmeric':'Kurkuma','chili':'Chili','chilli':'Chili','saffron':'Safran','vanilla':'Vanille',
  'flour':'Mehl','breadcrumbs':'Semmelbrösel','yeast':'Hefe','baking powder':'Backpulver','baking soda':'Natron','cornstarch':'Speisestärke',
  'rice':'Reis','pasta':'Nudeln','spaghetti':'Spaghetti','noodles':'Nudeln','bread':'Brot','tortilla':'Tortilla','couscous':'Couscous','quinoa':'Quinoa','oats':'Haferflocken',
  'cheese':'Käse','parmesan':'Parmesan','mozzarella':'Mozzarella','feta':'Feta','cream cheese':'Frischkäse','yogurt':'Joghurt','milk':'Milch','cream':'Sahne','butter':'Butter',
  'eggs':'Eier','egg':'Ei','egg whites':'Eiweiß','honey':'Honig','maple syrup':'Ahornsirup','sugar':'Zucker','salt':'Salz','pepper':'Pfeffer','water':'Wasser',
  'stock':'Brühe','broth':'Brühe','wine':'Wein','white wine':'Weißwein','red wine':'Rotwein','vinegar':'Essig','lemon':'Zitrone','lime':'Limette',
};
const deRest: Dict = {
  'banana':'Banane','apple':'Apfel','strawberries':'Erdbeeren','blueberries':'Blaubeeren','mango':'Mango','coconut':'Kokosnuss','almonds':'Mandeln','walnuts':'Walnüsse',
  'peanuts':'Erdnüsse','chocolate':'Schokolade','cocoa':'Kakao','peanut butter':'Erdnussbutter','avocado':'Avocado','olives':'Oliven','pickles':'Gewürzgurken',
  'add':'hinzufügen','pour':'gießen','stir':'rühren','mix':'mischen','whisk':'verquirlen','beat':'schlagen','fold':'unterheben','blend':'pürieren',
  'cook':'kochen','bake':'backen','roast':'braten','grill':'grillen','fry':'braten','saute':'anbraten','boil':'kochen','simmer':'köcheln','steam':'dämpfen',
  'slice':'schneiden','chop':'hacken','dice':'würfeln','mince':'fein hacken','grate':'reiben','peel':'schälen','crush':'zerdrücken','mash':'zerstampfen',
  'knead':'kneten','roll out':'ausrollen','sift':'sieben','measure':'abmessen','combine':'verrühren','spread':'verstreichen','layer':'schichten','stuff':'füllen',
  'season':'würzen','marinate':'marinieren','sprinkle':'bestreuen','drizzle':'beträufeln','toss':'schwenken','fill':'füllen',
  'serve':'servieren','garnish':'garnieren','rest':'ruhen lassen','cool':'abkühlen','refrigerate':'kühlen','freeze':'einfrieren','reheat':'aufwärmen','preheat':'vorheizen',
  'divide':'teilen','transfer':'umfüllen','remove':'entfernen','place':'legen','cover':'abdecken',
  'large':'groß','small':'klein','medium':'mittel','thin':'dünn','thick':'dick','finely':'fein','roughly':'grob','fresh':'frisch','dried':'getrocknet','frozen':'gefroren',
  'cooked':'gekocht','raw':'roh','hot':'heiß','warm':'warm','cold':'kalt','sliced':'in Scheiben geschnitten','diced':'gewürfelt','chopped':'gehackt','minced':'gehackt',
  'grated':'gerieben','crushed':'zerdrückt','melted':'geschmolzen','softened':'weich','golden':'goldbraun','tender':'zart','crispy':'knusprig','smooth':'glatt',
  'optional':'optional','to taste':'nach Geschmack','lightly':'leicht','gently':'sanft','evenly':'gleichmäßig','thoroughly':'gründlich','quickly':'schnell',
  'teaspoon':'Teelöffel','tablespoon':'Esslöffel','cup':'Tasse','grams':'Gramm','minutes':'Minuten','hours':'Stunden','degrees':'Grad','pinch':'Prise','handful':'Handvoll',
  'cloves':'Zehen','pieces':'Stücke','bowl':'Schüssel','pan':'Pfanne','pot':'Topf','oven':'Ofen','tray':'Blech','baking sheet':'Backblech','skillet':'Pfanne',
  'saucepan':'Topf','spatula':'Pfannenwender','lid':'Deckel','foil':'Folie','fork':'Gabel','leftovers':'Reste',
  'the':'','and':'und','with':'mit','without':'ohne','of':'von','into':'in','for':'für','then':'dann','until':'bis','from':'aus','about':'etwa','a':'eine','in':'in','on':'auf','at':'bei','is':'ist','are':'sind','it':'es','to':'',
};
const fr: Dict = {
  'over medium heat':'à feu moyen','over high heat':'à feu vif','over low heat':'à feu doux','season with':'assaisonner de','serve with':'servir avec',
  'until tender':'jusqu’à tendreté','bring to a boil':'porter à ébullition','set aside':'réserver','in a bowl':'dans un bol','in a pan':'dans une poêle',
  'olive oil':'huile d’olive','vegetable oil':'huile végétale','soy sauce':'sauce soja','tomato sauce':'sauce tomate','coconut milk':'lait de coco',
  'brown sugar':'sucre roux','black pepper':'poivre noir','bell pepper':'poivron','sweet potato':'patate douce','chicken breast':'blanc de poulet',
  'ground beef':'bœuf haché','bacon':'lard','salmon':'saumon','tuna':'thon','shrimp':'crevettes','cod':'cabillaud','tofu':'tofu','lentils':'lentilles',
  'peas':'petits pois','corn':'maïs','broccoli':'brocoli','cabbage':'chou','carrot':'carotte','carrots':'carottes','celery':'céleri','zucchini':'courgette',
  'cucumber':'concombre','eggplant':'aubergine','mushroom':'champignon','mushrooms':'champignons','onion':'oignon','onions':'oignons','garlic':'ail',
  'ginger':'gingembre','potato':'pomme de terre','potatoes':'pommes de terre','tomato':'tomate','tomatoes':'tomates','spinach':'épinards','lettuce':'laitue',
  'parsley':'persil','cilantro':'coriandre','basil':'basilic','mint':'menthe','thyme':'thym','rosemary':'romarin','oregano':'origan','cinnamon':'cannelle',
  'cumin':'cumin','turmeric':'curcuma','flour':'farine','yeast':'levure','baking powder':'levure chimique','rice':'riz','pasta':'pâtes','noodles':'nouilles',
  'bread':'pain','couscous':'couscous','oats':'flocons d’avoine','cheese':'fromage','parmesan':'parmesan','mozzarella':'mozzarella','yogurt':'yaourt',
  'milk':'lait','cream':'crème','butter':'beurre','eggs':'œufs','egg':'œuf','honey':'miel','maple syrup':'sirop d’érable','sugar':'sucre','salt':'sel',
  'pepper':'poivre','water':'eau','stock':'bouillon','wine':'vin','vinegar':'vinaigre','lemon':'citron','lime':'citron vert','banana':'banane','apple':'pomme',
  'strawberries':'fraises','blueberries':'myrtilles','mango':'mangue','coconut':'noix de coco','almonds':'amandes','walnuts':'noix','chocolate':'chocolat',
  'avocado':'avocat','olives':'olives','add':'ajouter','pour':'verser','stir':'remuer','mix':'mélanger','whisk':'fouetter','beat':'battre','blend':'mixer',
  'cook':'cuire','bake':'cuire au four','roast':'rôtir','grill':'griller','fry':'frire','boil':'bouillir','simmer':'mijoter','steam':'cuire à la vapeur',
  'slice':'trancher','chop':'hacher','dice':'couper en dés','grate':'râper','peel':'éplucher','crush':'écraser','knead':'pétrir','sift':'tamiser',
  'spread':'étaler','season':'assaisonner','marinate':'mariner','sprinkle':'saupoudrer','drizzle':'arroser','serve':'servir','garnish':'garnir',
  'cool':'refroidir','freeze':'congeler','reheat':'réchauffer','preheat':'préchauffer','place':'placer','cover':'couvrir','remove':'retirer','large':'grand',
  'small':'petit','medium':'moyen','thin':'fin','thick':'épais','fresh':'frais','dried':'séché','frozen':'congelé','cooked':'cuit','raw':'cru','hot':'chaud',
  'cold':'froid','sliced':'tranché','diced':'en dés','chopped':'haché','grated':'râpé','softened':'ramolli','golden':'doré','tender':'tendre','crispy':'croustillant',
  'teaspoon':'cuillère à café','tablespoon':'cuillère à soupe','cup':'tasse','grams':'grammes','minutes':'minutes','hours':'heures','pinch':'pincée',
  'handful':'poignée','cloves':'gousses','bowl':'bol','pan':'poêle','pot':'casserole','oven':'four','the':'','and':'et','with':'avec','without':'sans',
  'of':'de','then':'puis','until':'jusqu’à','for':'pendant','about':'environ','in':'dans','on':'sur','at':'à','is':'est','it':'il','to':'',
};
const es: Dict = {
  'over medium heat':'a fuego medio','over high heat':'a fuego alto','over low heat':'a fuego bajo','until golden':'hasta que esté dorado',
  'season with':'sazonar con','serve with':'servir con','set aside':'reservar','in a bowl':'en un bol','in a pan':'en una sartén','olive oil':'aceite de oliva',
  'vegetable oil':'aceite vegetal','soy sauce':'salsa de soja','tomato sauce':'salsa de tomate','coconut milk':'leche de coco','brown sugar':'azúcar moreno',
  'black pepper':'pimienta negra','bell pepper':'pimiento','sweet potato':'batata','chicken breast':'pechuga de pollo','ground beef':'carne picada','bacon':'tocino',
  'salmon':'salmón','tuna':'atún','shrimp':'gambas','cod':'bacalao','tofu':'tofu','lentils':'lentejas','peas':'guisantes','corn':'maíz','broccoli':'brócoli',
  'cabbage':'col','carrot':'zanahoria','carrots':'zanahorias','celery':'apio','zucchini':'calabacín','cucumber':'pepino','eggplant':'berenjena','mushroom':'champiñón',
  'mushrooms':'champiñones','onion':'cebolla','onions':'cebollas','garlic':'ajo','ginger':'jengibre','potato':'patata','potatoes':'patatas','tomato':'tomate',
  'tomatoes':'tomates','spinach':'espinacas','lettuce':'lechuga','parsley':'perejil','cilantro':'cilantro','basil':'albahaca','mint':'menta','thyme':'tomillo',
  'rosemary':'romero','oregano':'orégano','cinnamon':'canela','cumin':'comino','turmeric':'cúrcuma','flour':'harina','yeast':'levadura','baking powder':'levadura en polvo',
  'rice':'arroz','pasta':'pasta','noodles':'fideos','bread':'pan','couscous':'cuscús','oats':'avena','cheese':'queso','parmesan':'parmesano','mozzarella':'mozzarella',
  'yogurt':'yogur','milk':'leche','cream':'crema','butter':'mantequilla','eggs':'huevos','egg':'huevo','honey':'miel','maple syrup':'sirope de arce','sugar':'azúcar',
  'salt':'sal','pepper':'pimienta','water':'agua','stock':'caldo','wine':'vino','vinegar':'vinagre','lemon':'limón','lime':'lima','banana':'plátano','apple':'manzana',
  'strawberries':'fresas','blueberries':'arándanos','mango':'mango','coconut':'coco','almonds':'almendras','walnuts':'nueces','chocolate':'chocolate','avocado':'aguacate',
  'olives':'aceitunas','add':'añadir','pour':'verter','stir':'remover','mix':'mezclar','whisk':'batir','beat':'batir','blend':'triturar','cook':'cocinar','bake':'hornear',
  'roast':'asar','grill':'asar a la parrilla','fry':'freír','boil':'hervir','simmer':'cocinar a fuego lento','steam':'cocinar al vapor','slice':'cortar en rodajas',
  'chop':'picar','dice':'cortar en dados','grate':'rallar','peel':'pelar','crush':'machacar','knead':'amasar','sift':'tamizar','spread':'untar','season':'sazonar',
  'marinate':'marinar','sprinkle':'espolvorear','drizzle':'rociar','serve':'servir','garnish':'decorar','cool':'enfriar','freeze':'congelar','reheat':'recalentar',
  'preheat':'precalentar','place':'colocar','cover':'cubrir','remove':'retirar','large':'grande','small':'pequeño','medium':'mediano','thin':'fino','thick':'grueso',
  'fresh':'fresco','dried':'seco','frozen':'congelado','cooked':'cocido','raw':'crudo','hot':'caliente','cold':'frío','sliced':'en rodajas','diced':'en dados',
  'chopped':'picado','grated':'rallado','softened':'ablandado','golden':'dorado','tender':'tierno','crispy':'crujiente','teaspoon':'cucharadita','tablespoon':'cucharada',
  'cup':'taza','grams':'gramos','minutes':'minutos','hours':'horas','pinch':'pizca','handful':'puñado','cloves':'dientes','bowl':'bol','pan':'sartén','pot':'olla',
  'oven':'horno','the':'','and':'y','with':'con','without':'sin','of':'de','then':'luego','until':'hasta','for':'por','about':'aproximadamente','in':'en','on':'sobre',
  'at':'a','is':'es','it':'lo','to':'',
};
const it: Dict = {
  'over medium heat':'a fuoco medio','over high heat':'a fuoco vivo','over low heat':'a fuoco basso','season with':'condire con','serve with':'servire con',
  'set aside':'mettere da parte','in a bowl':'in una ciotola','in a pan':'in una padella','olive oil':'olio d’oliva','soy sauce':'salsa di soia',
  'tomato sauce':'salsa di pomodoro','coconut milk':'latte di cocco','brown sugar':'zucchero di canna','black pepper':'pepe nero','bell pepper':'peperone',
  'sweet potato':'patata dolce','chicken breast':'petto di pollo','ground beef':'carne macinata','bacon':'pancetta','salmon':'salmone','tuna':'tonno',
  'shrimp':'gamberi','cod':'merluzzo','tofu':'tofu','lentils':'lenticchie','peas':'piselli','corn':'mais','broccoli':'broccoli','cabbage':'cavolo',
  'carrot':'carota','carrots':'carote','celery':'sedano','zucchini':'zucchina','cucumber':'cetriolo','eggplant':'melanzana','mushroom':'fungo',
  'mushrooms':'funghi','onion':'cipolla','onions':'cipolle','garlic':'aglio','ginger':'zenzero','potato':'patata','potatoes':'patate','tomato':'pomodoro',
  'tomatoes':'pomodori','spinach':'spinaci','lettuce':'lattuga','parsley':'prezzemolo','basil':'basilico','mint':'menta','thyme':'timo','rosemary':'rosmarino',
  'oregano':'origano','cinnamon':'cannella','cumin':'cumino','turmeric':'curcuma','flour':'farina','yeast':'lievito','baking powder':'lievito in polvere',
  'rice':'riso','pasta':'pasta','noodles':'tagliatelle','bread':'pane','couscous':'cous cous','oats':'avena','cheese':'formaggio','parmesan':'parmigiano',
  'mozzarella':'mozzarella','yogurt':'yogurt','milk':'latte','cream':'panna','butter':'burro','eggs':'uova','egg':'uovo','honey':'miele','sugar':'zucchero',
  'salt':'sale','pepper':'pepe','water':'acqua','stock':'brodo','wine':'vino','vinegar':'aceto','lemon':'limone','lime':'lime','banana':'banana','apple':'mela',
  'strawberries':'fragole','blueberries':'mirtilli','mango':'mango','coconut':'cocco','almonds':'mandorle','walnuts':'noci','chocolate':'cioccolato',
  'avocado':'avocado','olives':'olive','add':'aggiungere','pour':'versare','stir':'mescolare','mix':'mescolare','whisk':'sbattere','beat':'sbattere',
  'blend':'frullare','cook':'cuocere','bake':'cuocere al forno','roast':'arrostire','grill':'grillare','fry':'friggere','boil':'bollire','simmer':'sobbollire',
  'steam':'cuocere al vapore','slice':'affettare','chop':'tritare','dice':'tagliare a cubetti','grate':'grattugiare','peel':'pelare','crush':'schiacciare',
  'knead':'impastare','sift':'setacciare','spread':'spalmare','season':'condire','marinate':'marinare','sprinkle':'cospargere','drizzle':'irrorare',
  'serve':'servire','garnish':'guarnire','cool':'raffreddare','freeze':'congelare','reheat':'riscaldare','preheat':'preriscaldare','place':'mettere',
  'cover':'coprire','remove':'rimuovere','large':'grande','small':'piccolo','medium':'medio','thin':'sottile','thick':'spesso','fresh':'fresco','dried':'secco',
  'frozen':'congelato','cooked':'cotto','raw':'crudo','hot':'caldo','cold':'freddo','sliced':'a fette','diced':'a cubetti','chopped':'tritato','grated':'grattugiato',
  'softened':'ammorbidito','golden':'dorato','tender':'tenero','crispy':'croccante','teaspoon':'cucchiaino','tablespoon':'cucchiaio','cup':'tazza',
  'grams':'grammi','minutes':'minuti','hours':'ore','pinch':'pizzico','handful':'manciata','cloves':'spicchi','bowl':'ciotola','pan':'padella','pot':'pentola',
  'oven':'forno','the':'','and':'e','with':'con','without':'senza','of':'di','then':'poi','until':'fino a','for':'per','about':'circa','in':'in','on':'su','at':'a',
  'is':'è','it':'lo','to':'',
};
const tr: Dict = {
  'over medium heat':'orta ateşte','over high heat':'yüksek ateşte','over low heat':'kısık ateşte','season with':'ile tatlandır','serve with':'ile servis et',
  'set aside':'bir kenara al','in a bowl':'bir kasede','in a pan':'bir tavada','olive oil':'zeytinyağı','soy sauce':'soya sosu','tomato sauce':'domates sosu',
  'coconut milk':'hindistan cevizi sütü','brown sugar':'esmer şeker','black pepper':'karabiber','bell pepper':'biber','sweet potato':'tatlı patates',
  'chicken breast':'tavuk göğsü','ground beef':'kıyma','bacon':'pastırma','salmon':'somon','tuna':'ton balığı','shrimp':'karides','cod':'morina','tofu':'tofu',
  'lentils':'mercimek','peas':'bezelye','corn':'mısır','broccoli':'brokoli','cabbage':'lahana','carrot':'havuç','celery':'kereviz','zucchini':'kabak',
  'cucumber':'salatalık','eggplant':'patlıcan','mushroom':'mantar','onion':'soğan','garlic':'sarımsak','ginger':'zencefil','potato':'patates','tomato':'domates',
  'spinach':'ıspanak','lettuce':'marul','parsley':'maydanoz','basil':'fesleğen','mint':'nane','thyme':'kekik','rosemary':'biberiye','oregano':'kekik',
  'cinnamon':'tarçın','cumin':'kimyon','turmeric':'zerdeçal','flour':'un','yeast':'maya','baking powder':'kabartma tozu','rice':'pirinç','pasta':'makarna',
  'noodles':'erişte','bread':'ekmek','couscous':'kuskus','oats':'yulaf','cheese':'peynir','parmesan':'parmesan','yogurt':'yoğurt','milk':'süt','cream':'krema',
  'butter':'tereyağı','eggs':'yumurta','egg':'yumurta','honey':'bal','sugar':'şeker','salt':'tuz','pepper':'biber','water':'su','stock':'et suyu','wine':'şarap',
  'vinegar':'sirke','lemon':'limon','banana':'muz','apple':'elma','strawberries':'çilek','mango':'mango','coconut':'hindistan cevizi','almonds':'badem',
  'walnuts':'ceviz','chocolate':'çikolata','avocado':'avokado','olives':'zeytin','add':'ekle','pour':'dök','stir':'karıştır','mix':'karıştır','whisk':'çırp',
  'beat':'çırp','blend':'blenderdan geçir','cook':'pişir','bake':'fırında pişir','roast':'kızart','grill':'ızgara yap','fry':'kızart','boil':'kaynat',
  'simmer':'kısık ateşte pişir','steam':'buharda pişir','slice':'dilimle','chop':'doğra','dice':'küp küp doğra','grate':'rendeleyin','peel':'soy',
  'crush':'ez','knead':'yoğur','sift':'ele','spread':'yay','season':'baharatla','marinate':'marine et','sprinkle':'serp','drizzle':'gezdir',
  'serve':'servis et','garnish':'süsle','cool':'soğut','freeze':'dondur','reheat':'ısıt','preheat':'önceden ısıt','place':'koy','cover':'kapat','remove':'çıkar',
  'large':'büyük','small':'küçük','medium':'orta','thin':'ince','thick':'kalın','fresh':'taze','dried':'kuru','frozen':'donmuş','cooked':'pişmiş','raw':'çiğ',
  'hot':'sıcak','cold':'soğuk','sliced':'dilimlenmiş','diced':'küp doğranmış','chopped':'doğranmış','grated':'rendelenmiş','golden':'altın rengi','tender':'yumuşak',
  'teaspoon':'çay kaşığı','tablespoon':'yemek kaşığı','cup':'bardak','grams':'gram','minutes':'dakika','hours':'saat','pinch':'tutam','handful':'avuç',
  'cloves':'diş','bowl':'kase','pan':'tava','pot':'tencere','oven':'fırın','the':'','and':'ve','with':'ile','without':'olmadan','of':'','then':'sonra',
  'until':'kadar','for':'için','about':'yaklaşık','in':'içinde','on':'üzerinde','at':'de','is':'dir','it':'o','to':'',
};
const pt: Dict = {
  'over medium heat':'em fogo médio','over high heat':'em fogo alto','over low heat':'em fogo baixo','season with':'temperar com','serve with':'servir com',
  'set aside':'reservar','in a bowl':'numa tigela','in a pan':'numa frigideira','olive oil':'azeite','soy sauce':'molho de soja','tomato sauce':'molho de tomate',
  'coconut milk':'leite de coco','brown sugar':'açúcar mascavo','black pepper':'pimenta-do-reino','bell pepper':'pimentão','sweet potato':'batata-doce',
  'chicken breast':'peito de frango','ground beef':'carne moída','bacon':'bacon','salmon':'salmão','tuna':'atum','shrimp':'camarão','cod':'bacalhau','tofu':'tofu',
  'lentils':'lentilhas','peas':'ervilhas','corn':'milho','broccoli':'brócolis','cabbage':'repolho','carrot':'cenoura','celery':'aipo','zucchini':'abobrinha',
  'cucumber':'pepino','eggplant':'berinjela','mushroom':'cogumelo','onion':'cebola','garlic':'alho','ginger':'gengibre','potato':'batata','tomato':'tomate',
  'spinach':'espinafre','lettuce':'alface','parsley':'salsa','basil':'manjericão','mint':'hortelã','thyme':'tomilho','rosemary':'alecrim','oregano':'orégano',
  'cinnamon':'canela','cumin':'cominho','turmeric':'cúrcuma','flour':'farinha','yeast':'fermento','baking powder':'fermento em pó','rice':'arroz','pasta':'massa',
  'noodles':'macarrão','bread':'pão','oats':'aveia','cheese':'queijo','parmesan':'parmesão','yogurt':'iogurte','milk':'leite','cream':'creme','butter':'manteiga',
  'eggs':'ovos','egg':'ovo','honey':'mel','sugar':'açúcar','salt':'sal','pepper':'pimenta','water':'água','stock':'caldo','wine':'vinho','vinegar':'vinagre',
  'lemon':'limão','banana':'banana','apple':'maçã','strawberries':'morangos','mango':'manga','coconut':'coco','almonds':'amêndoas','walnuts':'nozes',
  'chocolate':'chocolate','avocado':'abacate','olives':'azeitonas','add':'adicionar','pour':'despejar','stir':'mexer','mix':'misturar','whisk':'bater',
  'beat':'bater','blend':'bater no liquidificador','cook':'cozinhar','bake':'assar','roast':'assar','grill':'grelhar','fry':'fritar','boil':'ferver',
  'simmer':'cozinhar em fogo baixo','steam':'cozinhar no vapor','slice':'fatiar','chop':'picar','dice':'cortar em cubos','grate':'ralar','peel':'descascar',
  'crush':'amassar','knead':'sovar','sift':'peneirar','spread':'espalhar','season':'temperar','marinate':'marinar','sprinkle':'polvilhar','drizzle':'regar',
  'serve':'servir','garnish':'guarnecer','cool':'esfriar','freeze':'congelar','reheat':'reaquecer','preheat':'preaquecer','place':'colocar','cover':'cobrir',
  'remove':'remover','large':'grande','small':'pequeno','medium':'médio','thin':'fino','thick':'grosso','fresh':'fresco','dried':'seco','frozen':'congelado',
  'cooked':'cozido','raw':'cru','hot':'quente','cold':'frio','sliced':'fatiado','diced':'em cubos','chopped':'picado','grated':'ralado','golden':'dourado',
  'tender':'macio','teaspoon':'colher de chá','tablespoon':'colher de sopa','cup':'xícara','grams':'gramas','minutes':'minutos','hours':'horas','pinch':'pitada',
  'handful':'punhado','cloves':'dentes','bowl':'tigela','pan':'frigideira','pot':'panela','oven':'forno','the':'','and':'e','with':'com','without':'sem',
  'of':'de','then':'então','until':'até','for':'por','about':'cerca de','in':'em','on':'sobre','at':'a','is':'é','it':'o','to':'',
};
const nl: Dict = {
  'over medium heat':'op middelhoog vuur','over high heat':'op hoog vuur','over low heat':'op laag vuur','season with':'kruiden met','serve with':'serveren met',
  'set aside':'opzij zetten','in a bowl':'in een kom','olive oil':'olijfolie','soy sauce':'sojasaus','tomato sauce':'tomatensaus','coconut milk':'kokosmelk',
  'brown sugar':'bruine suiker','black pepper':'zwarte peper','bell pepper':'paprika','sweet potato':'zoete aardappel','chicken breast':'kippenborst',
  'ground beef':'gehakt','bacon':'spek','salmon':'zalm','shrimp':'garnalen','tofu':'tofu','lentils':'linzen','peas':'erwten','corn':'mais','broccoli':'broccoli',
  'cabbage':'kool','carrot':'wortel','celery':'selderij','zucchini':'courgette','cucumber':'komkommer','eggplant':'aubergine','mushroom':'paddenstoel',
  'onion':'ui','garlic':'knoflook','ginger':'gember','potato':'aardappel','tomato':'tomaat','spinach':'spinazie','lettuce':'sla','parsley':'peterselie',
  'basil':'basilicum','mint':'munt','thyme':'tijm','rosemary':'rozemarijn','oregano':'oregano','cinnamon':'kaneel','cumin':'komijn','turmeric':'kurkuma',
  'flour':'bloem','yeast':'gist','baking powder':'bakpoeder','rice':'rijst','pasta':'pasta','noodles':'noedels','bread':'brood','oats':'havermout',
  'cheese':'kaas','parmesan':'parmezaan','yogurt':'yoghurt','milk':'melk','cream':'room','butter':'boter','eggs':'eieren','egg':'ei','honey':'honing',
  'sugar':'suiker','salt':'zout','pepper':'peper','water':'water','stock':'bouillon','wine':'wijn','vinegar':'azijn','lemon':'citroen','banana':'banaan',
  'apple':'appel','strawberries':'aardbeien','mango':'mango','coconut':'kokosnoot','almonds':'amandelen','walnuts':'walnoten','chocolate':'chocolade',
  'avocado':'avocado','olives':'olijven','add':'toevoegen','pour':'gieten','stir':'roeren','mix':'mengen','whisk':'kloppen','beat':'kloppen','blend':'pureren',
  'cook':'koken','bake':'bakken','roast':'roosteren','grill':'grillen','fry':'bakken','boil':'koken','simmer':'sudderen','steam':'stomen','slice':'snijden',
  'chop':'hakken','dice':'in blokjes snijden','grate':'raspen','peel':'schillen','crush':'pletten','knead':'kneden','sift':'zeven','spread':'uitsmeren',
  'season':'kruiden','marinate':'marineren','sprinkle':'bestrooien','drizzle':'druppelen','serve':'serveren','garnish':'garneren','cool':'afkoelen',
  'freeze':'invriezen','reheat':'opwarmen','preheat':'voorverwarmen','place':'plaatsen','cover':'bedekken','remove':'verwijderen','large':'groot','small':'klein',
  'medium':'middelgroot','thin':'dun','thick':'dik','fresh':'vers','dried':'gedroogd','frozen':'bevroren','cooked':'gekookt','raw':'rauw','hot':'heet',
  'cold':'koud','sliced':'gesneden','diced':'in blokjes','chopped':'gehakt','grated':'geraspt','golden':'goudbruin','tender':'zacht','teaspoon':'theelepel',
  'tablespoon':'eetlepel','cup':'kopje','grams':'gram','minutes':'minuten','hours':'uren','pinch':'snufje','handful':'handvol','cloves':'teentjes',
  'bowl':'kom','pan':'pan','pot':'pot','oven':'oven','the':'','and':'en','with':'met','without':'zonder','of':'van','then':'dan','until':'totdat','for':'voor',
  'about':'ongeveer','in':'in','on':'op','at':'bij','is':'is','it':'het','to':'',
};
const ru: Dict = {
  'over medium heat':'на среднем огне','over high heat':'на сильном огне','over low heat':'на слабом огне','season with':'приправить','serve with':'подавать с',
  'set aside':'отложить','olive oil':'оливковое масло','soy sauce':'соевый соус','tomato sauce':'томатный соус','coconut milk':'кокосовое молоко',
  'brown sugar':'коричневый сахар','black pepper':'чёрный перец','bell pepper':'перец','sweet potato':'батат','chicken breast':'куриная грудка',
  'ground beef':'фарш','bacon':'бекон','salmon':'лосось','tuna':'тунец','shrimp':'креветки','cod':'треска','tofu':'тофу','lentils':'чечевица','peas':'горох',
  'corn':'кукуруза','broccoli':'брокколи','cabbage':'капуста','carrot':'морковь','celery':'сельдерей','zucchini':'кабачок','cucumber':'огурец',
  'eggplant':'баклажан','mushroom':'гриб','onion':'лук','garlic':'чеснок','ginger':'имбирь','potato':'картофель','tomato':'помидор','spinach':'шпинат',
  'lettuce':'салат','parsley':'петрушка','basil':'базилик','mint':'мята','thyme':'тимьян','rosemary':'розмарин','oregano':'орегано','cinnamon':'корица',
  'cumin':'кумин','turmeric':'куркума','flour':'мука','yeast':'дрожжи','baking powder':'разрыхлитель','rice':'рис','pasta':'паста','noodles':'лапша',
  'bread':'хлеб','oats':'овсянка','cheese':'сыр','parmesan':'пармезан','yogurt':'йогурт','milk':'молоко','cream':'сливки','butter':'масло','eggs':'яйца',
  'egg':'яйцо','honey':'мёд','sugar':'сахар','salt':'соль','pepper':'перец','water':'вода','stock':'бульон','wine':'вино','vinegar':'уксус','lemon':'лимон',
  'banana':'банан','apple':'яблоко','strawberries':'клубника','mango':'манго','coconut':'кокос','almonds':'миндаль','walnuts':'грецкие орехи',
  'chocolate':'шоколад','avocado':'авокадо','olives':'оливки','add':'добавить','pour':'влить','stir':'перемешать','mix':'смешать','whisk':'взбить',
  'beat':'взбить','blend':'пробить блендером','cook':'готовить','bake':'запекать','roast':'жарить','grill':'гриль','fry':'жарить','boil':'варить',
  'simmer':'тушить на медленном огне','steam':'готовить на пару','slice':'нарезать','chop':'измельчить','dice':'нарезать кубиками','grate':'натереть',
  'peel':'очистить','crush':'раздавить','knead':'замесить','sift':'просеять','spread':'распределить','season':'приправить','marinate':'мариновать',
  'sprinkle':'посыпать','drizzle':'сбрызнуть','serve':'подавать','garnish':'украсить','cool':'остудить','freeze':'заморозить','reheat':'разогреть',
  'preheat':'разогреть заранее','place':'поместить','cover':'накрыть','remove':'убрать','large':'большой','small':'маленький','medium':'средний',
  'thin':'тонкий','thick':'толстый','fresh':'свежий','dried':'сушёный','frozen':'замороженный','cooked':'готовый','raw':'сырой','hot':'горячий',
  'cold':'холодный','sliced':'нарезанный','diced':'кубиками','chopped':'измельчённый','grated':'тёртый','golden':'золотистый','tender':'мягкий',
  'teaspoon':'чайная ложка','tablespoon':'столовая ложка','cup':'стакан','grams':'грамм','minutes':'минут','hours':'часов','pinch':'щепотка',
  'handful':'горсть','cloves':'зубчиков','bowl':'миска','pan':'сковорода','pot':'кастрюля','oven':'духовка','the':'','and':'и','with':'с','without':'без',
  'of':'','then':'затем','until':'до','for':'для','about':'около','in':'в','on':'на','at':'в','is':'это','it':'это','to':'',
};

/* Large "core" vocabulary for German: verbs, time words, adjectives, tools and
   units that appear in almost every recipe and were missing before. */
const deCore: Dict = {
  'make':'zubereiten','prepare':'vorbereiten','cut':'schneiden','chop':'hacken','slice':'in Scheiben schneiden','dice':'würfeln',
  'mince':'fein hacken','peel':'schälen','grate':'reiben','crush':'zerdrücken','squeeze':'auspressen','blend':'pürieren',
  'puree':'pürieren','mash':'zerstampfen','knead':'kneten','whisk':'verquirlen','beat':'aufschlagen','fold':'unterheben',
  'stir':'rühren','mix':'mischen','combine':'vermengen','toss':'mischen','coat':'wenden','dip':'eintauchen','brush':'bestreichen',
  'grease':'einfetten','season':'würzen','taste':'abschmecken','simmer':'köcheln','boil':'kochen','steam':'dämpfen',
  'poach':'pochieren','fry':'braten','sauté':'anbraten','saute':'anbraten','roast':'braten','bake':'backen','grill':'grillen',
  'braise':'schmoren','stew':'schmoren','caramelize':'karamellisieren','reduce':'einkochen','thicken':'binden','chill':'kühlen',
  'freeze':'einfrieren','melt':'schmelzen','warm':'erwärmen','reheat':'aufwärmen','drain':'abgießen','rinse':'abspülen',
  'soak':'einweichen','marinate':'marinieren','rest':'ruhen','serve':'servieren','garnish':'garnieren','sprinkle':'bestreuen',
  'drizzle':'beträufeln','pour':'gießen','transfer':'umfüllen','remove':'entfernen','reserve':'beiseite stellen','arrange':'anrichten',
  'spread':'verstreichen','stuff':'füllen','fill':'füllen','wrap':'einwickeln','seal':'verschließen',
  'preheat':'vorheizen','cook':'garen','add':'hinzufügen','use':'verwenden','keep':'behalten','cover':'abdecken','uncover':'aufdecken',
  'wash':'waschen','dry':'trocknen','let':'lassen','need':'brauchen','take':'nehmen','put':'geben','place':'legen',
  'bring':'bringen','continue':'weitermachen','repeat':'wiederholen','check':'prüfen','adjust':'anpassen','turn':'wenden',
  'drain and rinse':'abgießen und abspülen','set aside':'beiseite stellen','let it rest':'ruhen lassen','bring to a boil':'zum Kochen bringen',
  'reduce the heat':'Hitze reduzieren','preheat the oven':'Ofen vorheizen','remove from heat':'vom Herd nehmen',
  'then':'dann','next':'danach','finally':'zum Schluss','meanwhile':'in der Zwischenzeit','while':'während','until':'bis',
  'after':'nach','before':'vor','again':'wieder','about':'etwa','roughly':'etwa','approximately':'ungefähr','optional':'optional',
  'if needed':'nach Bedarf','to taste':'nach Geschmack','at least':'mindestens','immediately':'sofort',
  'slowly':'langsam','quickly':'schnell','carefully':'vorsichtig','gently':'vorsichtig','well':'gut','evenly':'gleichmäßig',
  'lightly':'leicht','thoroughly':'gründlich','just':'nur','only':'nur','also':'außerdem','or':'oder','into':'in','onto':'auf',
  'over':'über','under':'unter','side':'Seite','sides':'Seiten','top':'oben','bottom':'unten','inside':'innen','outside':'außen',
  // adjectives
  'small':'klein','large':'groß','medium':'mittelgroß','thin':'dünn','thick':'dick','fine':'fein','fresh':'frisch','dried':'getrocknet',
  'frozen':'gefroren','canned':'aus der Dose','chopped':'gehackt','sliced':'in Scheiben geschnitten','diced':'gewürfelt',
  'minced':'fein gehackt','grated':'gerieben','whole':'ganz','half':'halbe','quarters':'Viertel','ripe':'reif','soft':'weich',
  'firm':'fest','hot':'heiß','cold':'kalt','room temperature':'Zimmertemperatur','remaining':'restlich','leftover':'übrig',
  'extra':'extra','more':'mehr','less':'weniger','few':'wenige','several':'mehrere','other':'andere','same':'gleich',
  'golden brown':'goldbraun','crispy':'knusprig','tender':'zart','tough':'zäh','juicy':'saftig','wet':'nass','sweet':'süß',
  'salty':'salzig','spicy':'scharf','mild':'mild','bitter':'bitter','sour':'sauer','savory':'herzhaft','plain':'schlicht','rich':'reich',
  'healthy':'gesund','delicious':'köstlich','flavorful':'aromatisch','flavourful':'aromatisch','perfect':'perfekt','desired':'gewünscht',
  // kitchen, tools and containers
  'pan':'Pfanne','skillet':'Pfanne','pot':'Topf','saucepan':'kleiner Topf','bowl':'Schüssel','plate':'Teller','dish':'Form',
  'tray':'Blech','baking sheet':'Backblech','oven':'Ofen','fridge':'Kühlschrank','freezer':'Gefrierschrank','blender':'Mixer',
  'food processor':'Küchenmaschine','spoon':'Löffel','fork':'Gabel','knife':'Messer','board':'Brett',
  'cutting board':'Schneidebrett','towel':'Tuch','foil':'Folie','parchment paper':'Backpapier','lid':'Deckel','strainer':'Sieb',
  'colander':'Sieb','grater':'Reibe','peeler':'Schäler','scale':'Waage','cup':'Tasse','mug':'Becher','jar':'Glas',
  // dough, cuts and food groups
  'dough':'Teig','batter':'Teig','mixture':'Mischung','sauce':'Sauce','dressing':'Dressing','marinade':'Marinade','broth':'Brühe',
  'stuffing':'Füllung','filling':'Füllung','topping':'Topping','layer':'Schicht','piece':'Stück','pieces':'Stücke','strips':'Streifen',
  'cubes':'Würfel','rounds':'Scheiben','halves':'Hälften','juice':'Saft','zest':'Abrieb','rind':'Schale','seeds':'Samen','leaves':'Blätter',
  'stalk':'Stange','clove':'Zehe','cloves':'Zehen','head':'Kopf','bunch':'Bund','pinch':'Prise','dash':'Spritzer','handful':'Handvoll',
  'meat':'Fleisch','chicken':'Hähnchen','beef':'Rindfleisch','lamb':'Lammfleisch','pork':'Schweinefleisch','fish':'Fisch',
  'seafood':'Meeresfrüchte','vegetables':'Gemüse','fruit':'Obst','herbs':'Kräuter','spices':'Gewürze','dumplings':'Teigtaschen',
  'beans':'Bohnen','oil':'Öl','seasoning':'Gewürz','cheese':'Käse','yogurt':'Joghurt',
  // units
  'grams':'Gramm','gram':'Gramm','kilograms':'Kilogramm','milliliters':'Milliliter','liters':'Liter','tablespoon':'Esslöffel',
  'tablespoons':'Esslöffel','teaspoon':'Teelöffel','teaspoons':'Teelöffel','ounce':'Unze','pound':'Pfund','degrees':'Grad',
  'minutes':'Minuten','minute':'Minute','hours':'Stunden','hour':'Stunde','seconds':'Sekunden','min':'Min',
};


/* Arabic dictionary: ingredient and technique terms used in the catalog. */
const ar: Dict = {
  'olive oil': 'زيت زيتون', 'soy sauce': 'صلصة الصويا', 'tomato sauce': 'صلصة الطماطم', 'coconut milk': 'حليب جوز الهند',
  'brown sugar': 'سكر بني', 'black pepper': 'فلفل أسود', 'bell pepper': 'فلفل حلو', 'sweet potato': 'بطاطا حلوة',
  'chicken breast': 'صدر دجاج', 'ground beef': 'لحم مفروم', salmon: 'سلمون', tuna: 'تونة', shrimp: 'روبيان',
  cod: 'سمك القد', tofu: 'توفو', lentils: 'عدس', peas: 'بازلاء', corn: 'ذرة', broccoli: 'بروكلي',
  cabbage: 'ملفوف', carrot: 'جزر', celery: 'كرفس', zucchini: 'كوسا', cucumber: 'خيار', eggplant: 'باذنجان',
  mushroom: 'فطر', onion: 'بصل', garlic: 'ثوم', ginger: 'زنجبيل', potato: 'بطاطا', tomato: 'طماطم',
  spinach: 'سبانخ', lettuce: 'خس', parsley: 'بقدونس', basil: 'ريحان', mint: 'نعناع', thyme: 'زعتر',
  cinnamon: 'قرفة', cumin: 'كمون', turmeric: 'كركم', flour: 'طحين', yeast: 'خميرة', rice: 'أرز',
  pasta: 'معكرونة', noodles: 'شعرية', bread: 'خبز', oats: 'شوفان', cheese: 'جبنة', yogurt: 'زبادي',
  milk: 'حليب', cream: 'كريمة', butter: 'زبدة', eggs: 'بيض', egg: 'بيضة', honey: 'عسل', water: 'ماء',
  stock: 'مرق', vinegar: 'خل', lemon: 'ليمون', banana: 'موز', apple: 'تفاح', mango: 'مانجو',
  chocolate: 'شوكولاتة', avocado: 'أفوكادو', olives: 'زيتون', sugar: 'سكر', salt: 'ملح',
  pour: 'اسكب', stir: 'حرّك', mix: 'اخلط', beat: 'اخفق', blend: 'اخلط في الخلاط', cook: 'اطبخ',
  bake: 'اخبز', grill: 'اشوِ', fry: 'اقلي', boil: 'اسلق', steam: 'اطبخ بالبخار', slice: 'قطّع شرائح',
  dice: 'قطّع مكعبات', grate: 'ابشر', peel: 'قشّر', crush: 'اسحق', sift: 'انخل', spread: 'افرد',
  sprinkle: 'رشّ', serve: 'قدّم', garnish: 'زيّن', cool: 'اتركه يبرد', freeze: 'جمّد', reheat: 'سخّن',
  place: 'ضع', cover: 'غطّ', remove: 'ارفع', large: 'كبير', small: 'صغير', medium: 'متوسط',
  thin: 'رفيع', thick: 'سميك', frozen: 'مجمّد', cooked: 'مطبوخ', raw: 'نيء', hot: 'ساخن', cold: 'بارد',
  golden: 'ذهبي', tender: 'طري', teaspoon: 'ملعقة صغيرة', tablespoon: 'ملعقة كبيرة', cup: 'كوب',
  grams: 'غرام', minutes: 'دقائق', pinch: 'رشة', handful: 'حفنة', cloves: 'فصوص', bowl: 'وعاء',
  pan: 'مقلاة', pot: 'قدر', oven: 'فرن', the: '', and: 'و', of: 'من', then: 'ثم', until: 'حتى',
  for: 'لمدة', about: 'حوالي', in: 'في', on: 'على', at: 'عند',
};

const maps: Record<string, Dict> = {
  ar,
  de: { ...de, ...deRest, ...deCore },
  fr, es, it, tr, pt, nl, ru,
};

/* 2.0.0: merge the large shared vocabulary (recipe-translate-extra.ts) in
   additively - curated entries always win, the extras only close the gaps, so
   the offline translation now covers produce, dairy, meat, fish, spices,
   bakery, tools, units, prepared states and instruction phrases in all 9
   languages instead of leaving half the sentence in English. */
for (const [term, byLang] of Object.entries(EXTRA_TERMS)) {
  for (const [lang, translation] of Object.entries(byLang)) {
    const dict = maps[lang];
    if (!dict || !translation) continue;
    if (dict[term] === undefined) dict[term] = translation;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Culinary glossary (2.0.0): technique and kitchen terms that must never be
 * translated word-by-word. Applied before the offline dictionaries and before
 * any online translator, so "fold the batter" becomes "den Teig unterheben"
 * instead of a literal translation.
 */
const GLOSSARY: Record<string, Record<string, string>> = {
  fold: { de: 'unterheben', fr: 'incorporer', es: 'incorporar', it: 'incorporare', tr: 'katlayarak karistir', pt: 'envolver', nl: 'spatel erdoor', ru: 'аккуратно перемешать' },
  'fold in': { de: 'unterheben', fr: 'incorporer', es: 'incorporar', it: 'incorporare', tr: 'hafifçe karıştır', pt: 'envolver', nl: 'erdoor spatelen', ru: 'аккуратно вмешать' , ar: 'اطوِ بلطف في الخليط' },
  whisk: { de: 'verquirlen', fr: 'fouetter', es: 'batir', it: 'sbattere', tr: 'çırpmak', pt: 'bater', nl: 'kloppen', ru: 'взбить венчиком' },
  simmer: { de: 'sanft köcheln lassen', fr: 'laisser mijoter', es: 'cocer a fuego lento', it: 'sobbollire', tr: 'kısık ateşte pişirmek', pt: 'cozinhar em lume brando', nl: 'zachtjes laten sudderen', ru: 'тушить на медленном огне' },
  sear: { de: 'scharf anbraten', fr: 'saisir', es: 'sellar', it: 'scottare', tr: 'mühürlemek', pt: 'selar', nl: 'dichtschroeien', ru: 'обжарить до корочки' },
  deglaze: { de: 'mit Flüssigkeit ablöschen', fr: 'déglacer', es: 'desglasar', it: 'sfumare', tr: 'suyu çözmek', pt: 'desglaciar', nl: 'blussen', ru: 'снять жаркое с жаровни жидкостью' },
  julienne: { de: 'in feine Streifen schneiden', fr: 'tailler en julienne', es: 'cortar en juliana', it: 'tagliare a julienne', tr: 'ince uzun doğramak', pt: 'cortar em juliana', nl: 'in fijne reepjes snijden', ru: 'нарезать соломкой' },
  knead: { de: 'kneten', fr: 'pétrir', es: 'amasar', it: 'impastare', tr: 'yoğurmak', pt: 'amassar', nl: 'kneden', ru: 'вымесить' },
  marinate: { de: 'marinieren', fr: 'faire mariner', es: 'marinar', it: 'marinare', tr: 'marine etmek', pt: 'marinar', nl: 'marineren', ru: 'мариновать' },
  'bring to a boil': { de: 'zum Kochen bringen', fr: 'porter à ébullition', es: 'llevar a ebullición', it: 'portare a ebollizione', tr: 'kaynatmak', pt: 'levar a ferver', nl: 'aan de kook brengen', ru: 'довести до кипения' , ar: 'اتركه حتى يغلي' },
  'reduce the heat': { de: 'die Hitze reduzieren', fr: 'baisser le feu', es: 'bajar el fuego', it: 'ridurre il fuoco', tr: 'ateşi kısmak', pt: 'reduzir o lume', nl: 'het vuur lager zetten', ru: 'уменьшить огонь' , ar: 'قلّل النار' },
  'preheat the oven': { de: 'den Ofen vorheizen', fr: 'préchauffer le four', es: 'precalentar el horno', it: 'preriscaldare il forno', tr: 'fırını ısıtmak', pt: 'pré-aquecer o forno', nl: 'de oven voorverwarmen', ru: 'разогреть духовку' , ar: 'سخّن الفرن مسبقًا' },
  'season to taste': { de: 'mit Salz und Pfeffer abschmecken', fr: 'assaisonner selon le goût', es: 'sazonar al gusto', it: 'condire a piacere', tr: 'damak zevkine göre baharatlamak', pt: 'temperar a gosto', nl: 'op smaak brengen', ru: 'приправить по вкусу' , ar: 'تبّل حسب الرغبة' },
  drain: { de: 'abgießen', fr: 'égoutter', es: 'escurrir', it: 'scolare', tr: 'süzmek', pt: 'escorrer', nl: 'afgieten', ru: 'сцедить' },
  'set aside': { de: 'beiseitestellen', fr: 'réserver', es: 'reservar', it: 'mettere da parte', tr: 'kenara almak', pt: 'reservar', nl: 'apart zetten', ru: 'отложить в сторону' , ar: 'اتركه جانبًا' },
};

/** Replaces glossary terms (longest first) for the requested language. */
function applyGlossary(text: string, language: string): string {
  let out = text;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  for (const term of terms) {
    const rep = GLOSSARY[term]?.[language];
    if (!rep) continue;
    const re = new RegExp('(^|[^a-zA-Z])(' + escapeRe(term) + ')($|[^a-zA-Z])', 'gi');
    out = out.replace(re, (_m, pre: string, _w: string, post: string) => pre + rep + post);
  }
  return out;
}

function applyPhrases(text: string, dict: Dict): string {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  let out = text;
  for (const term of keys) {
    const rep = dict[term];
    if (rep === '') continue;
    const re = new RegExp('(^|[^a-zA-Z])(' + escapeRe(term) + ')($|[^a-zA-Z])', 'gi');
    out = out.replace(re, (_m, pre: string, _w: string, post: string) => pre + rep + post);
  }
  return out;
}

function tidy(s: string): string {
  const cleaned = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

export function isTranslatableLanguage(language: string): boolean {
  return !!language && language !== 'en' && !!maps[language];
}

/* ─── Online top-up (free, no API key) ────────────────────────────────────
   The offline dictionary always runs first so translation works without a
   network. Whatever the dictionary cannot cover is then fetched from a public
   translation endpoint, so recipes come back fully translated while online.
   The caller caches the result in `recipe_translations`, so every recipe is
   only requested once per language. */

const ONLINE_LANGS: Record<string, string> = {
  de: 'de',
  ar: 'ar',
  fr: 'fr',
  es: 'es',
  it: 'it',
  tr: 'tr',
  pt: 'pt',
  nl: 'nl',
  ru: 'ru',
};

/** Language pairs for the second engine (MyMemory). */
const MM_PAIRS: Record<string, string> = {
  de: 'de-DE',
  ar: 'ar-SA',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  tr: 'tr-TR',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
};

/** fetch + abort-timeout, resolving to null on any failure. */
async function withTimeout<T>(fn: (signal?: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  let timer: any = null;
  let controller: any = null;
  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), ms);
    }
    return await fn(controller ? controller.signal : undefined);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Primary engine: Google's public translate endpoint (no API key, no quota
 * account needed). One request carries the whole recipe by joining the lines
 * with a newline, which keeps grammar, word order and cooking terms natural.
 */
async function translateWithGoogle(lines: string[], lang: string): Promise<string[] | null> {
  const text = lines.map((l) => l.trim()).join('\n');
  if (!text) return lines.map(() => '');
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
    lang +
    '&dt=t&q=' +
    encodeURIComponent(text);
  const data: any = await withTimeout(async (signal) => {
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res || !res.ok) throw new Error('http ' + (res ? res.status : 'no response'));
    return res.json();
  }, 12000);
  if (!data || !Array.isArray(data[0])) return null;
  const joined = (data[0] as any[])
    .map((part) => (Array.isArray(part) ? String(part[0] ?? '') : ''))
    .join('');
  const out = joined.split('\n').map((s) => s.trim());
  if (out.length !== lines.length) return null;
  return out;
}

/** Tidies machine output: no shouting, no double spaces, sentence case. */
function polish(s: string): string {
  let out = (s ?? '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  if (!out) return out;
  if (out.length > 3 && out === out.toUpperCase() && /[A-ZÄÖÜ]{3}/.test(out)) {
    out = out.charAt(0).toUpperCase() + out.slice(1).toLowerCase();
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

async function fetchTranslation(text: string, language: string, timeoutMs = 7000): Promise<string | null> {
  const pair = MM_PAIRS[language];
  const value = (text ?? '').trim();
  if (!pair || !value || value.length > 480) return null;
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(value) +
    '&langpair=en|' +
    pair;
  let timer: any = null;
  let controller: any = null;
  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res || !res.ok) return null;
    const data: any = await res.json();
    const out = data?.responseData?.translatedText;
    if (typeof out !== 'string') return null;
    const cleaned = out.trim();
    if (!cleaned) return null;
    // The public service answers with warnings/limits as plain text.
    if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID |PLEASE SELECT)/i.test(cleaned)) return null;
    if (cleaned.toLowerCase() === value.toLowerCase()) return null;
    // The service sometimes shouts (e.g. "KLOSSTEIG") — soften that to a
    // normal sentence case so ingredients do not look broken.
    if (cleaned.length > 3 && cleaned === cleaned.toUpperCase() && /[A-ZÄÖÜ]{3}/.test(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }
    return cleaned;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Dictionary translation + online top-up per line. Falls back to the
 * dictionary result whenever the network is unavailable or rate-limited.
 */
export async function translateRecipeContentOnline(
  recipe: RecipeContent,
  language: string,
): Promise<TranslatedRecipe> {
  const base = translateRecipeContent(recipe, language);
  const lang = ONLINE_LANGS[language];
  if (!lang) return base;

  const ingredientsRaw = recipe.ingredients ?? [];
  const stepsRaw = recipe.steps ?? [];
  const hasDescription = !!recipe.description;

  // One flat list of lines so a single request can carry the whole recipe.
  const segments: string[] = [recipe.title ?? ''];
  if (hasDescription) segments.push(recipe.description as string);
  segments.push(...ingredientsRaw, ...stepsRaw);

  // The offline dictionary result is the safety net for every single line.
  const fallback: string[] = [base.title];
  if (hasDescription) fallback.push(base.description ?? '');
  fallback.push(...base.ingredients, ...base.steps);
  while (fallback.length < segments.length) fallback.push(segments[fallback.length]);

  const results = [...segments];

  // 1) primary engine — chunked so the request URLs stay short
  const indexChunks: number[][] = [];
  let chunk: number[] = [];
  let length = 0;
  segments.forEach((text, i) => {
    const value = (text ?? '').trim();
    if (!value) return;
    if (chunk.length && length + value.length + 1 > 1200) {
      indexChunks.push(chunk);
      chunk = [];
      length = 0;
    }
    chunk.push(i);
    length += value.length + 1;
  });
  if (chunk.length) indexChunks.push(chunk);

  let primaryAlive = true;
  for (const indexes of indexChunks) {
    const lines = indexes.map((i) => segments[i]);
    const translated = primaryAlive ? await translateWithGoogle(lines, lang) : null;
    if (!translated) {
      primaryAlive = false;
      continue;
    }
    indexes.forEach((index, pos) => {
      const value = polish(translated[pos] ?? '');
      if (value && value.toLowerCase() !== (segments[index] ?? '').trim().toLowerCase()) {
        results[index] = value;
      }
    });
  }

  // 2) second engine for whatever the first one could not deliver
  let secondaryAlive = true;
  let misses = 0;
  for (let i = 0; i < segments.length && secondaryAlive; i += 1) {
    const original = (segments[i] ?? '').trim();
    if (!original) continue;
    if ((results[i] ?? '').trim().toLowerCase() !== original.toLowerCase()) continue;
    const res = await fetchTranslation(original, language);
    if (res === null) {
      misses += 1;
      if (misses >= 3) secondaryAlive = false; // endpoint failing: stop asking
      continue;
    }
    misses = 0;
    results[i] = polish(res);
  }

  // 3) dictionary fallback for any line neither engine could translate
  for (let i = 0; i < segments.length; i += 1) {
    const original = (segments[i] ?? '').trim();
    if (!original) continue;
    if ((results[i] ?? '').trim().toLowerCase() === original.toLowerCase()) {
      results[i] = fallback[i] ?? segments[i];
    }
  }

  let cursor = 0;
  const title = results[cursor++] || base.title;
  const description = hasDescription ? results[cursor++] || base.description : base.description;
  const ingredients: string[] = ingredientsRaw.map(() => results[cursor++] ?? '');
  const steps: string[] = stepsRaw.map(() => {
    const done = (results[cursor++] ?? '').trim();
    return done && !/[.!?]$/.test(done) ? `${done}.` : done;
  });

  return { title, description, ingredients, steps };
}

export function translateRecipeContent(recipe: RecipeContent, language: string): TranslatedRecipe {
  const map = maps[language];
  const keep: TranslatedRecipe = {
    title: recipe.title ?? '',
    description: recipe.description,
    ingredients: [...(recipe.ingredients ?? [])],
    steps: [...(recipe.steps ?? [])],
  };
  if (!map || language === 'en') return keep;

  const t = (s: string) => tidy(applyPhrases(applyGlossary(s, language), map));
  const steps = (recipe.steps ?? []).map((s) => {
    const done = t(s);
    return /[.!?]$/.test(done) ? done : `${done}.`;
  });

  return {
    title: t(recipe.title ?? ''),
    description: recipe.description ? t(recipe.description) : undefined,
    ingredients: (recipe.ingredients ?? []).map(t),
    steps,
  };
}









