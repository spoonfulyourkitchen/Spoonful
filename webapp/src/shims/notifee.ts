/**
 * notifee on the web. Local notifications are shown through the browser's
 * Notification API; scheduled reminders are timers that live as long as the
 * page is open (browsers cannot schedule OS notifications like Android).
 */
export const AndroidImportance = { NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4 };
export const TriggerType = { TIMESTAMP: 0, INTERVAL: 1 };
export const RepeatFrequency = { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 };

type NotificationSpec = { id?: string; title?: string; body?: string; data?: Record<string, any> };

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();
const ids = new Set<string>();

function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function display(spec: NotificationSpec) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    const base = String((import.meta as any).env?.BASE_URL || '/');
    new Notification(spec.title ?? 'Spoonful', {
      body: spec.body ?? '',
      icon: `${base}icon.png`,
      tag: spec.id,
    });
  } catch {
    // Ignore: some browsers block constructor notifications in unsupported contexts.
  }
}

const notifee = {
  async createChannel() {
    return 'spoonful';
  },
  async requestPermission() {
    if (!canNotify()) return { authorizationStatus: 0 };
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    return { authorizationStatus: permission === 'granted' ? 1 : 0 };
  },
  async getNotificationSettings() {
    if (!canNotify()) return { authorizationStatus: 0 };
    return { authorizationStatus: Notification.permission === 'granted' ? 1 : 0 };
  },
  async displayNotification(spec: NotificationSpec) {
    await display(spec);
  },
  async createTriggerNotification(spec: NotificationSpec, trigger: { timestamp?: number }) {
    const id = spec.id || `trigger-${Math.random().toString(36).slice(2, 10)}`;
    const delay = Math.max(0, Number(trigger?.timestamp ?? Date.now()) - Date.now());
    const timer = setTimeout(() => {
      scheduled.delete(id);
      ids.delete(id);
      void display({ ...spec, id });
    }, Math.min(delay, 2 ** 31 - 1));
    scheduled.set(id, timer);
    ids.add(id);
    return id;
  },
  async getTriggerNotificationIds() {
    return Array.from(ids);
  },
  async cancelTriggerNotifications(list?: string[]) {
    const targets = list?.length ? list : Array.from(ids);
    targets.forEach((id) => {
      const timer = scheduled.get(id);
      if (timer) clearTimeout(timer);
      scheduled.delete(id);
      ids.delete(id);
    });
  },
  async cancelNotification(id: string) {
    const timer = scheduled.get(id);
    if (timer) clearTimeout(timer);
    scheduled.delete(id);
    ids.delete(id);
  },
  async cancelAllNotifications() {
    await notifee.cancelTriggerNotifications();
  },
  onForegroundEvent() {
    return () => undefined;
  },
  onBackgroundEvent() {
    return () => undefined;
  },
};

export default notifee;
