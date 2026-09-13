/**
 * Kochmodus: Coach-Tipps (2.1.5)
 *
 * Vorher gab es pro Phase genau EINEN Tipp - der wiederholte sich bei jedem
 * Schritt, was genervt hat. Jetzt:
 *   * 3 Tipps + 2 "Worauf achten"-Hinweise pro Phase,
 *   * die Auswahl hängt vom Schritt ab (gleicher Schritt = gleicher Tipp),
 *   * derselbe Tipp kommt nie zweimal hintereinander,
 *   * alles in allen 10 App-Sprachen.
 */
export type CoachPhase = 'start' | 'prep' | 'combine' | 'cook' | 'finish' | 'next';

type PhaseText = { tips: string[]; looks: string[] };
type CoachDict = Record<CoachPhase, PhaseText>;

export const COACH_PHASES: CoachPhase[] = ['start', 'prep', 'combine', 'cook', 'finish', 'next'];

/** Erkennt die Phase aus dem Schritt-Text (englische Rezepttexte). */
export function detectPhase(step: string, index: number, total: number): CoachPhase {
  const text = String(step || '').toLowerCase();
  if (index === total - 1 || /(serve|plate|garnish|finish|top with|enjoy|rest before serving)/.test(text)) return 'finish';
  if (/(bake|oven|roast|broil|boil|simmer|fry|saut|grill|heat|reduce|caramel|braise|stew|steam)/.test(text)) return 'cook';
  if (/(mix|stir|combine|whisk|fold|pour|add|season|marinate|toss|blend|knead)/.test(text)) return 'combine';
  if (/(prep|wash|rinse|peel|chop|dice|slice|mince|grate|trim|cut|measure|soak|drain|gather|separate)/.test(text)) return 'prep';
  if (index === 0) return 'start';
  return 'next';
}

const de: CoachDict = {
  start: { tips: ['Lies den Schritt einmal ganz, bevor du anfängst.', 'Stell alles bereit, was du gleich brauchst – dann läuft es ruhiger.', 'Lieber langsam anfangen als hektisch werden: nichts brennt an, wenn du vorbereitet bist.'], looks: ['Alles bereit? Dann los.', 'Schritt verstanden? Sonst einmal neu lesen.'] },
  prep: { tips: ['Gleichmäßig schneiden – so gart alles zur selben Zeit.', 'Abwiegen statt schätzen: das macht den Unterschied im Ergebnis.', 'Erst alles vorbereiten, dann die Pfanne heiß werden lassen.'], looks: ['Alles geschnitten und abgewogen?', 'Sind die Stücke etwa gleich groß?'] },
  combine: { tips: ['Von unten nach oben mischen – so bleibt nichts am Rand hängen.', 'Flüssigkeit erst zur Hälfte, dann nach und nach zugeben.', 'Einmal abschmecken, dann noch einmal: Salz wirkt erst nach dem Umrühren richtig.'], looks: ['Gleichmäßig verteilt, keine Klumpen?', 'Passt die Konsistenz zur Beschreibung?'] },
  cook: { tips: ['Lieber etwas niedrigere Hitze und dafür länger – das schützt vor Anbrennen.', 'Nicht ständig rühren, sonst entsteht keine Bräunung.', 'Deckel drauf für zart, offen für Farbe.'], looks: ['Farbe und Geruch wie beschrieben?', 'Gleichmäßiges Zischen statt Spritzen?'] },
  finish: { tips: ['Vor dem Servieren noch einmal abschmecken.', 'Kurz ruhen lassen – dann verteilt sich der Saft und es bleibt saftig.', 'Teller kurz vorwärmen, dann bleibt es länger heiß.'], looks: ['Sieht es aus wie im Rezept?', 'Ist alles gleichzeitig fertig? Dann servieren.'] },
  next: { tips: ['In deinem Tempo weiter – es muss nicht schnell gehen.', 'Wenn etwas klebt: einen Schluck Wasser dazu und weiterrühren.', 'Zwischendurch abschmecken, dann bleibt nichts dem Zufall überlassen.'], looks: ['Passt es zur Beschreibung?', 'Bereit für den nächsten Schritt?'] },
};

