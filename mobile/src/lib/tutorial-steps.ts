import { configureTutorial, type TutorialStep } from './tutorial';
import { navigate } from '../navigation/rootRef';

/**
 * Spoonful onboarding tour — rebuilt in 2.1.2.
 *
 * 8 steps, every one real: the user taps the element the pointer shows and the
 * tour advances by itself (the engine listens to `tutorialAction`).
 * Copy exists in all 10 app languages (English is the last fallback only).
 *
 * How to add a step
 * -----------------
 * 1. register a target in the screen:   const tFoo = useTutorialTarget('tut-foo')
 *                                       → <Pressable ref={tFoo.ref} onPress={tFoo.onPress} />
 *    For fields/lists notify the engine:
 *      onChangeText={(v) => { setX(v); tutorialAction('tut-foo'); }}
 *      onScroll={() => tutorialAction('tut-foo')}
 * 2. add an entry below (unique id, targetId = registered id)
 *      expect: 'tap' | 'input' | 'scroll' | 'observe'
 *      before: () => navigate('Main', { screen: 'Shopping' })  // run before showing
 *      focus : () => ref.current?.scrollTo(...)                // bring into view
 *      allowContinue: true -> also offer a "Next" button
 *      newIn : 4           -> only shown to users who finished an older tour
 * 3. raise TOUR_VERSION so everyone sees the new step.
 */
export const TOUR_VERSION = 3;

/** Switch to a bottom tab before the step is shown. */
const openTab = (screen: string) => () => navigate('Main' as any, { screen } as any);

