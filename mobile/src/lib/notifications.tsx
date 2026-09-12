import notifee, { AndroidImportance, TriggerType, RepeatFrequency } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from './i18n';

/**
 * Local notifications (Android). Creates the Spoonful channel, requests the
 * Android 13+ POST_NOTIFICATIONS permission and shows status-style alerts:
 *  - AI Chef finished cooking your recipe
 *  - a recipe was added / saved
 *  - optional daily meal / water reminders (chosen in Settings)
 *  - 2.1.2: admin-only "new sign-in" alerts
 *
 * All copy comes from the i18n dictionary (`notif.*`, `adminAlert.*`), so the
 * reminders arrive in the language the user picked.
 */

/* ── Notification preferences ─────────────────────────────────────────── */

export type NotifPrefs = {
  meal: boolean;
  drink: boolean;
  ai: boolean;
  added: boolean;
};

const PREFS_KEY = 'spoonful:notif-prefs';
const DEFAULT_PREFS: NotifPrefs = { meal: true, drink: true, ai: true, added: true };

export async function loadPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.meal === 'boolean') return { ...DEFAULT_PREFS, ...p };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

export async function savePrefs(prefs: NotifPrefs): Promise<void> {
  try { await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  await applyReminders();
}

/* ── Daily reminders ──────────────────────────────────────────────────── */

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
  } catch { /* best-effort */ }
}

export async function cancelReminders() {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    await notifee.cancelTriggerNotifications(ids);
  } catch { /* ignore */ }
}

/** (Re)applies daily reminders based on the stored preferences. */
export async function applyReminders() {
  const prefs = await loadPrefs();
  await ensureChannel();
  try {
    const ids = await notifee.getTriggerNotificationIds();
    await notifee.cancelTriggerNotifications(ids);
  } catch { /* ignore */ }
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

/** Ask the user for notification permission (no-op if already granted). */
export async function requestNotifications(): Promise<boolean> {
  try {
    await ensureChannel();
    const settings: any = await notifee.requestPermission();
    const status = settings?.authorizationStatus as number | undefined;
    // Android 12 and below always grant at request time; Android 13+ uses the
    // authorizationStatus enum (AUTHORIZED = 2, PROVISIONAL = 3).
    if (status == null) return true;
    return status >= 2;
  } catch {
    return false;
  }
}

/** True when notifications were already allowed. */
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
  } catch { /* notifications are best-effort */ }
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
  try { await AsyncStorage.setItem(COUNT_KEY, String(n)); } catch { /* ignore */ }
}

/** "The AI Chef is done - go see your recipe." */
export async function notifyAiReady(recipeTitle: string) {
  const prefs = await loadPrefs();
  if (!prefs.ai) return;
  await show(translate('notif.aiDoneT'), translate('notif.aiDoneB', { title: recipeTitle }));
}

/** Fired after a recipe was created or saved (includes a running total). */
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

/**
 * 2.1.2: admin only - somebody signed in.
 * The caller passes the already localised text (see admin-login.ts).
 */
export async function showAdminLoginAlert(title: string, body: string) {
  await show(title, body);
}

export default {
  requestNotifications,
  notificationsAllowed,
  notifyAiReady,
  notifyRecipeAdded,
  showAdminLoginAlert,
};
