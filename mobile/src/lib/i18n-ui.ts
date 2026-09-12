import type { Language } from './i18n';

/**
 * Spoonful 2.1.2 `ui` namespace.
 *
 * Small screen labels that used to be hardcoded English in the JSX: notification
 * preferences, the help/danger sections of the settings screen and the account
 * rows. Every language carries the same keys (English is the last fallback
 * instance only).
 */
export type UiDict = Record<string, string>;

export const UI_L10N: Record<Language, UiDict> = {
  en: {
    notifTitle: 'Notifications', notifMeal: 'Meal reminders', notifMealDesc: 'Lunch 13:00 · Dinner 19:00',
    notifDrink: 'Drink reminders', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'AI Chef done',
    notifAiDesc: 'When your AI recipe is ready', notifAdded: 'Recipe added', notifAddedDesc: 'When you add a recipe',
    help: 'Help', contact: 'Contact support', exportData: 'Export my data', danger: 'Danger zone',
    deleteAccount: 'Delete my account', deleteAccountBody: 'This removes your account and all your recipes.',
    tutorialSection: 'Tour', name: 'Name', email: 'Email', offlineNoNet: 'You are offline',
  },
  de: {
    notifTitle: 'Benachrichtigungen', notifMeal: 'Essens-Erinnerungen', notifMealDesc: 'Mittag 13:00 · Abend 19:00',
    notifDrink: 'Trink-Erinnerungen', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'KI-Koch fertig',
    notifAiDesc: 'Wenn dein KI-Rezept bereit ist', notifAdded: 'Rezept hinzugefügt', notifAddedDesc: 'Wenn du ein Rezept anlegst',
    help: 'Hilfe', contact: 'Support kontaktieren', exportData: 'Meine Daten exportieren', danger: 'Gefahrenzone',
    deleteAccount: 'Konto löschen', deleteAccountBody: 'Entfernt dein Konto und alle deine Rezepte.',
    tutorialSection: 'Tour', name: 'Name', email: 'E-Mail', offlineNoNet: 'Du bist offline',
  },
  ar: {
    notifTitle: 'الإشعارات', notifMeal: 'تذكير الوجبات', notifMealDesc: 'الغداء ١٣:٠٠ · العشاء ١٩:٠٠',
    notifDrink: 'تذكير الماء', notifDrinkDesc: '١٠:٠٠ · ١٤:٠٠ · ١٧:٣٠', notifAi: 'الشيف الذكي انتهى',
    notifAiDesc: 'عندما تصبح الوصفة جاهزة', notifAdded: 'تمت إضافة وصفة', notifAddedDesc: 'عند إضافة وصفة',
    help: 'المساعدة', contact: 'تواصل مع الدعم', exportData: 'تصدير بياناتي', danger: 'منطقة الخطر',
    deleteAccount: 'حذف حسابي', deleteAccountBody: 'يحذف حسابك وكل وصفاتك.',
    tutorialSection: 'الجولة', name: 'الاسم', email: 'البريد', offlineNoNet: 'أنت غير متصل',
  },
  fr: {
    notifTitle: 'Notifications', notifMeal: 'Rappels de repas', notifMealDesc: 'Déjeuner 13:00 · Dîner 19:00',
    notifDrink: 'Rappels de boisson', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'Chef IA terminé',
    notifAiDesc: 'Quand votre recette IA est prête', notifAdded: 'Recette ajoutée', notifAddedDesc: 'Quand vous ajoutez une recette',
    help: 'Aide', contact: 'Contacter le support', exportData: 'Exporter mes données', danger: 'Zone sensible',
    deleteAccount: 'Supprimer mon compte', deleteAccountBody: 'Supprime votre compte et toutes vos recettes.',
    tutorialSection: 'Visite', name: 'Nom', email: 'E-mail', offlineNoNet: 'Vous êtes hors ligne',
  },
  es: {
    notifTitle: 'Notificaciones', notifMeal: 'Recordatorios de comida', notifMealDesc: 'Comida 13:00 · Cena 19:00',
    notifDrink: 'Recordatorios de bebida', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'Chef IA listo',
    notifAiDesc: 'Cuando tu receta con IA esté lista', notifAdded: 'Receta añadida', notifAddedDesc: 'Cuando añades una receta',
    help: 'Ayuda', contact: 'Contactar con soporte', exportData: 'Exportar mis datos', danger: 'Zona peligrosa',
    deleteAccount: 'Eliminar mi cuenta', deleteAccountBody: 'Elimina tu cuenta y todas tus recetas.',
    tutorialSection: 'Tour', name: 'Nombre', email: 'Correo', offlineNoNet: 'Estás sin conexión',
  },
  it: {
    notifTitle: 'Notifiche', notifMeal: 'Promemoria pasti', notifMealDesc: 'Pranzo 13:00 · Cena 19:00',
    notifDrink: 'Promemoria bevande', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'Chef IA pronto',
    notifAiDesc: 'Quando la ricetta IA è pronta', notifAdded: 'Ricetta aggiunta', notifAddedDesc: 'Quando aggiungi una ricetta',
    help: 'Aiuto', contact: 'Contatta il supporto', exportData: 'Esporta i miei dati', danger: 'Zona critica',
    deleteAccount: 'Elimina il mio account', deleteAccountBody: 'Elimina il tuo account e tutte le tue ricette.',
    tutorialSection: 'Tour', name: 'Nome', email: 'Email', offlineNoNet: 'Sei offline',
  },
  tr: {
    notifTitle: 'Bildirimler', notifMeal: 'Yemek hatırlatmaları', notifMealDesc: 'Öğle 13:00 · Akşam 19:00',
    notifDrink: 'Su hatırlatmaları', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'Yapay zeka şefi hazır',
    notifAiDesc: 'Yapay zeka tarifin hazır olduğunda', notifAdded: 'Tarif eklendi', notifAddedDesc: 'Tarif eklediğinde',
    help: 'Yardım', contact: 'Destek ile iletişim', exportData: 'Verilerimi indir', danger: 'Tehlikeli bölge',
    deleteAccount: 'Hesabımı sil', deleteAccountBody: 'Hesabını ve tüm tariflerini siler.',
    tutorialSection: 'Tur', name: 'İsim', email: 'E-posta', offlineNoNet: 'Çevrimdışısın',
  },
  pt: {
    notifTitle: 'Notificações', notifMeal: 'Lembretes de refeições', notifMealDesc: 'Almoço 13:00 · Jantar 19:00',
    notifDrink: 'Lembretes de água', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'Chef IA pronto',
    notifAiDesc: 'Quando a sua receita de IA estiver pronta', notifAdded: 'Receita adicionada', notifAddedDesc: 'Quando adiciona uma receita',
    help: 'Ajuda', contact: 'Contactar o suporte', exportData: 'Exportar os meus dados', danger: 'Zona de risco',
    deleteAccount: 'Eliminar a minha conta', deleteAccountBody: 'Remove a sua conta e todas as receitas.',
    tutorialSection: 'Tour', name: 'Nome', email: 'E-mail', offlineNoNet: 'Está offline',
  },
  nl: {
    notifTitle: 'Meldingen', notifMeal: 'Maaltijdherinneringen', notifMealDesc: 'Lunch 13:00 · Diner 19:00',
    notifDrink: 'Drinkherinneringen', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'AI-chef klaar',
    notifAiDesc: 'Wanneer je AI-recept klaar is', notifAdded: 'Recept toegevoegd', notifAddedDesc: 'Wanneer je een recept toevoegt',
    help: 'Hulp', contact: 'Contact met support', exportData: 'Mijn gegevens exporteren', danger: 'Gevarenzone',
    deleteAccount: 'Mijn account verwijderen', deleteAccountBody: 'Verwijdert je account en al je recepten.',
    tutorialSection: 'Tour', name: 'Naam', email: 'E-mail', offlineNoNet: 'Je bent offline',
  },
  ru: {
    notifTitle: 'Уведомления', notifMeal: 'Напоминания о еде', notifMealDesc: 'Обед 13:00 · Ужин 19:00',
    notifDrink: 'Напоминания о воде', notifDrinkDesc: '10:00 · 14:00 · 17:30', notifAi: 'ИИ-повар готов',
    notifAiDesc: 'Когда рецепт от ИИ готов', notifAdded: 'Рецепт добавлен', notifAddedDesc: 'Когда вы добавляете рецепт',
    help: 'Помощь', contact: 'Связаться с поддержкой', exportData: 'Экспорт моих данных', danger: 'Опасная зона',
    deleteAccount: 'Удалить аккаунт', deleteAccountBody: 'Удаляет аккаунт и все ваши рецепты.',
    tutorialSection: 'Тур', name: 'Имя', email: 'Почта', offlineNoNet: 'Вы не в сети',
  },
};