const en: CoachDict = {
  start: { tips: ['Read this step once before you start – it saves rework.', 'Put out everything you need now and the rest feels calm.', 'Starting slow beats rushing: nothing burns while you are prepared.'], looks: ['Everything ready? Go ahead.', 'Step clear? Re-read it once if not.'] },
  prep: { tips: ['Cut evenly – that way everything cooks in the same time.', 'Weigh instead of guessing: it decides how the dish turns out.', 'Prep first, then let the pan get hot.'], looks: ['Everything cut and weighed?', 'Are the pieces roughly the same size?'] },
  combine: { tips: ['Mix from the bottom up so nothing stays stuck at the edge.', 'Add liquid in halves, not all at once.', 'Taste once, stir, then taste again – salt needs a moment.'], looks: ['Evenly mixed, no lumps?', 'Does the texture match the description?'] },
  cook: { tips: ['A little less heat and a little more time protects against burning.', 'Do not stir constantly or it will never brown.', 'Lid on for tender, lid off for colour.'], looks: ['Colour and smell as described?', 'Steady sizzle instead of spitting?'] },
  finish: { tips: ['Taste once more right before serving.', 'Let it rest briefly so the juices settle and it stays juicy.', 'Warm the plates so it stays hot longer.'], looks: ['Does it look like the picture?', 'Everything ready at once? Serve it.'] },
  next: { tips: ['Carry on at your own pace – there is no rush.', 'Sticking? A splash of water and keep stirring.', 'Taste as you go so nothing is left to chance.'], looks: ['Does it match the description?', 'Ready for the next step?'] },
};

const es: CoachDict = {
  start: { tips: ['Lee el paso completo antes de empezar.', 'Saca ya todo lo que necesitas: así todo va más tranquilo.', 'Empezar despacio es mejor que correr: nada se quema si estás preparado.'], looks: ['¿Todo listo? Adelante.', '¿El paso está claro? Si no, vuelve a leerlo.'] },
  prep: { tips: ['Corta de forma uniforme: así todo se cocina al mismo tiempo.', 'Pesa en lugar de calcular: eso decide el resultado.', 'Prepara primero y luego calienta la sartén.'], looks: ['¿Todo cortado y pesado?', '¿Los trozos son de tamaño parecido?'] },
  combine: { tips: ['Mezcla de abajo hacia arriba para que nada quede en el borde.', 'Añade el líquido en dos veces, no de golpe.', 'Prueba, remueve y vuelve a probar: la sal necesita un momento.'], looks: ['¿Mezcla uniforme, sin grumos?', '¿La textura coincide con la descripción?'] },
  cook: { tips: ['Un poco menos de fuego y algo más de tiempo evitan que se queme.', 'No remuevas sin parar o no se dorará.', 'Con tapa queda tierno, sin tapa coge color.'], looks: ['¿Color y aroma como se describe?', '¿Chisporrotea de forma constante, sin salpicar?'] },
  finish: { tips: ['Prueba una última vez justo antes de servir.', 'Déjalo reposar un momento: el jugo se reparte y queda jugoso.', 'Calienta los platos para que aguante caliente.'], looks: ['¿Se parece a la foto?', '¿Todo listo a la vez? Sirve.'] },
  next: { tips: ['Sigue a tu ritmo, no hay prisa.', '¿Se pega? Un poco de agua y sigue removiendo.', 'Prueba mientras cocinas para no dejarlo al azar.'], looks: ['¿Coincide con la descripción?', '¿Listo para el siguiente paso?'] },
};

