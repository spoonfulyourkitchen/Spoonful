/**
 * 3.3.0: Vorlesen von Schritten im Kochmodus (Android Text-to-Speech).
 *
 * Das native Modul liefert nur `speak`/`stop`/`available`; alles andere (welcher
 * Text, welche Sprache) entscheidet die App. Fehlt die Sprachausgabe auf dem
 * Gerät (oder läuft die App im Web/Simulator), meldet `speechAvailable()`
 * `false` und der Vorlese-Knopf wird ausgeblendet — es gibt also nie einen
 * Knopf, der nichts tut.
 */
import { NativeModules, Platform } from 'react-native';

type TtsNative = {
  available: () => Promise<boolean>;
  speak: (text: string, lang: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

const native: TtsNative | undefined = (NativeModules as any)?.SpoonfulTts;

/** BCP-47-Tag für die Ausgabe (Fallback Englisch). */
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

/** Liest einen Text vor; ersetzt eine laufende Ausgabe. */
export async function speakText(text: string, appLang: string): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value || Platform.OS !== 'android' || !native?.speak) return false;
  try {
    return await native.speak(value.slice(0, 4000), speechLocale(appLang));
  } catch {
    return false;
  }
}

export async function stopSpeaking(): Promise<void> {
  if (Platform.OS !== 'android' || !native?.stop) return;
  try {
    await native.stop();
  } catch {
    /* nichts zu stoppen */
  }
}
