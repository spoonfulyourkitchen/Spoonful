

type Dict = Record<string, any>;

const en: Dict = {
  adminAlert: {
    newUserTitle: 'New user',
    newUserBody: '{name} just created an account · {device}',
  },
  auth: {
    cookingExpLater: 'Cooking mode with step-by-step help starts inside the app.',
  },
  s: {
    qrReported: '{title}: image report sent.',
    qrReportFailed: 'The report could not be sent. Please try again.',
    qrModeBadge: 'Quick report',
    qrA11y: 'Report the image of this recipe',
    adminSection: 'For admins',
    adminQuickReport: 'Quick report',
    adminQuickReportDesc: 'One tap on a recipe reports its image right away (no popup).',
  },
  ui: {
    notifAdmin: 'New users & sign-ins',
    notifAdminDesc: 'Admins only: get a notification when somebody creates an account or signs in.',
  },
};

const de: Dict = {
  adminAlert: {
    newUserTitle: 'Neuer Nutzer',
    newUserBody: '{name} hat gerade ein Konto erstellt · {device}',
  },
  auth: {
    cookingExpLater: 'Der Kochmodus mit Schritt-Hinweisen startet in der App selbst.',
  },
  s: {
    qrReported: '{title}: Bildmeldung gesendet.',
    qrReportFailed: 'Die Meldung konnte nicht gesendet werden. Bitte nochmal versuchen.',
    qrModeBadge: 'Schnellmelden',
    qrA11y: 'Bild dieses Rezepts melden',
    adminSection: 'Für Admins',
    adminQuickReport: 'Schnellmelden',
    adminQuickReportDesc: 'Ein Tipp auf ein Rezept meldet sofort das Bild (kein Popup).',
  },
  ui: {
    notifAdmin: 'Neue Nutzer & Anmeldungen',
    notifAdminDesc: 'Nur für Admins: Hinweis, wenn jemand ein Konto erstellt oder sich anmeldet.',
  },
};

const ar: Dict = {
  adminAlert: {
    newUserTitle: 'مستخدم جديد',
    newUserBody: '{name} أنشأ حساباً للتو · {device}',
  },
  auth: {
    cookingExpLater: 'يبدأ وضع الطبخ مع الإرشادات خطوة بخطوة داخل التطبيق.',
  },
  s: {
    qrReported: '{title}: تم إرسال بلاغ الصورة.',
    qrReportFailed: 'تعذر إرسال البلاغ. حاول مرة أخرى.',
    qrModeBadge: 'بلاغ سريع',
    qrA11y: 'أبلغ عن صورة هذه الوصفة',
    adminSection: 'للمشرفين',
    adminQuickReport: 'بلاغ سريع',
    adminQuickReportDesc: 'لمسة واحدة على الوصفة ترسل بلاغ الصورة فوراً (بدون نافذة).',
  },
  ui: {
    notifAdmin: 'مستخدمون جدد وتسجيلات دخول',
    notifAdminDesc: 'للمشرفين فقط: تنبيه عند إنشاء حساب أو تسجيل دخول.',
  },
};

const fr: Dict = {
  adminAlert: {
    newUserTitle: 'Nouvel utilisateur',
    newUserBody: '{name} vient de creer un compte · {device}',
  },
  auth: {
    cookingExpLater: 'Le mode cuisine avec aide etape par etape demarre dans l app.',
  },
  s: {
    qrReported: '{title} : signalement de l image envoye.',
    qrReportFailed: 'Le signalement n a pas pu etre envoye. Reessaie.',
    qrModeBadge: 'Signalement rapide',
    qrA11y: 'Signaler l image de cette recette',
    adminSection: 'Pour les admins',
    adminQuickReport: 'Signalement rapide',
    adminQuickReportDesc: 'Un appui sur une recette signale son image tout de suite (sans popup).',
  },
  ui: {
    notifAdmin: 'Nouveaux utilisateurs et connexions',
    notifAdminDesc: 'Admins uniquement : notification quand quelqu un cree un compte ou se connecte.',
  },
};

const es: Dict = {
  adminAlert: {
    newUserTitle: 'Nuevo usuario',
    newUserBody: '{name} acaba de crear una cuenta · {device}',
  },
  auth: {
    cookingExpLater: 'El modo cocina con ayuda paso a paso empieza dentro de la app.',
  },
  s: {
    qrReported: '{title}: aviso de imagen enviado.',
    qrReportFailed: 'No se pudo enviar el aviso. Intentalo de nuevo.',
    qrModeBadge: 'Aviso rapido',
    qrA11y: 'Avisar sobre la imagen de esta receta',
    adminSection: 'Para administradores',
    adminQuickReport: 'Aviso rapido',
    adminQuickReportDesc: 'Un toque en una receta avisa de su imagen al instante (sin ventana).',
  },
  ui: {
    notifAdmin: 'Nuevos usuarios e inicios de sesion',
    notifAdminDesc: 'Solo admins: aviso cuando alguien crea una cuenta o inicia sesion.',
  },
};

