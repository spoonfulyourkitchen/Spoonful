/**
 * 3.1.0: App-Einstellungen, die den Kochmodus betreffen.
 *
 * `cookingAdvanced` schaltet den ausgebauten Kochmodus an/aus:
 *   an  = alle 3.0.0-Funktionen (Schritt-Titel, Badges, Teilschritte, Notizen,
 *         Fotos, Zweitgericht, Haushalt, "Wo war ich?")
 *   aus = klassischer Kochmodus wie vor 3.0.0 (Coach-Tipps bleiben).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ADVANCED_KEY = 'spoonful:cooking-advanced';

let advanced = true;
let hydrated = false;
const listeners = new Set<(v: boolean) => void>();

function emit() {
  for (const l of listeners) l(advanced);
}

export function getCookingAdvanced(): boolean {
  return advanced;
}

export async function hydrateCookingAdvanced(): Promise<boolean> {
  if (hydrated) return advanced;
  try {
    const raw = await AsyncStorage.getItem(ADVANCED_KEY);
    if (raw === '0' || raw === 'false') advanced = false;
    if (raw === '1' || raw === 'true') advanced = true;
  } catch {
    /* Standard bleibt an */
  }
  hydrated = true;
  emit();
  return advanced;
}

export async function setCookingAdvanced(next: boolean): Promise<void> {
  advanced = next;
  hydrated = true;
  emit();
  try {
    await AsyncStorage.setItem(ADVANCED_KEY, next ? '1' : '0');
  } catch {
    /* egal, gilt trotzdem für die Sitzung */
  }
}

/** Reagiert auf Änderungen (Einstellungen ⇄ Kochmodus). */
export function useCookingAdvanced(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(advanced);
  useEffect(() => {
    const listener = (v: boolean) => setValue(v);
    listeners.add(listener);
    void hydrateCookingAdvanced();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, (v: boolean) => void setCookingAdvanced(v)];
}