const it: CoachDict = {
  start: { tips: ['Leggi tutto il passo prima di iniziare.', 'Tira fuori subito quello che serve: il resto sarà più tranquillo.', 'Meglio iniziare piano: nulla brucia se sei preparato.'], looks: ['Tutto pronto? Vai.', 'Passo chiaro? Altrimenti rileggilo.'] },
  prep: { tips: ['Taglia in modo uniforme: così tutto cuoce nello stesso tempo.', 'Pesa invece di stimare: è quello che decide il risultato.', 'Prepara prima, poi scalda la padella.'], looks: ['Tutto tagliato e pesato?', 'I pezzi sono più o meno uguali?'] },
  combine: { tips: ['Mescola dal basso verso l alto per non lasciare nulla sui bordi.', 'Aggiungi il liquido in due volte, non tutto insieme.', 'Assaggia, mescola, riassaggia: il sale ha bisogno di un momento.'], looks: ['Mescolato bene, senza grumi?', 'La consistenza corrisponde alla descrizione?'] },
  cook: { tips: ['Un po meno fuoco e un po più tempo evitano di bruciare.', 'Non mescolare di continuo, altrimenti non rosola.', 'Con coperchio resta morbido, senza coperchio prende colore.'], looks: ['Colore e profumo come descritto?', 'Sfrigola in modo costante, senza schizzare?'] },
  finish: { tips: ['Assaggia un ultima volta prima di servire.', 'Lascia riposare un momento: i succhi si distribuiscono e resta morbido.', 'Scalda i piatti così resta caldo più a lungo.'], looks: ['Somiglia alla foto?', 'Tutto pronto insieme? Servi.'] },
  next: { tips: ['Prosegui con calma, non c è fretta.', 'Si attacca? Un po d acqua e continua a mescolare.', 'Assaggia mentre procedi per non lasciare nulla al caso.'], looks: ['Corrisponde alla descrizione?', 'Pronto per il passo successivo?'] },
};


const ar: CoachDict = {
  start: { tips: ['اقرأ الخطوة كاملة قبل أن تبدأ.', 'جهّز كل ما تحتاجه الآن ليصبح كل شيء هادئاً.', 'البدء بهدوء أفضل من العجلة: لا شيء يحترق وأنت مستعد.'], looks: ['كل شيء جاهز؟ ابدأ.', 'هل الخطوة واضحة؟ أعد قراءتها.'] },
  prep: { tips: ['قطّع بالتساوي ليَنْضَج كل شيء في الوقت نفسه.', 'زِن المكوّنات بدل التقدير: هذا يحدد النتيجة.', 'جهّز أولاً ثم سخّن المقلاة.'], looks: ['هل قُطِّع ووُزِن كل شيء؟', 'هل القطع بالحجم نفسه تقريباً؟'] },
  combine: { tips: ['حرّك من الأسفل إلى الأعلى حتى لا يبقى شيء على الحافة.', 'أضف السائل على مرتين لا مرة واحدة.', 'تذوّق ثم حرّك ثم تذوّق مرة أخرى: الملح يحتاج لحظة.'], looks: ['مزيج متجانس بلا كتل؟', 'هل القوام مطابق للوصف؟'] },
  cook: { tips: ['حرارة أقل قليلاً ووقت أطول يحمي من الاحتراق.', 'لا تحرّك باستمرار وإلا لن يتحول اللون.', 'الغطاء للطراوة وبدونه للون.'], looks: ['اللون والرائحة كما في الوصف؟', 'أزيز ثابت من دون تناثر؟'] },
  finish: { tips: ['تذوّق مرة أخيرة قبل التقديم.', 'اتركه يرتاح قليلاً ليتوزع العصير ويبقى طرياً.', 'سخّن الأطباق ليبرد الطعام أقل.'], looks: ['هل يبدو كما في الصورة؟', 'كل شيء جاهز في الوقت نفسه؟ قدّمه.'] },
  next: { tips: ['تابع على راحتك ولا داعي للسرعة.', 'التصق شيء؟ أضف قليلاً من الماء وواصل التحريك.', 'تذوّق أثناء العمل حتى لا يبقى شيء للصدفة.'], looks: ['هل يطابق الوصف؟', 'جاهز للخطوة التالية؟'] },
};