const it: Dict = {
  adminAlert: {
    newUserTitle: 'Nuovo utente',
    newUserBody: '{name} ha appena creato un account · {device}',
  },
  auth: {
    cookingExpLater: 'La modalita cucina con guida passo passo parte dentro l app.',
  },
  s: {
    qrReported: '{title}: segnalazione immagine inviata.',
    qrReportFailed: 'La segnalazione non e stata inviata. Riprova.',
    qrModeBadge: 'Segnalazione rapida',
    qrA11y: 'Segnala l immagine di questa ricetta',
    adminSection: 'Per gli admin',
    adminQuickReport: 'Segnalazione rapida',
    adminQuickReportDesc: 'Un tocco su una ricetta segnala subito l immagine (senza popup).',
  },
  ui: {
    notifAdmin: 'Nuovi utenti e accessi',
    notifAdminDesc: 'Solo admin: avviso quando qualcuno crea un account o accede.',
  },
};

const tr: Dict = {
  adminAlert: {
    newUserTitle: 'Yeni kullanici',
    newUserBody: '{name} az once hesap olusturdu · {device}',
  },
  auth: {
    cookingExpLater: 'Adim adim yardimli pisirme modu uygulama icinde baslar.',
  },
  s: {
    qrReported: '{title}: gorsel bildirimi gonderildi.',
    qrReportFailed: 'Bildirim gonderilemedi. Tekrar dene.',
    qrModeBadge: 'Hizli bildirim',
    qrA11y: 'Bu tarifin gorselini bildir',
    adminSection: 'Yoneticiler icin',
    adminQuickReport: 'Hizli bildirim',
    adminQuickReportDesc: 'Tarife bir dokunus gorselini hemen bildirir (popup yok).',
  },
  ui: {
    notifAdmin: 'Yeni kullanicilar ve girisler',
    notifAdminDesc: 'Sadece yoneticiler: biri hesap olusturunca veya giris yapinca bildirim.',
  },
};

const pt: Dict = {
  adminAlert: {
    newUserTitle: 'Novo utilizador',
    newUserBody: '{name} acabou de criar uma conta · {device}',
  },
  auth: {
    cookingExpLater: 'O modo cozinha com ajuda passo a passo comeca dentro da app.',
  },
  s: {
    qrReported: '{title}: denuncia da imagem enviada.',
    qrReportFailed: 'Nao foi possivel enviar a denuncia. Tenta de novo.',
    qrModeBadge: 'Denuncia rapida',
    qrA11y: 'Denunciar a imagem desta receita',
    adminSection: 'Para admins',
    adminQuickReport: 'Denuncia rapida',
    adminQuickReportDesc: 'Um toque numa receita denuncia logo a imagem (sem popup).',
  },
  ui: {
    notifAdmin: 'Novos utilizadores e inicios de sessao',
    notifAdminDesc: 'So admins: aviso quando alguem cria conta ou inicia sessao.',
  },
};

const nl: Dict = {
  adminAlert: {
    newUserTitle: 'Nieuwe gebruiker',
    newUserBody: '{name} heeft net een account gemaakt · {device}',
  },
  auth: {
    cookingExpLater: 'De kookmodus met stap-voor-stap hulp start in de app zelf.',
  },
  s: {
    qrReported: '{title}: beeldmelding verzonden.',
    qrReportFailed: 'De melding kon niet worden verzonden. Probeer het opnieuw.',
    qrModeBadge: 'Snel melden',
    qrA11y: 'Meld de afbeelding van dit recept',
    adminSection: 'Voor beheerders',
    adminQuickReport: 'Snel melden',
    adminQuickReportDesc: 'Een tik op een recept meldt de afbeelding meteen (geen popup).',
  },
  ui: {
    notifAdmin: 'Nieuwe gebruikers en aanmeldingen',
    notifAdminDesc: 'Alleen beheerders: melding wanneer iemand een account maakt of inlogt.',
  },
};

const ru: Dict = {
  adminAlert: {
    newUserTitle: 'Новый пользователь',
    newUserBody: '{name} только что создал аккаунт · {device}',
  },
  auth: {
    cookingExpLater: 'Режим готовки с подсказками по шагам запускается внутри приложения.',
  },
  s: {
    qrReported: '{title}: жалоба на изображение отправлена.',
    qrReportFailed: 'Не удалось отправить жалобу. Попробуйте ещё раз.',
    qrModeBadge: 'Быстрая жалоба',
    qrA11y: 'Пожаловаться на изображение этого рецепта',
    adminSection: 'Для админов',
    adminQuickReport: 'Быстрая жалоба',
    adminQuickReportDesc: 'Одно нажатие на рецепт сразу отправляет жалобу на изображение (без окна).',
  },
  ui: {
    notifAdmin: 'Новые пользователи и входы',
    notifAdminDesc: 'Только админам: уведомление, когда кто-то создаёт аккаунт или входит.',
  },
};

export const APP_332: Record<string, Dict> = { en, de, ar, fr, es, it, tr, pt, nl, ru };
