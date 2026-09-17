/**
 * 3.3.0: `Alert` — aber gestaltet.
 *
 * Die App benutzte bisher `Alert.alert(...)` aus React Native. Diese Dialoge
 * sehen auf jedem Gerät anders aus, übernehmen keine Theme-Farben und passen
 * nicht zur App („zackig"). Dieser Wrapper hat dieselbe Aufrufform, zeigt die
 * Meldung aber als themefarbene Karte in der App (`components/AppNotice`).
 *
 * Verwendung bleibt unverändert:
 *   import { Alert } from '../lib/alert';
 *   Alert.alert(title, message, [{ text, onPress, style }]);
 */
import { showNotice, type NoticeAction } from '../components/AppNotice';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

const ERROR_HINT = /(error|fail|fehl|problem|konnte|could not|cannot|invalid|ung[üu]ltig|not found|nicht gefunden|offline|denied|abgelehnt)/i;

function toNotice(title: string, message?: string, buttons?: AlertButton[]) {
  const actions: NoticeAction[] = (buttons?.length ? buttons : [{ text: undefined }]).map((b) => ({
    label: b.text ?? 'OK',
    variant: b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'ghost' : 'dark',
    onPress: b.onPress,
  }));
  const text = `${title ?? ''} ${message ?? ''}`;
  showNotice({
    title: String(title ?? ''),
    body: message ? String(message) : undefined,
    actions,
    tone: ERROR_HINT.test(text) ? 'error' : 'info',
  });
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], _options?: unknown) {
    toNotice(title, message, buttons);
  },
  /* Nicht benutzt, aber vorhanden, damit ein Aufruf nicht abstürzt. */
  prompt(title: string, message?: string, buttons?: AlertButton[]) {
    toNotice(title, message, buttons);
  },
};

export default Alert;
