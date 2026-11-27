// Anzeige-Namen der schnellen Zutaten im KI-Tab. Der gespeicherte Wert bleibt
// die englische Zutat, damit die KI-Prompts stabil bleiben.
import type { Language } from './i18n';

const LABELS: Record<string, Record<Language, string>> = {
  eggs: { de: 'Eier', en: 'Eggs', ar: 'بيض', fr: 'Œufs', es: 'Huevos', it: 'Uova', tr: 'Yumurta', pt: 'Ovos', nl: 'Eieren', ru: 'Яйца', uk: 'Яйця', zh: '鸡蛋', ja: '卵', ko: '달걀', hi: 'अंडे', pl: 'Jajka' },
  tomato: { de: 'Tomate', en: 'Tomato', ar: 'طماطم', fr: 'Tomate', es: 'Tomate', it: 'Pomodoro', tr: 'Domates', pt: 'Tomate', nl: 'Tomaat', ru: 'Помидор', uk: 'Помідор', zh: '番茄', ja: 'トマト', ko: '토마토', hi: 'टमाटर', pl: 'Pomidor' },
  cheese: { de: 'Käse', en: 'Cheese', ar: 'جبن', fr: 'Fromage', es: 'Queso', it: 'Formaggio', tr: 'Peynir', pt: 'Queijo', nl: 'Kaas', ru: 'Сыр', uk: 'Сир', zh: '奶酪', ja: 'チーズ', ko: '치즈', hi: 'पनीर', pl: 'Ser' },
  pasta: { de: 'Pasta', en: 'Pasta', ar: 'معكرونة', fr: 'Pâtes', es: 'Pasta', it: 'Pasta', tr: 'Makarna', pt: 'Massa', nl: 'Pasta', ru: 'Паста', uk: 'Паста', zh: '意面', ja: 'パスタ', ko: '파스타', hi: 'पास्ता', pl: 'Makaron' },
  rice: { de: 'Reis', en: 'Rice', ar: 'أرز', fr: 'Riz', es: 'Arroz', it: 'Riso', tr: 'Pirinç', pt: 'Arroz', nl: 'Rijst', ru: 'Рис', uk: 'Рис', zh: '米饭', ja: '米', ko: '쌀', hi: 'चावल', pl: 'Ryż' },
  chicken: { de: 'Hähnchen', en: 'Chicken', ar: 'دجاج', fr: 'Poulet', es: 'Pollo', it: 'Pollo', tr: 'Tavuk', pt: 'Frango', nl: 'Kip', ru: 'Курица', uk: 'Курка', zh: '鸡肉', ja: '鶏肉', ko: '닭고기', hi: 'चिकन', pl: 'Kurczak' },
  onion: { de: 'Zwiebel', en: 'Onion', ar: 'بصل', fr: 'Oignon', es: 'Cebolla', it: 'Cipolla', tr: 'Soğan', pt: 'Cebola', nl: 'Ui', ru: 'Лук', uk: 'Цибуля', zh: '洋葱', ja: '玉ねぎ', ko: '양파', hi: 'प्याज', pl: 'Cebula' },
  garlic: { de: 'Knoblauch', en: 'Garlic', ar: 'ثوم', fr: 'Ail', es: 'Ajo', it: 'Aglio', tr: 'Sarımsak', pt: 'Alho', nl: 'Knoflook', ru: 'Чеснок', uk: 'Часник', zh: '大蒜', ja: 'にんにく', ko: '마늘', hi: 'लहसुन', pl: 'Czosnek' },
  spinach: { de: 'Spinat', en: 'Spinach', ar: 'سبانخ', fr: 'Épinards', es: 'Espinacas', it: 'Spinaci', tr: 'Ispanak', pt: 'Espinafre', nl: 'Spinazie', ru: 'Шпинат', uk: 'Шпинат', zh: '菠菜', ja: 'ほうれん草', ko: '시금치', hi: 'पालक', pl: 'Szpinak' },
  potato: { de: 'Kartoffel', en: 'Potato', ar: 'بطاطس', fr: 'Pomme de terre', es: 'Patata', it: 'Patata', tr: 'Patates', pt: 'Batata', nl: 'Aardappel', ru: 'Картофель', uk: 'Картопля', zh: '土豆', ja: 'じゃがいも', ko: '감자', hi: 'आलू', pl: 'Ziemniak' },
};

export function quickIngredientLabel(lang: Language, value: string): string {
  return LABELS[value]?.[lang] ?? LABELS[value]?.en ?? value;
}
