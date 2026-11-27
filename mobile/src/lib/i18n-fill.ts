import { FILL_A } from './i18n-fill-a';
import { FILL_B } from './i18n-fill-b';
import { FILL_C } from './i18n-fill-c';
import { FILL_D } from './i18n-fill-d';
import { FILL_E } from './i18n-fill-e';
import { FILL_F } from './i18n-fill-f';
import { FILL_G } from './i18n-fill-g';
import { FILL_H } from './i18n-fill-h';

/**
 * Nachzügler-Übersetzungen für Texte, die in neueren Modulen nur auf Englisch
 * (und teils nur in 10 Sprachen) gepflegt wurden. Schlüssel sind flach
 * ("namespace.key") und werden beim Mergen in die i18n-Struktur einsortiert.
 */
export const I18N_FILL: Record<string, Record<string, string>> = {
  ...FILL_A,
  ...FILL_B,
  ...FILL_C,
  ...FILL_D,
  ...FILL_E,
  ...FILL_F,
  ...FILL_G,
  ...FILL_H,
};