export const TOUR_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    expect: 'observe',
    padding: 0,
    title: {
      en: 'Welcome to Spoonful',
      de: 'Willkommen bei Spoonful',
      ar: 'أهلاً بك في Spoonful',
      fr: 'Bienvenue dans Spoonful',
      es: 'Bienvenido a Spoonful',
      it: 'Benvenuto in Spoonful',
      tr: 'Spoonful\'a hoş geldin',
      pt: 'Bem-vindo ao Spoonful',
      nl: 'Welkom bij Spoonful',
      ru: 'Добро пожаловать в Spoonful',
    },
    text: {
      en: 'A short tour in 8 steps. You do every tap yourself - I only point at where.',
      de: 'Eine kurze Tour in 8 Schritten. Du tippst selbst - ich zeige nur, wo.',
      ar: 'جولة قصيرة من ٨ خطوات. أنت من ينقر، وأنا أوضّح المكان.',
      fr: 'Une courte visite en 8 étapes. Vous cliquez vous-même, je montre où.',
      es: 'Un tour corto en 8 pasos. Tú pulsas, yo solo señalo dónde.',
      it: 'Un breve tour in 8 passi. Tocchi tu, io indico solo dove.',
      tr: '8 adımlık kısa bir tur. Dokunan sensin, ben sadece yeri gösteriyorum.',
      pt: 'Um tour curto em 8 passos. Você toca, eu só mostro onde.',
      nl: 'Een korte tour in 8 stappen. Jij tikt, ik wijs alleen waar.',
      ru: 'Короткий тур из 8 шагов. Нажимаете вы, я лишь показываю куда.',
    },
  },
  {
    id: 'nav-library',
    targetId: 'tut-tab-Library',
    expect: 'tap',
    before: openTab('Library'),
    padding: 6,
    title: {
      en: 'Discover', de: 'Entdecken', ar: 'استكشف', fr: 'Découvrir', es: 'Descubrir',
      it: 'Scopri', tr: 'Keşfet', pt: 'Descobrir', nl: 'Ontdekken', ru: 'Обзор',
    },
    text: {
      en: 'Tap the Discover tab: over a thousand recipes live here. The tab bar scrolls sideways, so there is more than you see.',
      de: 'Tippe auf den Entdecken-Tab: hier liegen über tausend Rezepte. Die Tab-Leiste scrollt seitlich, es gibt mehr als du siehst.',
      ar: 'انقر على تبويب «استكشف»: هنا أكثر من ألف وصفة، والشريط يتحرك جانبياً.',
      fr: 'Touchez l\u2019onglet Découvrir : plus de mille recettes vous attendent. La barre défile sur le côté.',
      es: 'Toca la pestaña Descubrir: hay más de mil recetas, y la barra se desplaza lateralmente.',
      it: 'Tocca la scheda Scopri: qui ci sono oltre mille ricette e la barra scorre di lato.',
      tr: 'Keşfet sekmesine dokun: burada binden fazla tarif var, çubuk yana kaydırılır.',
      pt: 'Toque no separador Descobrir: há mais de mil receitas e a barra desliza para o lado.',
      nl: 'Tik op Ontdekken: hier staan meer dan duizend recepten en de balk schuift zijwaarts.',
      ru: 'Нажмите «Обзор»: здесь больше тысячи рецептов, а панель прокручивается вбок.',
    },
  },
  {
    id: 'library-search',
    targetId: 'tut-library-search',
    expect: 'input',
    padding: 6,
    title: {
      en: 'Search', de: 'Suche', ar: 'البحث', fr: 'Recherche', es: 'Buscar',
      it: 'Cerca', tr: 'Arama', pt: 'Pesquisar', nl: 'Zoeken', ru: 'Поиск',
    },
    text: {
      en: 'Type a dish or an ingredient - your own language works too. Try it: type one word.',
      de: 'Tippe ein Gericht oder eine Zutat - auch auf Deutsch. Probier es: tippe ein Wort.',
      ar: 'اكتب طبقاً أو مكوّناً، وبلغتك أيضاً. جرّب كلمة واحدة.',
      fr: 'Tapez un plat ou un ingrédient, même en français. Essayez un mot.',
      es: 'Escribe un plato o un ingrediente, también en español. Prueba una palabra.',
      it: 'Scrivi un piatto o un ingrediente, anche in italiano. Prova una parola.',
      tr: 'Bir yemek ya da malzeme yaz, Türkçe de olur. Bir kelime dene.',
      pt: 'Escreva um prato ou ingrediente, também em português. Experimente uma palavra.',
      nl: 'Typ een gerecht of ingrediënt, ook in het Nederlands. Probeer één woord.',
      ru: 'Введите блюдо или ингредиент, можно по-русски. Попробуйте одно слово.',
    },
  },
  {
    id: 'library-card',
    targetId: 'tut-library-card',
    expect: 'tap',
    wide: true,
    padding: 4,
    title: {
      en: 'Open a recipe', de: 'Rezept öffnen', ar: 'افتح وصفة', fr: 'Ouvrir une recette',
      es: 'Abrir una receta', it: 'Apri una ricetta', tr: 'Bir tarif aç',
      pt: 'Abrir uma receita', nl: 'Open een recept', ru: 'Открыть рецепт',
    },
    text: {
      en: 'Every tile shows photo, total time, difficulty and kcal. Tap one to open the recipe.',
      de: 'Jede Kachel zeigt Foto, Gesamtzeit, Schwierigkeit und Kalorien. Tippe eine an, um das Rezept zu öffnen.',
      ar: 'كل بطاقة تعرض الصورة والوقت والصعوبة والسعرات، انقر واحدة لفتح الوصفة.',
      fr: 'Chaque vignette montre photo, temps, difficulté et kcal. Touchez-en une.',
      es: 'Cada tarjeta muestra foto, tiempo, dificultad y kcal. Toca una.',
      it: 'Ogni scheda mostra foto, tempo, difficoltà e kcal. Toccane una.',
      tr: 'Her kartta fotoğraf, süre, zorluk ve kalori var. Birine dokun.',
      pt: 'Cada cartão mostra foto, tempo, dificuldade e kcal. Toque num deles.',
      nl: 'Elke tegel toont foto, tijd, moeilijkheid en kcal. Tik er een aan.',
      ru: 'Каждая карточка показывает фото, время, сложность и калории. Нажмите на любую.',
    },
  },
  {
    id: 'detail-save',
    targetId: 'tut-detail-save',
    expect: 'tap',
    padding: 8,
    title: {
      en: 'Keep it', de: 'Merken', ar: 'احفظها', fr: 'Garder', es: 'Guardar',
      it: 'Salva', tr: 'Kaydet', pt: 'Guardar', nl: 'Bewaren', ru: 'Сохранить',
    },
    text: {
      en: 'Tap the bookmark: the recipe moves to your own shelf, with notes you can edit later.',
      de: 'Tippe auf das Lesezeichen: das Rezept wandert in deine Sammlung, mit Notizen, die du später bearbeiten kannst.',
      ar: 'انقر على الإشارة المرجعية لتنقل الوصفة إلى محفوظاتك مع ملاحظات قابلة للتعديل.',
      fr: 'Touchez le marque-page : la recette rejoint votre étagère, avec des notes modifiables.',
      es: 'Toca el marcador: la receta pasa a tu estantería, con notas editables.',
      it: 'Tocca il segnalibro: la ricetta va nella tua raccolta, con note modificabili.',
      tr: 'Yer imine dokun: tarif, düzenlenebilir notlarla kendi rafına taşınır.',
      pt: 'Toque no marcador: a receita vai para a sua estante, com notas editáveis.',
      nl: 'Tik op het bladwijzer: het recept gaat naar je eigen plank, met bewerkbare notities.',
      ru: 'Нажмите на закладку: рецепт переместится в вашу коллекцию, с заметками.',
    },
  },
  {
    id: 'nav-shopping',
    targetId: 'tut-tab-Shopping',
    expect: 'tap',
    before: openTab('Shopping'),
    padding: 6,
    title: {
      en: 'Shopping list', de: 'Einkaufsliste', ar: 'قائمة التسوّق', fr: 'Liste de courses',
      es: 'Lista de compra', it: 'Lista della spesa', tr: 'Alışveriş listesi',
      pt: 'Lista de compras', nl: 'Boodschappenlijst', ru: 'Список покупок',
    },
    text: {
      en: 'Every ingredient can jump here. Tap the tab - the next step is inside.',
      de: 'Jede Zutat kann hier landen. Tippe den Tab - der nächste Schritt ist darin.',
      ar: 'كل مكوّن يمكن إضافته هنا. انقر التبويب، والخطوة التالية بالداخل.',
      fr: 'Chaque ingrédient peut arriver ici. Touchez l\u2019onglet : la suite est dedans.',
      es: 'Cualquier ingrediente puede venir aquí. Toca la pestaña: el siguiente paso está dentro.',
      it: 'Ogni ingrediente può finire qui. Tocca la scheda: il prossimo passo è dentro.',
      tr: 'Her malzeme buraya gelebilir. Sekmeye dokun, sonraki adım içeride.',
      pt: 'Qualquer ingrediente pode vir para aqui. Toque no separador: o próximo passo está lá dentro.',
      nl: 'Elk ingrediënt kan hier terechtkomen. Tik op de tab: de volgende stap zit erin.',
      ru: 'Любой ингредиент можно добавить сюда. Нажмите вкладку: следующий шаг внутри.',
    },
  },
  {
    id: 'nav-tracker',
    targetId: 'tut-tab-Tracker',
    expect: 'tap',
    before: openTab('Tracker'),
    padding: 6,
    title: {
      en: 'Tracker', de: 'Tracker', ar: 'المتابعة', fr: 'Suivi', es: 'Seguimiento',
      it: 'Tracker', tr: 'Takip', pt: 'Registo', nl: 'Tracker', ru: 'Трекер',
    },
    text: {
      en: 'Meals, water, weight and the barcode scanner live here. Tap the tab and have a look.',
      de: 'Mahlzeiten, Wasser, Gewicht und der Barcode-Scanner stecken hier. Tippe den Tab an und schau rein.',
      ar: 'الوجبات والماء والوزن وماسح الباركود هنا. انقر التبويب وألقِ نظرة.',
      fr: 'Repas, eau, poids et scanner de codes-barres sont ici. Touchez l\u2019onglet.',
      es: 'Comidas, agua, peso y el escáner de códigos están aquí. Toca la pestaña.',
      it: 'Pasti, acqua, peso e scanner sono qui. Tocca la scheda e dai un\u2019occhiata.',
      tr: 'Yemekler, su, kilo ve barkod tarayıcı burada. Sekmeye dokun ve göz at.',
      pt: 'Refeições, água, peso e o leitor de códigos estão aqui. Toque no separador.',
      nl: 'Maaltijden, water, gewicht en de barcodescanner zitten hier. Tik op de tab.',
      ru: 'Еда, вода, вес и сканер штрихкодов живут здесь. Нажмите вкладку.',
    },
  },
  {
    id: 'done',
    expect: 'observe',
    title: {
      en: 'You are ready', de: 'Du bist startklar', ar: 'أنت جاهز', fr: 'Vous êtes prêt',
      es: 'Todo listo', it: 'Tutto pronto', tr: 'Hazırsın', pt: 'Está tudo pronto',
      nl: 'Je bent klaar', ru: 'Всё готово',
    },
    text: {
      en: 'That was the tour. The AI Chef, the community and your own recipes are waiting - and you can replay this tour any time under Settings.',
      de: 'Das war die Tour. KI-Koch, Community und eigene Rezepte warten schon - und du kannst die Tour jederzeit in den Einstellungen wiederholen.',
      ar: 'هذه كانت الجولة. الشيف الذكي والمجتمع ووصفاتك تنتظرك، ويمكنك إعادة الجولة من الإعدادات.',
      fr: 'C\u2019était la visite. Le Chef IA, la communauté et vos recettes vous attendent - rejouable dans les réglages.',
      es: 'Ese era el tour. El Chef IA, la comunidad y tus recetas te esperan, y puedes repetirlo en Ajustes.',
      it: 'Questo era il tour. Chef IA, community e le tue ricette ti aspettano - ripetibile nelle Impostazioni.',
      tr: 'Tur buydu. Yapay zeka şefi, topluluk ve kendi tariflerin seni bekliyor - Ayarlardan tekrar oynatabilirsin.',
      pt: 'Esse era o tour. O Chef IA, a comunidade e as suas receitas esperam por si - repetível nas Definições.',
      nl: 'Dat was de tour. De AI-chef, de community en je eigen recepten wachten - herhaalbaar in Instellingen.',
      ru: 'Это был тур. ИИ-повар, сообщество и ваши рецепты ждут - тур можно повторить в настройках.',
    },
  },
];

