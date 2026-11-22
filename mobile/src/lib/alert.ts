

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
  
  prompt(title: string, message?: string, buttons?: AlertButton[]) {
    toNotice(title, message, buttons);
  },
};

export default Alert;
