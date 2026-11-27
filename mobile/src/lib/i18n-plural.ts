// Einzahl/Mehrzahl für Zähltexte in der Oberfläche.
// Die Mehrzahl kommt weiterhin aus dem normalen Wörterbuch; hier stehen nur die
// Formen, die dort fehlen (Einzahl, im Russischen/Ukrainischen/Polnischen und
// Arabischen zusätzlich die Form für 2–4).
import type { Language } from './i18n';

type Forms = { one: string; two?: string; few?: string };

const FORMS: Record<string, Partial<Record<Language, Forms>>> = {
  's.hhMembers': {
    de: { one: 'Mitglied' },
    en: { one: 'member' },
    ar: { one: 'عضو', two: 'عضوان', few: 'أعضاء' },
    fr: { one: 'membre' },
    es: { one: 'miembro' },
    it: { one: 'membro' },
    tr: { one: 'üye' },
    pt: { one: 'membro' },
    nl: { one: 'lid' },
    ru: { one: 'участник', few: 'участника' },
    uk: { one: 'учасник', few: 'учасники' },
    zh: { one: '成员' },
    ja: { one: 'メンバー' },
    ko: { one: '구성원' },
    hi: { one: 'सदस्य' },
    pl: { one: 'członek', few: 'członków' },
  },
  's.hhShoppingOpen': {
    de: { one: 'offener Posten' },
    en: { one: 'open item' },
    ar: { one: 'عنصر مفتوح', two: 'عنصران مفتوحان', few: 'عناصر مفتوحة' },
    fr: { one: 'article ouvert' },
    es: { one: 'pendiente' },
    it: { one: 'voce aperta' },
    tr: { one: 'açık kalem' },
    pt: { one: 'item aberto' },
    nl: { one: 'open item' },
    ru: { one: 'открытая позиция', few: 'открытые позиции' },
    uk: { one: 'відкрита позиція', few: 'відкриті позиції' },
    zh: { one: '待购项目' },
    ja: { one: '未購入の項目' },
    ko: { one: '남은 항목' },
    hi: { one: 'बाकी चीज़' },
    pl: { one: 'otwarta pozycja', few: 'otwarte pozycje' },
  },
  's.shopOpen': {
    de: { one: 'offener Posten' },
    en: { one: 'open item' },
    ar: { one: 'عنصر مفتوح', two: 'عنصران مفتوحان', few: 'عناصر مفتوحة' },
    fr: { one: 'article ouvert' },
    es: { one: 'pendiente' },
    it: { one: 'voce aperta' },
    tr: { one: 'açık kalem' },
    pt: { one: 'item aberto' },
    nl: { one: 'open item' },
    ru: { one: 'открытая позиция', few: 'открытые позиции' },
    uk: { one: 'відкрита позиція', few: 'відкриті позиції' },
    zh: { one: '待购项目' },
    ja: { one: '未購入の項目' },
    ko: { one: '남은 항목' },
    hi: { one: 'बाकी चीज़' },
    pl: { one: 'otwarta pozycja', few: 'otwarte pozycje' },
  },
  's.hhTasksSection': {
    de: { one: 'Aufgabe' },
    en: { one: 'task' },
    ar: { one: 'مهمة', two: 'مهمتان', few: 'مهام' },
    fr: { one: 'tâche' },
    es: { one: 'tarea' },
    it: { one: 'attività' },
    tr: { one: 'görev' },
    pt: { one: 'tarefa' },
    nl: { one: 'taak' },
    ru: { one: 'задача', few: 'задачи' },
    uk: { one: 'задача', few: 'задачі' },
    zh: { one: '任务' },
    ja: { one: 'タスク' },
    ko: { one: '할 일' },
    hi: { one: 'कार्य' },
    pl: { one: 'zadanie', few: 'zadania' },
  },
  'library.recipes': {
    de: { one: 'Rezept' },
    en: { one: 'recipe' },
    ar: { one: 'وصفة', two: 'وصفتان', few: 'وصفات' },
    fr: { one: 'recette' },
    es: { one: 'receta' },
    it: { one: 'ricetta' },
    tr: { one: 'tarif' },
    pt: { one: 'receita' },
    nl: { one: 'recept' },
    ru: { one: 'рецепт', few: 'рецепта' },
    uk: { one: 'рецепт', few: 'рецепти' },
    zh: { one: '食谱' },
    ja: { one: 'レシピ' },
    ko: { one: '레시피' },
    hi: { one: 'रेसिपी' },
    pl: { one: 'przepis', few: 'przepisy' },
  },
};

function category(lang: Language, n: number): 'one' | 'two' | 'few' | 'many' {
  const value = Math.abs(Math.trunc(n));
  if (lang === 'ru' || lang === 'uk' || lang === 'pl') {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
  }
  if (lang === 'ar') {
    if (value === 1) return 'one';
    if (value === 2) return 'two';
    if (value >= 3 && value <= 10) return 'few';
    return 'many';
  }
  return value === 1 ? 'one' : 'many';
}

/**
 * Gibt die passende Zählform zurück, oder null wenn die normale
 * Wörterbuch-Übersetzung verwendet werden soll (Mehrzahl).
 */
export function pluralForm(lang: Language, count: number, key: string): string | null {
  const forms = FORMS[key]?.[lang];
  if (!forms) return null;
  const cat = category(lang, count);
  if (cat === 'one') return forms.one;
  if (cat === 'two' && forms.two) return forms.two;
  if (cat === 'few' && forms.few) return forms.few;
  return null;
}