const fr: CoachDict = {
  start: { tips: ['Lis cette étape en entier avant de commencer.', 'Sors tout ce qu il faut maintenant, le reste sera plus calme.', 'Mieux vaut commencer doucement : rien ne brûle quand tout est prêt.'], looks: ['Tout est prêt ? Vas-y.', 'Étape claire ? Sinon, relis-la.'] },
  prep: { tips: ['Coupe régulièrement : tout cuira en même temps.', 'Pèse au lieu d estimer, c est ce qui décide du résultat.', 'Prépare d abord, puis fais chauffer la poêle.'], looks: ['Tout est coupé et pesé ?', 'Les morceaux ont-ils la même taille ?'] },
  combine: { tips: ['Mélange du bas vers le haut pour ne rien laisser sur les bords.', 'Ajoute le liquide en deux fois, pas d un coup.', 'Goûte, remue, regoûte : le sel a besoin d un instant.'], looks: ['Mélange homogène, sans grumeaux ?', 'La texture correspond-elle à la description ?'] },
  cook: { tips: ['Un peu moins de feu et un peu plus de temps évitent de brûler.', 'Ne remue pas sans arrêt, sinon rien ne dore.', 'Couvercle pour le moelleux, sans couvercle pour la couleur.'], looks: ['Couleur et odeur comme décrit ?', 'Grésillement régulier, sans éclaboussures ?'] },
  finish: { tips: ['Goûte une dernière fois juste avant de servir.', 'Laisse reposer un instant : le jus se répartit et reste moelleux.', 'Réchauffe les assiettes pour que le plat reste chaud.'], looks: ['Cela ressemble à la photo ?', 'Tout est prêt en même temps ? Sers.'] },
  next: { tips: ['Continue à ton rythme, rien ne presse.', 'Cela attache ? Un peu d eau et continue de remuer.', 'Goûte au fur et à mesure pour ne rien laisser au hasard.'], looks: ['Cela correspond à la description ?', 'Prêt pour l étape suivante ?'] },
};

const tr: CoachDict = {
  start: { tips: ['Başlamadan önce adımı bir kez tamamen oku.', 'Şimdi gereken her şeyi hazırla: gerisi daha sakin olur.', 'Yavaş başlamak acele etmekten iyidir: hazırsan hiçbir şey yanmaz.'], looks: ['Her şey hazır mı? Başla.', 'Adım net mi? Değilse tekrar oku.'] },
  prep: { tips: ['Eşit doğra: böylece hepsi aynı anda pişer.', 'Tahmin etmek yerine tart: sonucu bu belirler.', 'Önce hazırla, sonra tavanın ısınmasını bekle.'], looks: ['Her şey doğrandı ve tartıldı mı?', 'Parçalar yaklaşık aynı boyutta mı?'] },
  combine: { tips: ['Alttan üste karıştır: kenarda hiçbir şey kalmasın.', 'Sıvıyı bir seferde değil iki adımda ekle.', 'Tat, karıştır, tekrar tat: tuz bir an ister.'], looks: ['Homojen karıştı mı, topak yok mu?', 'Kıvam tarife uyuyor mu?'] },
  cook: { tips: ['Biraz düşük ateş ve biraz daha süre yanmayı önler.', 'Sürekli karıştırma, yoksa renk almaz.', 'Kapak kapalı yumuşak, açık renkli olur.'], looks: ['Renk ve kokular tarifteki gibi mi?', 'Sürekli cızırdıyor mu, sıçramıyor mu?'] },
  finish: { tips: ['Servis etmeden hemen önce son kez tat.', 'Kısa süre dinlendir: suyu dağılır ve sulu kalır.', 'Tabağı ısıt ki yemek daha uzun sıcak kalsın.'], looks: ['Fotoğraftaki gibi görünüyor mu?', 'Hepsi aynı anda hazır mı? Servis et.'] },
  next: { tips: ['Kendi hızında devam et, acele yok.', 'Yapışıyor mu? Biraz su ekle ve karıştırmaya devam et.', 'Pişirirken tat ki hiçbir şey şansa kalmasın.'], looks: ['Tarife uyuyor mu?', 'Sonraki adıma hazır mısın?'] },
};

