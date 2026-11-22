

import { NativeModules, Platform } from 'react-native';

type TtsNative = {
  available: () => Promise<boolean>;
  speak: (text: string, lang: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

const native: TtsNative | undefined = (NativeModules as any)?.SpoonfulTts;

const SCRIPT_HINTS: [RegExp, string][] = [
  [/[\u0600-\u06FF\u0750-\u077F]/, 'ar'],
  [/[\u0400-\u04FF]/, 'ru'],
  [/[\u4E00-\u9FFF]/, 'zh'],
  [/[\u3040-\u30FF]/, 'ja'],
  [/[\uAC00-\uD7AF]/, 'ko'],
  [/[\u0E00-\u0E7F]/, 'th'],
  [/[\u0370-\u03FF]/, 'el'],
];

const WORD_HINTS: [string, RegExp][] = [
  ['de', /\b(und|der|die|das|mit|den|dem|nicht|etwas|dann|bis|oder|zum|zur|anschließend|ca)\b/gi],
  ['en', /\b(the|and|with|until|then|add|heat|stir|minutes|step|look|for|coach|tip|golden|tender)\b/gi],
  ['fr', /\b(et|les|des|avec|jusqu|puis|ajoutez|chauffez|minutes)\b/gi],
  ['es', /\b(y|los|las|con|hasta|luego|añade|calienta|minutos)\b/gi],
  ['it', /\b(e|il|lo|la|con|fino|poi|aggiungi|scalda|minuti)\b/gi],
  ['tr', /\b(ve|ile|için|kadar|sonra|ekle|kaynat)\b/gi],
  ['pt', /\b(e|os|as|com|até|depois|adicione|aqueça|minutos)\b/gi],
  ['nl', /\b(en|het|de|met|tot|daarna|voeg|verwarm|minuten)\b/gi],
];

export function detectTextLanguage(text: string): string {
  const value = String(text ?? '');
  if (!value.trim()) return '';
  for (const [re, code] of SCRIPT_HINTS) {
    if (re.test(value)) return code;
  }
  let best = '';
  let bestScore = 0;
  for (const [code, re] of WORD_HINTS) {
    const hits = value.match(re)?.length ?? 0;
    if (hits > bestScore) {
      bestScore = hits;
      best = code;
    }
  }
  return bestScore >= 2 ? best : '';
}

export function speechLocale(appLang: string): string {
  const map: Record<string, string> = {
    de: 'de-DE',
    en: 'en-US',
    ar: 'ar-SA',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
    tr: 'tr-TR',
    pt: 'pt-PT',
    nl: 'nl-NL',
    ru: 'ru-RU',
  };
  return map[appLang] ?? 'en-US';
}

export async function speechAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native?.available) return false;
  try {
    return await native.available();
  } catch {
    return false;
  }
}

export async function speakText(text: string, appLang: string): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value || Platform.OS !== 'android' || !native?.speak) return false;
  const detected = detectTextLanguage(value);
  const locale = speechLocale(detected || appLang);
  try {
    return await native.speak(value.slice(0, 4000), locale);
  } catch {
    return false;
  }
}

export async function stopSpeaking(): Promise<void> {
  if (Platform.OS !== 'android' || !native?.stop) return;
  try {
    await native.stop();
  } catch {}
}