configureTutorial({ version: TOUR_VERSION, steps: TOUR_STEPS });

/**
 * Targets used by this tour (all of them are registered by the screens):
 *
 *  tut-tab-Library, tut-tab-Shopping, tut-tab-Tracker  (navigation/RootTabs)
 *  tut-library-search, tut-library-card                 (LibraryScreen)
 *  tut-detail-save, tut-detail-back, tut-detail-ingredients (RecipeDetailScreen)
 *  tut-shopping-add, tut-shopping-extras                (ShoppingScreen)
 *  tut-barcode, tut-portion                             (TrackerExtras / FoodPortionSheet)
 *  tut-community-feed, tut-community-publish            (CommunityScreen)
 *
 * The last four are used by optional steps: copy the block below, give it a
 * unique id, set `newIn: TOUR_VERSION` so only users with an older tour see it,
 * and register the step again in TOUR_STEPS.
 *
 *   { id: 'tracker-barcode', targetId: 'tut-barcode', expect: 'tap', allowContinue: true,
 *     newIn: 3,
 *     title: { en: 'Scan products', de: 'Produkte scannen', ar: 'امسح المنتجات' },
 *     text:  { en: '…', de: '…', ar: '…' } }
 */
export const OPTIONAL_STEP_TARGETS = [
  'tut-barcode',
  'tut-portion',
  'tut-shopping-add',
  'tut-shopping-extras',
  'tut-community-feed',
  'tut-community-publish',
  'tut-detail-back',
  'tut-detail-ingredients',
] as const;