const pt: CoachDict = {
  start: { tips: ['Lê o passo inteiro antes de começar.', 'Tira já tudo o que precisas: o resto fica mais calmo.', 'Começar devagar é melhor do que correr: nada queima se estiveres preparado.'], looks: ['Está tudo pronto? Avança.', 'Passo claro? Se não, lê outra vez.'] },
  prep: { tips: ['Corta de forma uniforme: assim tudo cozinha ao mesmo tempo.', 'Pesa em vez de calcular: é isso que decide o resultado.', 'Prepara primeiro e só depois aquece a frigideira.'], looks: ['Está tudo cortado e pesado?', 'Os pedaços são do mesmo tamanho?'] },
  combine: { tips: ['Mistura de baixo para cima para não ficar nada nas bordas.', 'Junta o líquido em duas vezes, não de uma só.', 'Prova, mexe e prova outra vez: o sal precisa de um momento.'], looks: ['Mistura uniforme, sem grumos?', 'A textura corresponde à descrição?'] },
  cook: { tips: ['Um pouco menos de lume e mais tempo evitam que queime.', 'Não mexas sem parar, senão não aloura.', 'Com tampa fica tenro, sem tampa ganha cor.'], looks: ['Cor e aroma como na descrição?', 'Chiadeira constante, sem salpicar?'] },
  finish: { tips: ['Prova uma última vez antes de servir.', 'Deixa repousar um pouco: os sucos espalham-se e fica suculento.', 'Aquece os pratos para ficar quente durante mais tempo.'], looks: ['Parece-se com a foto?', 'Está tudo pronto ao mesmo tempo? Serve.'] },
  next: { tips: ['Continua ao teu ritmo, sem pressa.', 'Está a pegar? Um pouco de água e continua a mexer.', 'Vai provando para não deixar nada ao acaso.'], looks: ['Corresponde à descrição?', 'Pronto para o passo seguinte?'] },
};

const nl: CoachDict = {
  start: { tips: ['Lees de stap een keer helemaal voordat je begint.', 'Zet alles klaar wat je nu nodig hebt: dan blijft het rustig.', 'Rustig beginnen is beter dan haasten: niets brandt aan als je voorbereid bent.'], looks: ['Alles klaar? Ga ervoor.', 'Stap duidelijk? Lees hem anders nog eens.'] },
  prep: { tips: ['Snijd gelijkmatig: dan gaart alles tegelijk.', 'Weeg in plaats van schatten: dat bepaalt het resultaat.', 'Eerst voorbereiden, dan pas de pan heet laten worden.'], looks: ['Alles gesneden en afgewogen?', 'Zijn de stukken ongeveer even groot?'] },
  combine: { tips: ['Meng van onder naar boven, dan blijft er niets aan de rand plakken.', 'Voeg de vloeistof in twee keer toe, niet in één keer.', 'Proef, roer, proef nog eens: zout heeft even nodig.'], looks: ['Gelijkmatig gemengd, geen klonters?', 'Klopt de structuur met de beschrijving?'] },
  cook: { tips: ['Iets minder vuur en iets meer tijd voorkomt aanbranden.', 'Roer niet constant, anders wordt het niet bruin.', 'Deksel erop voor zacht, eraf voor kleur.'], looks: ['Kleur en geur zoals beschreven?', 'Gelijkmatig sissen in plaats van spatten?'] },
  finish: { tips: ['Proef nog één keer vlak voor het serveren.', 'Laat het even rusten: het sap verdeelt zich en het blijft sappig.', 'Warm de borden voor, dan blijft het langer warm.'], looks: ['Ziet het eruit als op de foto?', 'Alles tegelijk klaar? Serveren.'] },
  next: { tips: ['Ga in je eigen tempo verder, haast is niet nodig.', 'Plakt het? Een scheutje water en blijf roeren.', 'Proef tussendoor, dan blijft niets aan toeval over.'], looks: ['Klopt het met de beschrijving?', 'Klaar voor de volgende stap?'] },
};

