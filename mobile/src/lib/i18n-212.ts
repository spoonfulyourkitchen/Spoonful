import type { Language } from './i18n';

/**
 * Spoonful 2.1.2 interface strings.
 *
 * New namespaces added on top of the existing dictionaries (merged in i18n.tsx):
 *   tut      – tour / onboarding chrome (progress, skip, finish, reset)
 *   langue   – language & device-language handling, RTL restart notice
 *   home     – pre-login dashboard (hero, new-feature cards, stats, CTA)
 *   adminAlert – login notifications, admin only
 *   aiLang   – AI answers in the language the user wrote in
 *   cat      – recipe catalog planning (100 recipes per country)
 *   err      – user facing error copy
 *   notif    – notification titles/bodies
 *
 * Every key exists in all 10 languages; English is only the last fallback
 * instance (see getTranslation in i18n.tsx). Placeholders use {name}.
 */
export type Dict212 = Record<string, Record<string, string>>;

const de: Dict212 = {
  tut: {
    stepOf: 'Schritt {n} von {total}', progress: 'Fortschritt', skipStep: 'Diesen Schritt überspringen', skipTour: 'Tour überspringen',
    next: 'Weiter', back: 'Zurück', finish: 'Fertig', letsGo: "Los geht's", later: 'Später', resume: 'Tour fortsetzen',
    restart: 'Tutorial neu starten', restartHint: 'Zeigt die ganze Tour wieder ab Schritt 1.', resetTitle: 'Tutorial zurückgesetzt',
    resetBody: 'Fortschritt, Zähler und die "gesehen"-Markierung wurden gelöscht. Die Tour startet wieder bei Schritt 1.',
    doneTitle: 'Du bist startklar', doneBody: 'Das war die Tour. Du kannst sie jederzeit in den Einstellungen wiederholen.',
    hintTap: 'Tippe auf das markierte Element', hintInput: 'Tippe etwas in das markierte Feld',
    hintScroll: 'Scrolle, um weiterzukommen', hintMissing: 'Dieses Element ist gerade nicht verfügbar.',
  },
  langue: {
    title: 'Sprache', auto: 'Gerätesprache', detected: 'Von deinem Handy erkannt: {name}',
    unsupportedTitle: 'Erst einmal Englisch', pick: 'Sprache wählen', later: 'Später',
    unsupportedBody: 'Die Sprache deines Handys ist noch nicht übersetzt. Wähle eine der 10 Sprachen - du kannst sie jederzeit in den Einstellungen ändern.',
    restartTitle: 'Neustart für rechts nach links', restartNow: 'Jetzt neu starten',
    restartBody: 'Arabisch wird von rechts nach links geschrieben. Schließe Spoonful und öffne es neu, damit alle Screens, Icons und Buttons gespiegelt werden.',
    changed: 'Sprache geändert',
  },
  home: {
    badge: 'Neu in 2.1.2', everything: 'Alles, was neu ist', stats: 'In der App',
    statRecipes: '1.100+ Rezepte', statCountries: '100 Länder geplant', statLangs: '9 Sprachen',
    f1t: 'Rezeptbibliothek', f1b: 'Suche nach Zutat oder Gericht, filtere nach Land, Zeit, Kalorien und Ernährung - mit echten Fotos und Nährwerten.',
    f2t: 'KI-Koch', f2b: 'Beschreibe, was du da hast - du bekommst ein komplettes Rezept zurück, in der Sprache, in der du geschrieben hast.',
    f3t: 'Tracker mit Barcode-Scan', f3b: 'Barcode fotografieren, Portion wählen, und die Mahlzeit landet im Tagebuch.',
    f4t: 'Einkaufsliste & Haushalt', f4b: 'Gänge, Preise, Teilen mit Familie oder Mitbewohnern - gemeinsam abhaken.',
    f5t: 'Community', f5b: 'Veröffentliche eigene Rezepte, bewerte, kommentiere, teile und folge anderen Köchen.',
    f6t: '10 Sprachen, RTL-fähig', f6b: 'Deutsch, Englisch, Arabisch und mehr - bei Arabisch dreht sich das ganze Layout von rechts nach links.',
    trust: 'Von Hobbyköchen geliebt', trustworthy: 'Keine Karte, kein Schnickschnack - nur Abendessen.',
  },
  adminAlert: {
    loginTitle: 'Neue Anmeldung', loginBody: '{name} hat sich angemeldet · {device} · {time}',
    listTitle: 'Anmelde-Aktivität', empty: 'Noch keine Anmeldungen erfasst.', device: 'Gerät', user: 'Nutzer',
    when: 'Wann', seen: 'Gelesen', markSeen: 'Alle als gelesen markieren', liveOn: 'Live-Hinweise an', liveOff: 'Hinweise stumm',
    onlyAdmins: 'Nur für Admins',
  },
  aiLang: { mirror: 'Antwortet in deiner Sprache', detected: 'Antwortet auf {name}', note: 'Die KI antwortet in der Sprache, in der du schreibst.' },
  cat: {
    title: 'Rezepte pro Land', progress: '{done} von {total} Rezepten für {country} angelegt',
    planned: 'Geplante Plätze', seeded: 'Angelegt', comingSoon: 'Kommt bald', sortAZ: 'Länder A-Z',
  },
  err: {
    aiNotConfigured: 'Die KI ist noch nicht eingerichtet - API-Schlüssel in src/config.ts eintragen.',
    permissionDenied: 'Berechtigung verweigert', loadFailed: 'Diese Daten konnten nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  },
  notif: {
    lunchTitle: 'Zeit fürs Mittagessen', lunchBody: 'Trag deine Mahlzeit ein, damit dein Tagesziel passt.',
    dinnerTitle: 'Abendessen', dinnerBody: 'Ein kurzer Eintrag hält deinen Ernährungsplan im Ziel.',
    water1T: 'Zeit für Wasser', water1B: 'Ein Schluck Wasser bringt dich deinem Ziel näher.',
    water2T: 'Wasserpause', water2B: 'Bleib hydriert - ein Glas jetzt hilft.',
    water3T: 'Wasser-Erinnerung', water3B: 'Ein wenig Wasser wirkt Wunder.',
    aiDoneT: 'Dein Koch ist fertig!', aiDoneB: 'Der Koch hat gerade "{title}" für dich gekocht. Schau im KI-Koch-Tab vorbei.',
    firstRecipeT: 'Das erste Rezept im Buch!', firstRecipeB: '{name} ist jetzt in deinem Rezeptbuch. Guten Appetit!',
    moreRecipesT: 'Wir haben {n} Rezepte gekocht!', moreRecipesB: '{name} ist drin - damit sind es {n} Rezepte in deiner Sammlung.',
  },
};

const ar: Dict212 = {
  tut: {
    stepOf: 'الخطوة {n} من {total}', progress: 'التقدّم', skipStep: 'تخطَّ هذه الخطوة', skipTour: 'تخطَّ الجولة',
    next: 'التالي', back: 'السابق', finish: 'إنهاء', letsGo: 'هيا نبدأ', later: 'لاحقاً', resume: 'متابعة الجولة',
    restart: 'إعادة الجولة', restartHint: 'يعرض الجولة كاملة من الخطوة الأولى.', resetTitle: 'تمت إعادة الجولة',
    resetBody: 'تم حذف التقدّم والعدّادات وعلامة المشاهدة. تبدأ الجولة من الخطوة الأولى.',
    doneTitle: 'أنت جاهز', doneBody: 'انتهت الجولة، ويمكنك إعادتها من الإعدادات.',
    hintTap: 'انقر على العنصر المميّز', hintInput: 'اكتب شيئاً في الحقل المميّز',
    hintScroll: 'مرّر للمتابعة', hintMissing: 'هذا العنصر غير متاح الآن.',
  },
  langue: {
    title: 'اللغة', auto: 'لغة الجهاز', detected: 'تم اكتشافها من هاتفك: {name}',
    unsupportedTitle: 'الإنجليزية مؤقتاً', pick: 'اختر اللغة', later: 'لاحقاً',
    unsupportedBody: 'لغة هاتفك غير مترجمة بعد. اختر إحدى اللغات العشر ويمكنك تغييرها من الإعدادات.',
    restartTitle: 'أعد التشغيل للاتجاه من اليمين', restartNow: 'أعد التشغيل الآن',
    restartBody: 'العربية من اليمين إلى اليسار. أغلق Spoonful وأعد فتحه لتنعكس كل الشاشات والأيقونات.',
    changed: 'تم تغيير اللغة',
  },
  home: {
    badge: 'جديد في 2.1.2', everything: 'كل ما هو جديد', stats: 'داخل التطبيق',
    statRecipes: 'أكثر من ١١٠٠ وصفة', statCountries: '١٠٠ دولة مخطط لها', statLangs: '٩ لغات',
    f1t: 'مكتبة الوصفات', f1b: 'ابحث بالمكوّن أو الطبق وفلتر حسب الدولة والوقت والسعرات والنظام الغذائي.',
    f2t: 'الشيف الذكي', f2b: 'اشرح ما لديك وستحصل على وصفة كاملة باللغة التي كتبت بها.',
    f3t: 'المتابعة مع مسح الباركود', f3b: 'صوّر الباركود واختر الكمية ليُسجَّل الطعام في يومياتك.',
    f4t: 'قائمة التسوّق والأسرة', f4b: 'الأقسام والأسعار والمشاركة مع العائلة أو الرفاق.',
    f5t: 'المجتمع', f5b: 'انشر وصفاتك، قيّم، علّق، شارك وتابع الطهاة الآخرين.',
    f6t: '١٠ لغات ودعم الاتجاه', f6b: 'العربية تقلب الواجهة كاملة من اليمين إلى اليسار.',
    trust: 'محبوب من الطهاة المنزليين', trustworthy: 'بلا بطاقة ولا تعقيد، فقط العشاء.',
  },
  adminAlert: {
    loginTitle: 'تسجيل دخول جديد', loginBody: '{name} سجّل الدخول · {device} · {time}',
    listTitle: 'سجلّ الدخول', empty: 'لا توجد تسجيلات بعد.', device: 'الجهاز', user: 'المستخدم',
    when: 'الوقت', seen: 'مقروء', markSeen: 'تحديد الكل كمقروء', liveOn: 'التنبيهات مفعّلة', liveOff: 'التنبيهات صامتة',
    onlyAdmins: 'للمشرفين فقط',
  },
  aiLang: { mirror: 'يجيب بلغتك', detected: 'يجيب بـ {name}', note: 'الذكاء الاصطناعي يجيب باللغة التي تكتب بها.' },
  cat: {
    title: 'وصفات لكل دولة', progress: '{done} من {total} وصفة لـ {country}',
    planned: 'خانات مخطط لها', seeded: 'تمت الإضافة', comingSoon: 'قريباً', sortAZ: 'الدول أ - ي',
  },
  err: {
    aiNotConfigured: 'الذكاء الاصطناعي غير مهيّأ بعد، أضف المفتاح في src/config.ts.',
    permissionDenied: 'تم رفض الإذن', loadFailed: 'تعذّر تحميل هذه البيانات.', saveFailed: 'تعذّر الحفظ، حاول مرة أخرى.',
  },
  notif: {
    lunchTitle: 'وقت الغداء', lunchBody: 'سجّل وجبتك لتبقى على هدفك اليومي.',
    dinnerTitle: 'وقت العشاء', dinnerBody: 'تسجيل سريع يبقي خطتك في المسار.',
    water1T: 'وقت الماء', water1B: 'اشرب بعض الماء للوصول إلى هدفك.',
    water2T: 'استراحة ماء', water2B: 'حافظ على الترطيب، كوب الآن يساعد.',
    water3T: 'تذكير بالماء', water3B: 'قليل من الماء يكفي.',
    aiDoneT: 'الطاهي انتهى!', aiDoneB: 'أعدّ لك الطاهي "{title}"، تفضّل بزيارة تبويب الشيف الذكي.',
    firstRecipeT: 'أول وصفة في الكتاب!', firstRecipeB: '{name} أُضيفت إلى كتاب وصفاتك، بالف هناء!',
    moreRecipesT: 'طبخنا {n} وصفات!', moreRecipesB: '{name} أُضيفت، وأصبح لديك {n} وصفة.',
  },
};

const fr: Dict212 = {
  tut: {
    stepOf: 'Étape {n} sur {total}', progress: 'Progression', skipStep: 'Passer cette étape', skipTour: 'Passer la visite',
    next: 'Suivant', back: 'Retour', finish: 'Terminer', letsGo: "C'est parti", later: 'Plus tard', resume: 'Reprendre la visite',
    restart: 'Relancer le tutoriel', restartHint: "Rejoue toute la visite depuis l'étape 1.", resetTitle: 'Tutoriel réinitialisé',
    resetBody: 'Progression, compteurs et marqueur "vu" effacés. La visite repart de l\u2019étape 1.',
    doneTitle: 'Vous êtes prêt', doneBody: 'La visite est terminée. Vous pouvez la rejouer dans les réglages.',
    hintTap: "Touchez l'élément en surbrillance", hintInput: 'Saisissez du texte dans le champ en surbrillance',
    hintScroll: 'Faites défiler pour continuer', hintMissing: "Cet élément n'est pas disponible pour l'instant.",
  },
  langue: {
    title: 'Langue', auto: "Langue de l'appareil", detected: 'Détectée sur votre téléphone : {name}',
    unsupportedTitle: "Anglais pour l'instant", pick: 'Choisir la langue', later: 'Plus tard',
    unsupportedBody: "La langue de votre téléphone n'est pas encore traduite. Choisissez l'une des 10 langues, modifiable dans les réglages.",
    restartTitle: 'Redémarrer pour droite-à-gauche', restartNow: 'Redémarrer',
    restartBody: "L'arabe s'écrit de droite à gauche. Fermez et rouvrez Spoonful pour inverser tous les écrans.",
    changed: 'Langue modifiée',
  },
  home: {
    badge: 'Nouveau en 2.1.2', everything: 'Tout ce qui est nouveau', stats: "Dans l'application",
    statRecipes: '1 100+ recettes', statCountries: '100 pays prévus', statLangs: '9 langues',
    f1t: 'Bibliothèque de recettes', f1b: 'Cherchez par ingrédient ou plat, filtrez par pays, temps, calories et régime.',
    f2t: 'Chef IA', f2b: 'Décrivez ce que vous avez et recevez une recette complète, dans votre langue.',
    f3t: 'Suivi avec code-barres', f3b: 'Photographiez le code-barres, choisissez la portion, le repas rejoint le journal.',
    f4t: 'Liste de courses et foyer', f4b: 'Rayons, prix, partage en famille ou en colocation.',
    f5t: 'Communauté', f5b: 'Publiez vos recettes, notez, commentez, partagez et suivez d\u2019autres cuisiniers.',
    f6t: '10 langues, prêt pour le RTL', f6b: "L'arabe inverse toute la mise en page de droite à gauche.",
    trust: 'Adoré par les cuisiniers amateurs', trustworthy: 'Pas de carte, pas de superflu - juste le dîner.',
  },
  adminAlert: {
    loginTitle: 'Nouvelle connexion', loginBody: '{name} vient de se connecter · {device} · {time}',
    listTitle: 'Activité de connexion', empty: 'Aucune connexion enregistrée.', device: 'Appareil', user: 'Utilisateur',
    when: 'Quand', seen: 'Lu', markSeen: 'Tout marquer comme lu', liveOn: 'Alertes en direct', liveOff: 'Alertes en pause',
    onlyAdmins: 'Réservé aux admins',
  },
  aiLang: { mirror: 'Répond dans votre langue', detected: 'Répond en {name}', note: "L'IA répond dans la langue que vous écrivez." },
  cat: {
    title: 'Recettes par pays', progress: '{done} recettes sur {total} pour {country}',
    planned: 'Emplacements prévus', seeded: 'Ajoutées', comingSoon: 'Bientôt', sortAZ: 'Pays A-Z',
  },
  err: {
    aiNotConfigured: "L'IA n'est pas configurée - ajoutez la clé dans src/config.ts.",
    permissionDenied: 'Autorisation refusée', loadFailed: 'Impossible de charger ces données.', saveFailed: 'Échec de l\u2019enregistrement. Réessayez.',
  },
  notif: {
    lunchTitle: "C'est l'heure du déjeuner", lunchBody: 'Enregistrez votre repas pour tenir votre objectif du jour.',
    dinnerTitle: "C'est l'heure du dîner", dinnerBody: 'Un enregistrement rapide garde votre plan en ligne.',
    water1T: "C'est l'heure de l'eau", water1B: 'Buvez un peu d\u2019eau pour atteindre votre objectif.',
    water2T: 'Pause hydratation', water2B: 'Restez hydraté - un verre maintenant aide.',
    water3T: 'Rappel hydratation', water3B: 'Un peu d\u2019eau fait du bien.',
    aiDoneT: 'Votre chef a terminé !', aiDoneB: 'Le chef a préparé « {title} ». Voyez l\u2019onglet Chef IA.',
    firstRecipeT: 'Première recette du carnet !', firstRecipeB: '{name} vient d\u2019arriver dans votre carnet. Bon appétit !',
    moreRecipesT: 'Nous avons cuisiné {n} recettes !', moreRecipesB: '{name} est là - cela fait {n} recettes.',
  },
};

const es: Dict212 = {
  tut: {
    stepOf: 'Paso {n} de {total}', progress: 'Progreso', skipStep: 'Saltar este paso', skipTour: 'Saltar el tour',
    next: 'Siguiente', back: 'Atrás', finish: 'Terminar', letsGo: 'Vamos allá', later: 'Más tarde', resume: 'Continuar el tour',
    restart: 'Reiniciar el tutorial', restartHint: 'Muestra todo el tour desde el paso 1.', resetTitle: 'Tutorial reiniciado',
    resetBody: 'Se borraron progreso, contadores y la marca de "visto". El tour empieza en el paso 1.',
    doneTitle: 'Todo listo', doneBody: 'Ese era el tour. Puedes repetirlo en Ajustes.',
    hintTap: 'Toca el elemento resaltado', hintInput: 'Escribe algo en el campo resaltado',
    hintScroll: 'Desliza para continuar', hintMissing: 'Este elemento no está disponible ahora.',
  },
  langue: {
    title: 'Idioma', auto: 'Idioma del dispositivo', detected: 'Detectado en tu teléfono: {name}',
    unsupportedTitle: 'Inglés por ahora', pick: 'Elegir idioma', later: 'Más tarde',
    unsupportedBody: 'El idioma de tu teléfono aún no está traducido. Elige uno de los 10 idiomas en Ajustes.',
    restartTitle: 'Reinicia para derecha a izquierda', restartNow: 'Reiniciar ahora',
    restartBody: 'El árabe se escribe de derecha a izquierda. Cierra y abre Spoonful de nuevo.',
    changed: 'Idioma cambiado',
  },
  home: {
    badge: 'Nuevo en 2.1.2', everything: 'Todo lo nuevo', stats: 'Dentro de la app',
    statRecipes: 'Más de 1.100 recetas', statCountries: '100 países planificados', statLangs: '9 idiomas',
    f1t: 'Biblioteca de recetas', f1b: 'Busca por ingrediente o plato y filtra por país, tiempo, calorías y dieta.',
    f2t: 'Chef IA', f2b: 'Describe lo que tienes y recibirás una receta completa en tu idioma.',
    f3t: 'Seguimiento con código de barras', f3b: 'Fotografía el código, elige la porción y la comida entra en el diario.',
    f4t: 'Lista de compra y hogar', f4b: 'Pasillos, precios y compartir con la familia o compañeros.',
    f5t: 'Comunidad', f5b: 'Publica, valora, comenta, comparte y sigue a otros cocineros.',
    f6t: '10 idiomas, listo para RTL', f6b: 'El árabe invierte toda la interfaz de derecha a izquierda.',
    trust: 'Amado por cocineros caseros', trustworthy: 'Sin tarjeta y sin complicaciones: solo la cena.',
  },
  adminAlert: {
    loginTitle: 'Nuevo inicio de sesión', loginBody: '{name} acaba de entrar · {device} · {time}',
    listTitle: 'Actividad de acceso', empty: 'Aún no hay accesos registrados.', device: 'Dispositivo', user: 'Usuario',
    when: 'Cuándo', seen: 'Leído', markSeen: 'Marcar todo como leído', liveOn: 'Avisos en directo', liveOff: 'Avisos silenciados',
    onlyAdmins: 'Solo administradores',
  },
  aiLang: { mirror: 'Responde en tu idioma', detected: 'Responde en {name}', note: 'La IA responde en el idioma en que escribes.' },
  cat: {
    title: 'Recetas por país', progress: '{done} de {total} recetas para {country}',
    planned: 'Espacios previstos', seeded: 'Añadidas', comingSoon: 'Próximamente', sortAZ: 'Países A-Z',
  },
  err: {
    aiNotConfigured: 'La IA no está configurada: añade la clave en src/config.ts.',
    permissionDenied: 'Permiso denegado', loadFailed: 'No se pudieron cargar estos datos.', saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
  },
  notif: {
    lunchTitle: 'Hora de comer', lunchBody: 'Registra tu comida para cumplir tu objetivo diario.',
    dinnerTitle: 'Hora de cenar', dinnerBody: 'Un registro rápido mantiene tu plan en el objetivo.',
    water1T: 'Hora de beber agua', water1B: 'Un poco de agua te acerca a tu objetivo.',
    water2T: 'Pausa de agua', water2B: 'Mantente hidratado: un vaso ahora ayuda.',
    water3T: 'Recordatorio de agua', water3B: 'Un poco de agua hace mucho.',
    aiDoneT: '¡Tu chef ha terminado!', aiDoneB: 'El chef ha cocinado "{title}". Míralo en la pestaña Chef IA.',
    firstRecipeT: '¡Primera receta del libro!', firstRecipeB: '{name} ya está en tu libro. ¡Buen provecho!',
    moreRecipesT: '¡Hemos cocinado {n} recetas!', moreRecipesB: '{name} está dentro: ya son {n} recetas.',
  },
};

const it: Dict212 = {
  tut: {
    stepOf: 'Passo {n} di {total}', progress: 'Progresso', skipStep: 'Salta questo passo', skipTour: 'Salta il tour',
    next: 'Avanti', back: 'Indietro', finish: 'Fine', letsGo: 'Si parte', later: 'Più tardi', resume: 'Riprendi il tour',
    restart: 'Riavvia il tutorial', restartHint: 'Mostra di nuovo tutto il tour dal passo 1.', resetTitle: 'Tutorial azzerato',
    resetBody: 'Progresso, contatori e il segno "visto" sono stati cancellati. Si riparte dal passo 1.',
    doneTitle: 'Tutto pronto', doneBody: 'Il tour è finito. Puoi ripeterlo dalle Impostazioni.',
    hintTap: "Tocca l'elemento evidenziato", hintInput: 'Scrivi qualcosa nel campo evidenziato',
    hintScroll: 'Scorri per continuare', hintMissing: 'Questo elemento non è disponibile ora.',
  },
  langue: {
    title: 'Lingua', auto: 'Lingua del dispositivo', detected: 'Rilevata dal telefono: {name}',
    unsupportedTitle: 'Per ora inglese', pick: 'Scegli la lingua', later: 'Più tardi',
    unsupportedBody: 'La lingua del telefono non è ancora tradotta. Scegli una delle 10 lingue nelle Impostazioni.',
    restartTitle: 'Riavvia per destra-sinistra', restartNow: 'Riavvia ora',
    restartBody: "L'arabo si scrive da destra a sinistra. Chiudi e riapri Spoonful per specchiare tutto.",
    changed: 'Lingua cambiata',
  },
  home: {
    badge: 'Novità in 2.1.2', everything: 'Tutte le novità', stats: "Dentro l'app",
    statRecipes: '1.100+ ricette', statCountries: '100 paesi in programma', statLangs: '9 lingue',
    f1t: 'Libreria di ricette', f1b: 'Cerca per ingrediente o piatto e filtra per paese, tempo, calorie e dieta.',
    f2t: 'Chef IA', f2b: 'Descrivi quello che hai e ricevi una ricetta completa nella tua lingua.',
    f3t: 'Tracker con codice a barre', f3b: 'Fotografa il codice, scegli la porzione e il pasto va nel diario.',
    f4t: 'Lista spesa e famiglia', f4b: 'Reparti, prezzi e condivisione con famiglia o coinquilini.',
    f5t: 'Community', f5b: 'Pubblica le tue ricette, valuta, commenta, condividi e segui altri cuochi.',
    f6t: '10 lingue, pronto per RTL', f6b: "L'arabo inverte tutta l'interfaccia da destra a sinistra.",
    trust: 'Amato da chi cucina in casa', trustworthy: 'Nessuna carta, nessun fronzolo: solo cena.',
  },
  adminAlert: {
    loginTitle: 'Nuovo accesso', loginBody: '{name} ha appena effettuato l\'accesso · {device} · {time}',
    listTitle: 'Attività di accesso', empty: 'Nessun accesso registrato.', device: 'Dispositivo', user: 'Utente',
    when: 'Quando', seen: 'Letto', markSeen: 'Segna tutto come letto', liveOn: 'Avvisi attivi', liveOff: 'Avvisi silenziati',
    onlyAdmins: 'Solo admin',
  },
  aiLang: { mirror: 'Risponde nella tua lingua', detected: 'Risponde in {name}', note: "L'IA risponde nella lingua in cui scrivi." },
  cat: {
    title: 'Ricette per paese', progress: '{done} di {total} ricette per {country}',
    planned: 'Posti previsti', seeded: 'Inserite', comingSoon: 'In arrivo', sortAZ: 'Paesi A-Z',
  },
  err: {
    aiNotConfigured: "L'IA non è configurata: aggiungi la chiave in src/config.ts.",
    permissionDenied: 'Permesso negato', loadFailed: 'Impossibile caricare questi dati.', saveFailed: 'Salvataggio non riuscito. Riprova.',
  },
  notif: {
    lunchTitle: 'Ora di pranzo', lunchBody: 'Registra il pasto per rispettare l\'obiettivo giornaliero.',
    dinnerTitle: 'Ora di cena', dinnerBody: 'Una registrazione veloce tiene il piano in carreggiata.',
    water1T: 'Ora di bere', water1B: "Un po' d'acqua ti avvicina all'obiettivo.",
    water2T: 'Pausa acqua', water2B: 'Resta idratato: un bicchiere adesso aiuta.',
    water3T: 'Promemoria acqua', water3B: "Un po' d'acqua fa molto.",
    aiDoneT: 'Il tuo chef ha finito!', aiDoneB: 'Lo chef ha preparato "{title}". Guarda nella scheda Chef IA.',
    firstRecipeT: 'Prima ricetta nel ricettario!', firstRecipeB: '{name} è nel tuo ricettario. Buon appetito!',
    moreRecipesT: 'Abbiamo cucinato {n} ricette!', moreRecipesB: '{name} è dentro: sono {n} ricette.',
  },
};

const tr: Dict212 = {
  tut: {
    stepOf: 'Adım {n} / {total}', progress: 'İlerleme', skipStep: 'Bu adımı atla', skipTour: 'Turu atla',
    next: 'İleri', back: 'Geri', finish: 'Bitir', letsGo: 'Başlayalım', later: 'Sonra', resume: 'Tura devam et',
    restart: 'Turu yeniden başlat', restartHint: 'Tüm turu 1. adımdan gösterir.', resetTitle: 'Tur sıfırlandı',
    resetBody: 'İlerleme, sayaçlar ve "görüldü" işareti silindi. Tur 1. adımdan başlar.',
    doneTitle: 'Hazırsın', doneBody: 'Tur bitti. Ayarlardan istediğin zaman tekrar oynatabilirsin.',
    hintTap: 'İşaretli öğeye dokun', hintInput: 'İşaretli alana bir şey yaz',
    hintScroll: 'Devam etmek için kaydır', hintMissing: 'Bu öğe şu anda kullanılamıyor.',
  },
  langue: {
    title: 'Dil', auto: 'Cihaz dili', detected: 'Telefonundan algılandı: {name}',
    unsupportedTitle: 'Şimdilik İngilizce', pick: 'Dil seç', later: 'Sonra',
    unsupportedBody: 'Telefonunun dili henüz çevrilmedi. 10 dilden birini seç, Ayarlardan değiştirebilirsin.',
    restartTitle: 'Sağdan sola için yeniden başlat', restartNow: 'Şimdi yeniden başlat',
    restartBody: 'Arapça sağdan sola yazılır. Tüm ekranların dönmesi için Spoonful\'ı kapatıp aç.',
    changed: 'Dil değiştirildi',
  },
  home: {
    badge: '2.1.2 yenilikleri', everything: 'Tüm yenilikler', stats: 'Uygulama içinde',
    statRecipes: '1.100+ tarif', statCountries: '100 ülke planlandı', statLangs: '9 dil',
    f1t: 'Tarif kütüphanesi', f1b: 'Malzemeye veya yemeğe göre ara; ülke, süre, kalori ve diyete göre filtrele.',
    f2t: 'Yapay zeka şefi', f2b: 'Elindekileri yaz, tam bir tarif al - yazdığın dilde.',
    f3t: 'Barkod taramalı takip', f3b: 'Barkodu fotoğrafla, porsiyonu seç, yemek günlüğe eklensin.',
    f4t: 'Alışveriş listesi ve ev', f4b: 'Reyonlar, fiyatlar, aile veya ev arkadaşlarıyla paylaşım.',
    f5t: 'Topluluk', f5b: 'Tariflerini yayınla, puanla, yorum yap, paylaş ve diğer şefleri takip et.',
    f6t: '10 dil, RTL hazır', f6b: 'Arapça tüm arayüzü sağdan sola çevirir.',
    trust: 'Ev aşçılarının favorisi', trustworthy: 'Kart yok, karmaşa yok: sadece akşam yemeği.',
  },
  adminAlert: {
    loginTitle: 'Yeni giriş', loginBody: '{name} giriş yaptı · {device} · {time}',
    listTitle: 'Giriş hareketleri', empty: 'Henüz giriş kaydı yok.', device: 'Cihaz', user: 'Kullanıcı',
    when: 'Zaman', seen: 'Okundu', markSeen: 'Tümünü okundu işaretle', liveOn: 'Canlı uyarılar açık', liveOff: 'Uyarılar sessiz',
    onlyAdmins: 'Yalnızca yöneticiler',
  },
  aiLang: { mirror: 'Senin dilinde yanıtlar', detected: '{name} dilinde yanıtlıyor', note: 'Yapay zeka yazdığın dilde yanıtlar.' },
  cat: {
    title: 'Ülke başına tarifler', progress: '{country} için {total} tarifin {done} tanesi eklendi',
    planned: 'Planlanan yerler', seeded: 'Eklenen', comingSoon: 'Yakında', sortAZ: 'Ülkeler A-Z',
  },
  err: {
    aiNotConfigured: 'Yapay zeka yapılandırılmadı - src/config.ts içine anahtarı ekle.',
    permissionDenied: 'İzin reddedildi', loadFailed: 'Bu veriler yüklenemedi.', saveFailed: 'Kaydedilemedi. Tekrar dene.',
  },
  notif: {
    lunchTitle: 'Öğle yemeği zamanı', lunchBody: 'Günlük hedefine uymak için yemeğini kaydet.',
    dinnerTitle: 'Akşam yemeği zamanı', dinnerBody: 'Hızlı bir kayıt planını yolda tutar.',
    water1T: 'Su zamanı', water1B: 'Hedefine ulaşmak için biraz su iç.',
    water2T: 'Su molası', water2B: 'Susuz kalma - bir bardak şimdi yardımcı olur.',
    water3T: 'Su hatırlatması', water3B: 'Az su çok iş görür.',
    aiDoneT: 'Şefin hazır!', aiDoneB: 'Şef senin için "{title}" pişirdi. Yapay zeka şefi sekmesine bak.',
    firstRecipeT: 'Defterdeki ilk tarif!', firstRecipeB: '{name} tarif defterine eklendi. Afiyet olsun!',
    moreRecipesT: '{n} tarif pişirdik!', moreRecipesB: '{name} eklendi - toplam {n} tarif oldu.',
  },
};

const pt: Dict212 = {
  tut: {
    stepOf: 'Passo {n} de {total}', progress: 'Progresso', skipStep: 'Saltar este passo', skipTour: 'Saltar o tour',
    next: 'Avançar', back: 'Voltar', finish: 'Concluir', letsGo: 'Vamos lá', later: 'Mais tarde', resume: 'Continuar o tour',
    restart: 'Reiniciar o tutorial', restartHint: 'Mostra o tour completo desde o passo 1.', resetTitle: 'Tutorial reiniciado',
    resetBody: 'Progresso, contadores e a marca de "visto" foram apagados. O tour recomeça no passo 1.',
    doneTitle: 'Está tudo pronto', doneBody: 'O tour acabou. Pode repeti-lo nas Definições.',
    hintTap: 'Toque no elemento destacado', hintInput: 'Escreva algo no campo destacado',
    hintScroll: 'Deslize para continuar', hintMissing: 'Este elemento não está disponível agora.',
  },
  langue: {
    title: 'Idioma', auto: 'Idioma do dispositivo', detected: 'Detetado no seu telefone: {name}',
    unsupportedTitle: 'Inglês por agora', pick: 'Escolher idioma', later: 'Mais tarde',
    unsupportedBody: 'O idioma do telefone ainda não está traduzido. Escolha um dos 10 idiomas nas Definições.',
    restartTitle: 'Reiniciar para direita-esquerda', restartNow: 'Reiniciar agora',
    restartBody: 'O árabe escreve-se da direita para a esquerda. Feche e reabra o Spoonful para espelhar tudo.',
    changed: 'Idioma alterado',
  },
  home: {
    badge: 'Novo na 2.1.2', everything: 'Tudo o que é novo', stats: 'Dentro da app',
    statRecipes: '1.100+ receitas', statCountries: '100 países planeados', statLangs: '9 idiomas',
    f1t: 'Biblioteca de receitas', f1b: 'Pesquise por ingrediente ou prato e filtre por país, tempo, calorias e dieta.',
    f2t: 'Chef IA', f2b: 'Descreva o que tem e receba uma receita completa, no idioma em que escreveu.',
    f3t: 'Registo com código de barras', f3b: 'Fotografe o código, escolha a porção e a refeição entra no diário.',
    f4t: 'Lista de compras e casa', f4b: 'Corredores, preços e partilha com família ou colegas de casa.',
    f5t: 'Comunidade', f5b: 'Publique receitas, avalie, comente, partilhe e siga outros cozinheiros.',
    f6t: '10 idiomas, pronto para RTL', f6b: 'O árabe inverte toda a interface da direita para a esquerda.',
    trust: 'Adorado por cozinheiros caseiros', trustworthy: 'Sem cartão, sem complicações: só o jantar.',
  },
  adminAlert: {
    loginTitle: 'Novo início de sessão', loginBody: '{name} acabou de entrar · {device} · {time}',
    listTitle: 'Atividade de acesso', empty: 'Ainda não há acessos registados.', device: 'Dispositivo', user: 'Utilizador',
    when: 'Quando', seen: 'Lido', markSeen: 'Marcar tudo como lido', liveOn: 'Alertas ao vivo', liveOff: 'Alertas silenciados',
    onlyAdmins: 'Apenas administradores',
  },
  aiLang: { mirror: 'Responde no seu idioma', detected: 'Responde em {name}', note: 'A IA responde no idioma em que escreve.' },
  cat: {
    title: 'Receitas por país', progress: '{done} de {total} receitas para {country}',
    planned: 'Espaços previstos', seeded: 'Adicionadas', comingSoon: 'Em breve', sortAZ: 'Países A-Z',
  },
  err: {
    aiNotConfigured: 'A IA não está configurada: adicione a chave em src/config.ts.',
    permissionDenied: 'Permissão negada', loadFailed: 'Não foi possível carregar estes dados.', saveFailed: 'Não foi possível guardar. Tente de novo.',
  },
  notif: {
    lunchTitle: 'Hora do almoço', lunchBody: 'Registe a refeição para cumprir o objetivo do dia.',
    dinnerTitle: 'Hora do jantar', dinnerBody: 'Um registo rápido mantém o plano no rumo.',
    water1T: 'Hora de beber água', water1B: 'Um pouco de água aproxima-o do objetivo.',
    water2T: 'Pausa de água', water2B: 'Mantenha-se hidratado: um copo agora ajuda.',
    water3T: 'Lembrete de água', water3B: 'Um pouco de água faz muito.',
    aiDoneT: 'O seu chef terminou!', aiDoneB: 'O chef preparou "{title}". Veja o separador Chef IA.',
    firstRecipeT: 'Primeira receita no livro!', firstRecipeB: '{name} chegou ao seu livro de receitas. Bom apetite!',
    moreRecipesT: 'Cozinhámos {n} receitas!', moreRecipesB: '{name} entrou - já são {n} receitas.',
  },
};

const nl: Dict212 = {
  tut: {
    stepOf: 'Stap {n} van {total}', progress: 'Voortgang', skipStep: 'Deze stap overslaan', skipTour: 'Tour overslaan',
    next: 'Volgende', back: 'Terug', finish: 'Klaar', letsGo: 'Aan de slag', later: 'Later', resume: 'Tour hervatten',
    restart: 'Tutorial opnieuw starten', restartHint: 'Toont de hele tour weer vanaf stap 1.', resetTitle: 'Tutorial gereset',
    resetBody: 'Voortgang, tellers en de "gezien"-markering zijn gewist. De tour begint weer bij stap 1.',
    doneTitle: 'Je bent klaar', doneBody: 'Dat was de tour. Je kunt hem altijd herhalen in Instellingen.',
    hintTap: 'Tik op het gemarkeerde element', hintInput: 'Typ iets in het gemarkeerde veld',
    hintScroll: 'Scroll om verder te gaan', hintMissing: 'Dit element is nu niet beschikbaar.',
  },
  langue: {
    title: 'Taal', auto: 'Taal van het toestel', detected: 'Gedetecteerd op je telefoon: {name}',
    unsupportedTitle: 'Voorlopig Engels', pick: 'Taal kiezen', later: 'Later',
    unsupportedBody: 'De taal van je telefoon is nog niet vertaald. Kies een van de 10 talen in Instellingen.',
    restartTitle: 'Herstart voor rechts naar links', restartNow: 'Nu herstarten',
    restartBody: 'Arabisch schrijft van rechts naar links. Sluit Spoonful en open opnieuw zodat alles spiegelt.',
    changed: 'Taal gewijzigd',
  },
  home: {
    badge: 'Nieuw in 2.1.2', everything: 'Alles wat nieuw is', stats: 'In de app',
    statRecipes: '1.100+ recepten', statCountries: '100 landen gepland', statLangs: '9 talen',
    f1t: 'Receptenbibliotheek', f1b: 'Zoek op ingrediënt of gerecht en filter op land, tijd, calorieën en dieet.',
    f2t: 'AI-chef', f2b: 'Beschrijf wat je hebt en krijg een compleet recept, in de taal die je schrijft.',
    f3t: 'Tracker met barcodescan', f3b: 'Fotografeer de barcode, kies de portie en de maaltijd staat in je dagboek.',
    f4t: 'Boodschappenlijst en huishouden', f4b: 'Gangen, prijzen en delen met familie of huisgenoten.',
    f5t: 'Community', f5b: 'Deel je recepten, beoordeel, reageer, repost en volg andere koks.',
    f6t: '10 talen, RTL-klaar', f6b: 'Arabisch spiegelt de hele interface van rechts naar links.',
    trust: 'Geliefd bij thuiskoks', trustworthy: 'Geen kaart, geen gedoe - alleen het avondeten.',
  },
  adminAlert: {
    loginTitle: 'Nieuwe login', loginBody: '{name} is net ingelogd · {device} · {time}',
    listTitle: 'Loginactiviteit', empty: 'Nog geen logins geregistreerd.', device: 'Toestel', user: 'Gebruiker',
    when: 'Wanneer', seen: 'Gelezen', markSeen: 'Alles als gelezen', liveOn: 'Live meldingen aan', liveOff: 'Meldingen gedempt',
    onlyAdmins: 'Alleen voor beheerders',
  },
  aiLang: { mirror: 'Antwoordt in jouw taal', detected: 'Antwoordt in het {name}', note: 'De AI antwoordt in de taal die je schrijft.' },
  cat: {
    title: 'Recepten per land', progress: '{done} van {total} recepten voor {country}',
    planned: 'Geplande plekken', seeded: 'Toegevoegd', comingSoon: 'Binnenkort', sortAZ: 'Landen A-Z',
  },
  err: {
    aiNotConfigured: 'De AI is nog niet ingesteld - zet de sleutel in src/config.ts.',
    permissionDenied: 'Toestemming geweigerd', loadFailed: 'Deze gegevens konden niet laden.', saveFailed: 'Opslaan mislukt. Probeer opnieuw.',
  },
  notif: {
    lunchTitle: 'Tijd voor lunch', lunchBody: 'Log je maaltijd om je dagdoel te halen.',
    dinnerTitle: 'Tijd voor avondeten', dinnerBody: 'Een snelle log houdt je plan op koers.',
    water1T: 'Tijd voor water', water1B: 'Drink wat water om je doel te halen.',
    water2T: 'Waterpauze', water2B: 'Blijf gehydrateerd - een glas nu helpt.',
    water3T: 'Waterherinnering', water3B: 'Een beetje water doet veel.',
    aiDoneT: 'Je chef is klaar!', aiDoneB: 'De chef kookte "{title}" voor je. Kijk in het AI-chef-tabblad.',
    firstRecipeT: 'Eerste recept in het boek!', firstRecipeB: '{name} staat in je receptenboek. Eet smakelijk!',
    moreRecipesT: 'We hebben {n} recepten gekookt!', moreRecipesB: '{name} staat erbij - dat maakt {n} recepten.',
  },
};

const ru: Dict212 = {
  tut: {
    stepOf: 'Шаг {n} из {total}', progress: 'Прогресс', skipStep: 'Пропустить шаг', skipTour: 'Пропустить тур',
    next: 'Далее', back: 'Назад', finish: 'Готово', letsGo: 'Начнём', later: 'Позже', resume: 'Продолжить тур',
    restart: 'Перезапустить обучение', restartHint: 'Показывает весь тур снова с шага 1.', resetTitle: 'Обучение сброшено',
    resetBody: 'Прогресс, счётчики и отметка "просмотрено" удалены. Тур начнётся с шага 1.',
    doneTitle: 'Всё готово', doneBody: 'Тур завершён. Его можно повторить в настройках.',
    hintTap: 'Нажмите выделенный элемент', hintInput: 'Введите текст в выделенное поле',
    hintScroll: 'Пролистайте, чтобы продолжить', hintMissing: 'Этот элемент сейчас недоступен.',
  },
  langue: {
    title: 'Язык', auto: 'Язык устройства', detected: 'Определён по телефону: {name}',
    unsupportedTitle: 'Пока английский', pick: 'Выбрать язык', later: 'Позже',
    unsupportedBody: 'Язык вашего телефона ещё не переведён. Выберите один из 10 языков в настройках.',
    restartTitle: 'Перезапуск для письма справа налево', restartNow: 'Перезапустить',
    restartBody: 'Арабский пишется справа налево. Закройте и откройте Spoonful, чтобы всё отразилось.',
    changed: 'Язык изменён',
  },
  home: {
    badge: 'Новое в 2.1.2', everything: 'Всё новое', stats: 'Внутри приложения',
    statRecipes: 'Более 1100 рецептов', statCountries: '100 стран в планах', statLangs: '9 языков',
    f1t: 'Библиотека рецептов', f1b: 'Поиск по ингредиенту или блюду, фильтры по стране, времени, калориям и диете.',
    f2t: 'ИИ-повар', f2b: 'Опишите, что есть, и получите полный рецепт на своём языке.',
    f3t: 'Трекер со сканером штрихкода', f3b: 'Сфотографируйте штрихкод, выберите порцию - запись в дневнике.',
    f4t: 'Список покупок и семья', f4b: 'Отделы, цены и общий список с семьёй или соседями.',
    f5t: 'Сообщество', f5b: 'Публикуйте рецепты, оценивайте, комментируйте и подписывайтесь.',
    f6t: '10 языков, поддержка RTL', f6b: 'Арабский разворачивает весь интерфейс справа налево.',
    trust: 'Любят домашние повара', trustworthy: 'Без карты и лишнего - только ужин.',
  },
  adminAlert: {
    loginTitle: 'Новый вход', loginBody: '{name} вошёл · {device} · {time}',
    listTitle: 'Активность входов', empty: 'Входы пока не зафиксированы.', device: 'Устройство', user: 'Пользователь',
    when: 'Когда', seen: 'Прочитано', markSeen: 'Отметить всё прочитанным', liveOn: 'Уведомления включены', liveOff: 'Уведомления отключены',
    onlyAdmins: 'Только для админов',
  },
  aiLang: { mirror: 'Отвечает на вашем языке', detected: 'Отвечает на {name}', note: 'ИИ отвечает на языке, на котором вы пишете.' },
  cat: {
    title: 'Рецепты по странам', progress: '{done} из {total} рецептов для {country}',
    planned: 'Запланированные места', seeded: 'Добавлено', comingSoon: 'Скоро', sortAZ: 'Страны А-Я',
  },
  err: {
    aiNotConfigured: 'ИИ не настроен - добавьте ключ в src/config.ts.',
    permissionDenied: 'Доступ запрещён', loadFailed: 'Не удалось загрузить данные.', saveFailed: 'Не удалось сохранить. Попробуйте снова.',
  },
  notif: {
    lunchTitle: 'Время обеда', lunchBody: 'Запишите приём пищи, чтобы держать дневную цель.',
    dinnerTitle: 'Время ужина', dinnerBody: 'Быстрая запись сохранит план в норме.',
    water1T: 'Время воды', water1B: 'Выпейте воды, чтобы достичь цели.',
    water2T: 'Перерыв на воду', water2B: 'Оставайтесь с водным балансом - стакан сейчас поможет.',
    water3T: 'Напоминание о воде', water3B: 'Немного воды делает многое.',
    aiDoneT: 'Ваш повар готов!', aiDoneB: 'Повар приготовил "{title}". Загляните во вкладку ИИ-повар.',
    firstRecipeT: 'Первый рецепт в книге!', firstRecipeB: '{name} теперь в вашей книге рецептов. Приятного аппетита!',
    moreRecipesT: 'Мы приготовили {n} рецептов!', moreRecipesB: '{name} добавлен - всего {n} рецептов.',
  },
};

/** 2.1.2 namespaces per language (merged over the 2.0.0 dictionaries). */
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const __APP_212_PLACEHOLDER = null;

const en: Dict212 = {
  tut: {
    stepOf: 'Step {n} of {total}', progress: 'Progress', skipStep: 'Skip this step', skipTour: 'Skip tour',
    next: 'Next', back: 'Back', finish: 'Finish', letsGo: "Let's go", later: 'Later', resume: 'Continue the tour',
    restart: 'Restart the tutorial', restartHint: 'Shows the whole tour again from step 1.', resetTitle: 'Tutorial reset',
    resetBody: 'Progress, counters and the "seen" flag were cleared. The tour starts again from step 1.',
    doneTitle: 'You are ready', doneBody: 'That was the tour. You can replay it any time under Settings.',
    hintTap: 'Tap the highlighted element', hintInput: 'Type something into the highlighted field',
    hintScroll: 'Scroll to continue', hintMissing: 'This element is not available right now.',
  },
  langue: {
    title: 'Language', auto: 'Device language', detected: 'Detected from your phone: {name}',
    unsupportedTitle: 'English for now', pick: 'Choose language', later: 'Later',
    unsupportedBody: 'Your phone language is not translated yet. Pick one of the 10 languages - you can change it any time in Settings.',
    restartTitle: 'Restart for right-to-left', restartNow: 'Restart now',
    restartBody: 'Arabic is written right to left. Close and reopen Spoonful so every screen, icon and button flips.',
    changed: 'Language changed',
  },
  home: {
    badge: 'New in 2.1.2', everything: 'Everything that is new', stats: 'Inside the app',
    statRecipes: '1,100+ recipes', statCountries: '100 countries planned', statLangs: '9 languages',
    f1t: 'Recipe library', f1b: 'Search by ingredient or dish, filter by country, time, kcal and diet - with real photos and nutrition.',
    f2t: 'AI Chef', f2b: 'Describe what you have and get a full recipe back - in the language you wrote in.',
    f3t: 'Tracker with barcode scan', f3b: 'Photograph a barcode, pick your portion and your meal lands in the diary.',
    f4t: 'Shopping list & household', f4b: 'Aisles, prices, sharing with family or flatmates - checked off together.',
    f5t: 'Community', f5b: 'Publish your own recipes, rate, comment, repost and follow other cooks.',
    f6t: '10 languages, RTL ready', f6b: 'German, English, Arabic and more - Arabic flips the whole layout right to left.',
    trust: 'Loved by home cooks', trustworthy: 'No card, no clutter - just dinner.',
  },
  adminAlert: {
    loginTitle: 'New sign-in', loginBody: '{name} just signed in · {device} · {time}',
    listTitle: 'Login activity', empty: 'No sign-ins recorded yet.', device: 'Device', user: 'User',
    when: 'When', seen: 'Seen', markSeen: 'Mark all as read', liveOn: 'Live alerts on', liveOff: 'Alerts muted',
    onlyAdmins: 'Admins only',
  },
  aiLang: { mirror: 'Answers in your language', detected: 'Answering in {name}', note: 'The AI replies in the language you write in.' },
  cat: {
    title: 'Recipes per country', progress: '{done} of {total} recipes seeded for {country}',
    planned: 'Planned slots', seeded: 'Seeded', comingSoon: 'Coming soon', sortAZ: 'Countries A-Z',
  },
  err: {
    aiNotConfigured: 'The AI is not configured yet - add the API key in src/config.ts.',
    permissionDenied: 'Permission denied', loadFailed: 'Could not load this data.', saveFailed: 'Could not save. Please try again.',
  },
  notif: {
    lunchTitle: 'Time for lunch', lunchBody: 'Log your meal to stay on track with your daily goal.',
    dinnerTitle: 'Dinner time', dinnerBody: 'A quick log keeps your nutrition plan on target.',
    water1T: 'Time for water', water1B: 'Sip some water to reach your fluid goal.',
    water2T: 'Water break', water2B: 'Stay hydrated - a glass now helps.',
    water3T: 'Water reminder', water3B: 'A little water goes a long way.',
    aiDoneT: 'Your chef is done!', aiDoneB: 'The chef just cooked "{title}" for you. Take a peek in the AI Chef tab.',
    firstRecipeT: 'First recipe in the book!', firstRecipeB: '{name} just landed in your recipe book. Bon appetit!',
    moreRecipesT: 'We cooked {n} recipes!', moreRecipesB: '{name} is in - that makes {n} recipes in your collection.',
  },
};

/** 2.1.2 namespaces per language (merged over the 2.0.0 dictionaries). */
export const APP_212: Record<Language, Dict212> = { en, de, ar, fr, es, it, tr, pt, nl, ru };

