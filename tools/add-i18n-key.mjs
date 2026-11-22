

import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.argv[2] ?? 'xReadyToServe';
const WRITE = process.argv.includes('--write');

const TABLES = {
  xReadyToServe: {
    de: '{title} ist servierfertig.',
    en: '{title} is ready to serve.',
    ar: '{title} جاهز للتقديم.',
    fr: '{title} est pret a servir.',
    es: '{title} esta listo para servir.',
    it: '{title} e pronto da servire.',
    tr: '{title} servise hazir.',
    pt: '{title} esta pronto a servir.',
    nl: '{title} is klaar om te serveren.',
    ru: '{title} готово к подаче.',
  },
  xValidUntil: {
    de: 'gültig bis {date}',
    en: 'valid until {date}',
    ar: 'ساري حتى {date}',
    fr: 'valable jusqu au {date}',
    es: 'valido hasta {date}',
    it: 'valido fino al {date}',
    tr: '{date} tarihine kadar gecerli',
    pt: 'valido ate {date}',
    nl: 'geldig tot {date}',
    ru: 'действует до {date}',
  },
  
  aiQuotaA11y: {
    de: '{n} von {limit} KI-Nutzungen heute übrig',
    en: '{n} of {limit} AI requests left today',
    ar: 'بقي {n} من {limit} استخدامات للذكاء الاصطناعي اليوم',
    fr: '{n} sur {limit} requetes IA restantes aujourd hui',
    es: '{n} de {limit} usos de IA restantes hoy',
    it: '{n} di {limit} usi IA rimasti oggi',
    tr: 'Bugun {limit} yapay zeka kullanimindan {n} kaldi',
    pt: '{n} de {limit} usos de IA restantes hoje',
    nl: '{n} van {limit} AI-gebruiken vandaag over',
    ru: 'Осталось {n} из {limit} запросов к ИИ на сегодня',
  },
  
  statRecipesLive: {
    de: '{n}+ Rezepte',
    en: '{n}+ recipes',
    ar: 'أكثر من {n} وصفة',
    fr: '{n}+ recettes',
    es: '{n}+ recetas',
    it: '{n}+ ricette',
    tr: '{n}+ tarif',
    pt: '{n}+ receitas',
    nl: '{n}+ recepten',
    ru: 'Более {n} рецептов',
  },
  statLangsLive: {
    de: '{n} Sprachen',
    en: '{n} languages',
    ar: '{n} لغات',
    fr: '{n} langues',
    es: '{n} idiomas',
    it: '{n} lingue',
    tr: '{n} dil',
    pt: '{n} idiomas',
    nl: '{n} talen',
    ru: '{n} языков',
  },
  
  chefSwipe: {
    de: ['← Wischen: beschreiben · nochmal wischen: Video-Link', '← Weiter zum Video-Link · → zurück zu den Zutaten', '→ zurück zur Beschreibung'],
    en: ['← Swipe to describe · swipe again for a video link', '← Continue to the video link · → back to ingredients', '→ back to describing'],
    ar: ['← اسحب للوصف · اسحب مرة أخرى لرابط الفيديو', '← تابع إلى رابط الفيديو · → رجوع إلى المكونات', '→ رجوع إلى الوصف'],
    fr: ['← Glisse pour decrire · encore une fois pour un lien video', '← Continuer vers le lien video · → retour aux ingredients', '→ retour a la description'],
    es: ['← Desliza para describir · otra vez para un enlace de video', '← Seguir al enlace de video · → volver a ingredientes', '→ volver a describir'],
    it: ['← Scorri per descrivere · ancora per un link video', '← Continua al link video · → torna agli ingredienti', '→ torna alla descrizione'],
    tr: ['← Tarif icin kaydir · tekrar kaydir: video linki', '← Video linkine gec · → malzemelere don', '→ aciklamaya don'],
    pt: ['← Desliza para descrever · outra vez para um link de video', '← Seguir para o link de video · → voltar aos ingredientes', '→ voltar a descrever'],
    nl: ['← Veeg om te beschrijven · nog eens voor een videolink', '← Door naar de videolink · → terug naar ingredienten', '→ terug naar beschrijven'],
    ru: ['← Свайп: описать · ещё раз: ссылка на видео', '← Дальше к видео · → назад к ингредиентам', '→ назад к описанию'],
  },
};

const VALUES = TABLES[KEY];

const url = new URL('../mobile/src/lib/i18n-texts-extra.ts', import.meta.url);
const lines = readFileSync(url, 'utf8').split(/\r?\n/);
let changed = 0;

const out = lines.map((line) => {
  const match = /^(\s*)([a-z]{2}): \{ s: \{/.exec(line);
  if (!match || !line.trimEnd().endsWith('} },')) return line;
  const lang = match[2];
  const value = VALUES[lang];
  if (!value || line.includes(`${KEY}1:`)) return line;
  
  const entries = (Array.isArray(value) ? value : [value])
    .map((text, index) => `${KEY}${Array.isArray(value) ? index + 1 : ''}: '${text}'`)
    .join(', ');
  changed += 1;
  return `${line.trimEnd().slice(0, -4)}, ${entries} } },`;
});

if (WRITE) writeFileSync(url, out.join('\n'), 'utf8');
console.log(`${changed} Sprachen ${WRITE ? 'aktualisiert' : 'gefunden'} für ${KEY}`);