const ru: CoachDict = {
  start: { tips: ['Прочитайте шаг полностью, прежде чем начать.', 'Сразу подготовьте всё нужное — дальше будет спокойнее.', 'Лучше начать не спеша: ничего не подгорит, если всё готово.'], looks: ['Всё готово? Начинайте.', 'Шаг понятен? Если нет, перечитайте.'] },
  prep: { tips: ['Нарезайте одинаково — тогда всё приготовится одновременно.', 'Взвешивайте, а не оценивайте: это решает результат.', 'Сначала подготовьте, потом разогревайте сковороду.'], looks: ['Всё нарезано и взвешено?', 'Кусочки примерно одного размера?'] },
  combine: { tips: ['Перемешивайте снизу вверх, чтобы ничего не осталось по краям.', 'Добавляйте жидкость в два приёма, а не сразу.', 'Попробуйте, перемешайте и попробуйте снова: соли нужно время.'], looks: ['Смесь однородная, без комков?', 'Консистенция как в описании?'] },
  cook: { tips: ['Чуть меньше огня и чуть больше времени — так не подгорит.', 'Не мешайте постоянно, иначе не появится корочка.', 'С крышкой — мягко, без крышки — румяно.'], looks: ['Цвет и запах как в описании?', 'Шипит ровно, без брызг?'] },
  finish: { tips: ['Попробуйте ещё раз прямо перед подачей.', 'Дайте немного отдохнуть: сок распределится и останется сочным.', 'Подогрейте тарелки, тогда блюдо дольше остаётся горячим.'], looks: ['Похоже на фото?', 'Всё готово одновременно? Подавайте.'] },
  next: { tips: ['Продолжайте в своём темпе, спешить не нужно.', 'Прилипает? Немного воды и продолжайте мешать.', 'Пробуйте по ходу, чтобы ничего не оставлять на волю случая.'], looks: ['Соответствует описанию?', 'Готовы к следующему шагу?'] },
};

const COACH: Record<string, CoachDict> = { de, en, ar, fr, es, it, tr, pt, nl, ru };
const FALLBACK: CoachDict = en;

/** Sprachen, für die es Coach-Texte gibt (Rest nutzt Englisch). */
export function coachLanguage(lang: string): string {
  const code = String(lang || 'en').slice(0, 2).toLowerCase();
  return COACH[code] ? code : 'en';
}

/** Stabiler Hash: derselbe Schritt bekommt immer denselben Tipp. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 100003;
  return h;
}

const lastTip: Partial<Record<CoachPhase, number>> = {};

/**
 * Tipp + "Worauf achten" für einen Schritt: stabil pro Schritt, aber nie
 * zweimal derselbe Tipp direkt hintereinander.
 */
export function coachText(phase: CoachPhase, lang: string, seed: string): { tip: string; look: string } {
  const dict = COACH[coachLanguage(lang)] ?? FALLBACK;
  const set = dict[phase] ?? FALLBACK[phase];
  const base = hash(`${phase}:${seed}`);
  let index = base % set.tips.length;
  if (set.tips.length > 1 && lastTip[phase] === index) index = (index + 1) % set.tips.length;
  lastTip[phase] = index;
  return { tip: set.tips[index], look: set.looks[base % set.looks.length] };
}


