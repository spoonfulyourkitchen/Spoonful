import notifee, { AndroidImportance, TriggerType, RepeatFrequency } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from './i18n';

export type NotifPrefs = {
  meal: boolean;
  drink: boolean;
  ai: boolean;
  added: boolean;
  
  admin: boolean;
};

const PREFS_KEY = 'spoonful:notif-prefs';
const DEFAULT_PREFS: NotifPrefs = { meal: true, drink: true, ai: true, added: true, admin: true };

export async function loadPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.meal === 'boolean') return { ...DEFAULT_PREFS, ...p };
    }
  } catch {  }
  return { ...DEFAULT_PREFS };
}

export async function savePrefs(prefs: NotifPrefs): Promise<void> {
  try { await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {  }
  await applyReminders();
}

const MEAL_TIMES = [
  { h: 13, m: 0, tk: 'notif.lunchTitle', bk: 'notif.lunchBody' },
  { h: 19, m: 0, tk: 'notif.dinnerTitle', bk: 'notif.dinnerBody' },
];
const DRINK_TIMES = [
  { h: 10, m: 0, tk: 'notif.water1T', bk: 'notif.water1B' },
  { h: 14, m: 0, tk: 'notif.water2T', bk: 'notif.water2B' },
  { h: 17, m: 30, tk: 'notif.water3T', bk: 'notif.water3B' },
];

async function scheduleOnce(title: string, body: string, hour: number, minute: number) {
  try {
    await ensureChannel();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    await notifee.createTriggerNotification(
      { title, body, android: { channelId: 'spoonful', pressAction: { id: 'default' }, smallIcon: 'ic_launcher' } },
      { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY },
    );
  } catch {  }
}

export async function cancelReminders() {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    await notifee.cancelTriggerNotifications(ids);
  } catch {  }
}

export async function applyReminders() {
  const prefs = await loadPrefs();
  await ensureChannel();
  try {
    const ids = await notifee.getTriggerNotificationIds();
    await notifee.cancelTriggerNotifications(ids);
  } catch {  }
  if (prefs.meal) for (const m of MEAL_TIMES) await scheduleOnce(translate(m.tk), translate(m.bk), m.h, m.m);
  if (prefs.drink) for (const d of DRINK_TIMES) await scheduleOnce(translate(d.tk), translate(d.bk), d.h, d.m);
}

let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (!channelReady) {
    channelReady = notifee.createChannel({
      id: 'spoonful',
      name: 'Spoonful',
      importance: AndroidImportance.HIGH,
      vibration: true,
    }).then(() => undefined).catch(() => undefined);
  }
  return channelReady;
}

export async function requestNotifications(): Promise<boolean> {
  try {
    await ensureChannel();
    const settings: any = await notifee.requestPermission();
    const status = settings?.authorizationStatus as number | undefined;
    if (status == null) return true;
    return status >= 2;
  } catch {
    return false;
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  try {
    const settings: any = await notifee.getNotificationSettings();
    const status = settings?.authorizationStatus as number | undefined;
    if (status == null) return true;
    return status >= 2;
  } catch {
    return false;
  }
}

async function show(title: string, body: string) {
  try {
    await ensureChannel();
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'spoonful',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
      },
    });
  } catch {  }
}

const COUNT_KEY = 'spoonful:added-count';

async function recipeCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(COUNT_KEY);
    const n = Number(raw ?? '0');
    return Number.isFinite(n) ? n + 1 : 1;
  } catch {
    return 1;
  }
}

async function persistCount(n: number) {
  try { await AsyncStorage.setItem(COUNT_KEY, String(n)); } catch {  }
}

export async function notifyAiReady(recipeTitle: string) {
  const prefs = await loadPrefs();
  if (!prefs.ai) return;
  await show(translate('notif.aiDoneT'), translate('notif.aiDoneB', { title: recipeTitle }));
}

export async function notifyRecipeAdded(recipeTitle?: string) {
  const prefs = await loadPrefs();
  if (!prefs.added) return;
  const n = await recipeCount();
  await persistCount(n);
  const name = recipeTitle?.trim() ? `"${recipeTitle.trim()}"` : translate('common.add');
  const title = n === 1 ? translate('notif.firstRecipeT') : translate('notif.moreRecipesT', { n });
  const body = n === 1 ? translate('notif.firstRecipeB', { name }) : translate('notif.moreRecipesB', { name, n });
  await show(title, body);
}

export async function showAdminLoginAlert(title: string, body: string) {
  await show(title, body);
}

export async function notifyAdminAlert(title: string, body: string) {
  const prefs = await loadPrefs();
  if (!prefs.admin) return;
  await show(title, body);
}

export default {
  requestNotifications,
  notificationsAllowed,
  notifyAiReady,
  notifyRecipeAdded,
  notifyAdminAlert,
  showAdminLoginAlert,
};
