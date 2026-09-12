/**
 * Small localisation helper for the 2.1.0 product/barcode flow.
 *
 * The tracker's barcode + portion UI is new, so its copy lives here in English,
 * German and Arabic; every other language falls back to English. Keeping it in
 * one place makes it trivial to move these strings into the big dictionaries.
 */
export type TriText = { en: string; de?: string; ar?: string };

export function pick(lang: string, text: TriText): string {
  if (lang === 'de' && text.de) return text.de;
  if (lang === 'ar' && text.ar) return text.ar;
  return text.en;
}

export const BARCODE_L10N = {
  scanTitle: {
    en: 'Scan a barcode',
    de: 'Barcode scannen',
    ar: 'امسح الباركود',
  },
  scanHint: {
    en: 'Photograph the barcode on the package - or pick a photo from your gallery. The number is read from the picture automatically.',
    de: 'Fotografiere den Barcode auf der Packung - oder wähle ein Foto aus der Galerie. Die Nummer wird automatisch aus dem Bild gelesen.',
    ar: 'صوّر الباركود على العبوة أو اختر صورة من المعرض؛ يتم قراءة الرقم تلقائياً.',
  },
  takePhoto: { en: 'Take a photo', de: 'Foto aufnehmen', ar: 'التقط صورة' },
  fromGallery: { en: 'From gallery', de: 'Aus Galerie', ar: 'من المعرض' },
  reading: { en: 'Reading the barcode…', de: 'Barcode wird gelesen…', ar: 'جارٍ قراءة الباركود…' },
  notFound: {
    en: 'No barcode found in the picture. Try a sharper photo of the code itself.',
    de: 'Im Bild war kein Barcode zu erkennen. Versuch ein schärferes Foto vom Code.',
    ar: 'لم يتم العثور على باركود في الصورة. جرّب صورة أوضح.',
  },
  manual: {
    en: 'Or type the number',
    de: 'Oder Nummer eintippen',
    ar: 'أو اكتب الرقم',
  },
  use: { en: 'Use', de: 'Übernehmen', ar: 'استخدم' },
  cancel: { en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  portionTitle: { en: 'How much?', de: 'Wie viel?', ar: 'كم الكمية؟' },
  oneServing: { en: '1 portion', de: '1 Portion', ar: 'حصة واحدة' },
  hundredG: { en: '100 g', de: '100 g', ar: '١٠٠ غرام' },
  wholePackage: { en: 'Whole package', de: 'Ganze Packung', ar: 'العبوة كاملة' },
  customAmount: { en: 'Own amount', de: 'Eigene Menge', ar: 'كمية مخصصة' },
  grams: { en: 'grams', de: 'Gramm', ar: 'غرام' },
  addToTracker: { en: 'Add to tracker', de: 'Ins Tagebuch', ar: 'أضف إلى السجل' },
  unknownAmount: {
    en: 'This product does not list a weight - please enter grams.',
    de: 'Für dieses Produkt ist keine Menge hinterlegt - bitte Gramm eingeben.',
    ar: 'لا يتوفر وزن لهذا المنتج، أدخل الغرامات.',
  },
  /* 2.1.1: sharper photos + better recognition */
  sharpnessTitle: {
    en: 'A sharp photo is decoded best',
    de: 'Ein scharfes Foto wird am sichersten erkannt',
    ar: 'الصورة الواضحة تُقرأ بأفضل شكل',
  },
  tipFill: {
    en: 'Fill the whole frame with the barcode',
    de: 'Fülle das Bild ganz mit dem Barcode',
    ar: 'املأ الإطار بالباركود',
  },
  tipDistance: {
    en: 'Hold 10-20 cm away and keep the hand still',
    de: '10-20 cm Abstand halten und ruhig halten',
    ar: 'التقط من مسافة ١٠-٢٠ سم وبثبات',
  },
  tipLight: {
    en: 'Bright light, no shadows or glare',
    de: 'Gutes Licht, keine Schatten und kein Blitzlicht',
    ar: 'إضاءة جيدة بدون ظل أو انعكاس',
  },
  blurry: {
    en: 'That photo was too blurry. Move closer and take a new one.',
    de: 'Das Foto war zu unscharf. Geh näher ran und mach ein neues.',
    ar: 'الصورة غير واضحة. اقترب والتقط صورة جديدة.',
  },
  noCodeHere: {
    en: 'No barcode in the picture yet - fill the frame with the code.',
    de: 'Noch kein Barcode im Bild - fülle das Bild mit dem Code.',
    ar: 'لا يوجد باركود في الصورة، املأ الإطار بالرمز.',
  },
  retry: { en: 'Try again', de: 'Nochmal versuchen', ar: 'حاول مرة أخرى' },
  blurryTitle: { en: 'Photo too blurry', de: 'Foto zu unscharf', ar: 'الصورة غير واضحة' },
  noCodeTitle: { en: 'No barcode recognised', de: 'Kein Barcode erkannt', ar: 'لم يتم التعرف على الباركود' },
  pass: { en: 'Pass', de: 'Durchgang', ar: 'محاولة' },
  notInDatabase: {
    en: 'This product is not in the database yet. You can still type the values yourself.',
    de: 'Dieses Produkt ist noch nicht in der Datenbank. Du kannst die Werte selbst eintragen.',
    ar: 'هذا المنتج غير موجود في قاعدة البيانات، يمكنك إدخال القيم يدوياً.',
  },
} as const;

/**
 * Copy for the tracker blocks that were rebuilt in 2.1.1 (weight card, goal
 * suggestion popup). Same fallback rule as above.
 */
export const TRACKER_L10N = {
  weightTitle: { en: 'Weight', de: 'Gewicht', ar: 'الوزن' },
  weightHint: {
    en: 'Log your weight regularly - the trend then suggests the right goal.',
    de: 'Trag dein Gewicht regelmäßig ein - der Trend schlägt dann das passende Ziel vor.',
    ar: 'سجّل وزنك بانتظام ليقترح الاتجاه الهدف المناسب.',
  },
  weightPlaceholder: { en: 'e.g. 75.5', de: 'z. B. 75,5', ar: 'مثل ٧٥٫٥' },
  weightSaved: { en: 'Weight saved', de: 'Gewicht gespeichert', ar: 'تم حفظ الوزن' },
  weightInvalid: {
    en: 'Please enter a weight between 20 and 400 kg.',
    de: 'Bitte ein Gewicht zwischen 20 und 400 kg eingeben.',
    ar: 'أدخل وزناً بين ٢٠ و ٤٠٠ كغ.',
  },
  save: { en: 'Save', de: 'Speichern', ar: 'حفظ' },
  goalAdjustedTitle: { en: 'Goal adjusted', de: 'Ziel angepasst', ar: 'تم تعديل الهدف' },
  goalHint: {
    en: 'Based on your weight trend we suggest',
    de: 'Auf Basis deines Gewichtstrends empfehlen wir',
    ar: 'بناءً على اتجاه وزنك نقترح',
  },
  ok: { en: 'Got it', de: 'Alles klar', ar: 'حسناً' },
  scanCardTitle: { en: 'Add food', de: 'Essen hinzufügen', ar: 'أضف طعاماً' },
} as const;

/** 2.1.1: the shopping-list extras that used to unfold inline. */
export const SHOP_L10N = {
  extrasTitle: { en: 'List options', de: 'Listen-Optionen', ar: 'خيارات القائمة' },
  extrasTotal: { en: 'Total so far', de: 'Summe bisher', ar: 'المجموع حتى الآن' },
  extrasHousehold: { en: 'Shared list', de: 'Geteilte Liste', ar: 'قائمة مشتركة' },
  keep: { en: 'Done for now', de: 'Fertig für jetzt', ar: 'انتهيت الآن' },
} as const;
