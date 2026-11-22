import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useQuery } from './convex-auth';
import { api } from './api';
import { notifyAdminAlert } from './notifications';
import { translate } from './i18n';
import { APP_VERSION } from '../config';

export type LoginEvent = {
  id: number;
  userId: string;
  name: string;
  email: string;
  device: string;
  platform: string;
  appVersion: string;
  at: number;
  seen: boolean;
};

const DEVICE_LABEL_KEY = 'spoonful:admin-login-device';

function deviceLabel(): string {
  try {
    const os = String(Platform.Version ?? '');
    const label = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${os}`.trim();
    try {
      void (require('@react-native-async-storage/async-storage') as any)
        .default?.setItem?.(DEVICE_LABEL_KEY, label);
    } catch {}
    return label;
  } catch {
    return Platform.OS ?? 'device';
  }
}

export async function logLoginEvent(): Promise<void> {
  try {
    await supabase.rpc('log_login_event' as any, {
      p_device: deviceLabel(),
      p_platform: Platform.OS,
      p_app_version: APP_VERSION,
    } as any);
  } catch {}
}

export async function fetchLoginEvents(limit = 30): Promise<LoginEvent[]> {
  try {
    const { data, error } = await supabase.rpc('admin_login_events' as any, { p_limit: limit } as any);
    if (error) return [];
    const rows = Array.isArray(data) ? data : (data as any)?.admin_login_events ?? [];
    return rows.map((r: any) => ({
      id: Number(r.id ?? 0),
      userId: String(r.user_id ?? ''),
      name: String(r.name ?? r.email ?? 'user'),
      email: String(r.email ?? ''),
      device: String(r.device ?? ''),
      platform: String(r.platform ?? ''),
      appVersion: String(r.app_version ?? ''),
      at: Number(new Date(r.logged_at ?? 0).getTime()) || 0,
      seen: !!r.seen,
    }));
  } catch {
    return [];
  }
}

export async function markLoginEventsSeen(): Promise<void> {
  try {
    await supabase.rpc('admin_mark_login_events_seen' as any, {} as any);
  } catch {}
}

export type AdminFeed = {
  events: LoginEvent[];
  unread: number;
  
  loaded: boolean;
};

const KNOWN_USERS_KEY = 'spoonful:admin-known-users';
const LAST_ID_KEY = 'spoonful:admin-last-login-id';

const POLL_MS = 30000;

const MAX_ALERTS = 3;

let feed: AdminFeed = { events: [], unread: 0, loaded: false };
const feedListeners = new Set<() => void>();

let selfId: string | null = null;

function emitFeed() {
  for (const l of feedListeners) l();
}

export function getAdminFeed(): AdminFeed {
  return feed;
}

export function subscribeAdminFeed(cb: () => void): () => void {
  feedListeners.add(cb);
  return () => {
    feedListeners.delete(cb);
  };
}

export function setAdminAlertsSelfId(id: string | null): void {
  selfId = id;
}

async function readKnownUsers(): Promise<Set<string> | null> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_USERS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return new Set(arr.map(String));
  } catch {
    return null;
  }
}

async function writeKnownUsers(users: Set<string>): Promise<void> {
  try {
    
    await AsyncStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(Array.from(users).slice(-500)));
  } catch {  }
}

async function readLastId(): Promise<number> {
  try {
    const n = Number((await AsyncStorage.getItem(LAST_ID_KEY)) ?? '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function writeLastId(id: number): Promise<void> {
  try { await AsyncStorage.setItem(LAST_ID_KEY, String(id)); } catch {  }
}

let announcing = false;

async function announceFresh(rows: LoginEvent[]): Promise<void> {
  if (announcing) return;
  announcing = true;
  try {
    const newest = rows.reduce((max, r) => Math.max(max, r.id), 0);
    const known = await readKnownUsers();
    const lastId = await readLastId();

    if (known === null) {
      await writeKnownUsers(new Set(rows.map((r) => r.userId).filter(Boolean)));
      await writeLastId(newest);
      return;
    }

    const fresh = rows
      .filter((r) => r.id > lastId && r.userId && r.userId !== selfId)
      .sort((a, b) => a.id - b.id);
    if (fresh.length) {
      for (const f of fresh.slice(-MAX_ALERTS)) {
        const isNew = !known.has(f.userId);
        known.add(f.userId);
        if (isNew) {
          await notifyAdminAlert(
            translate('adminAlert.newUserTitle'),
            translate('adminAlert.newUserBody', { name: f.name || f.email || '-', device: f.device || '-' }),
          );
        } else {
          const time = new Date(f.at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await notifyAdminAlert(
            translate('adminAlert.loginTitle'),
            translate('adminAlert.loginBody', { name: f.name || f.email || '-', device: f.device || '-', time }),
          );
        }
      }
      await writeKnownUsers(known);
    }
    if (newest > lastId) await writeLastId(newest);
  } finally {
    announcing = false;
  }
}

export async function refreshAdminFeed(): Promise<void> {
  const rows = await fetchLoginEvents();
  feed = { events: rows, unread: rows.filter((r) => !r.seen).length, loaded: true };
  emitFeed();
  await announceFresh(rows);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let watchers = 0;
let appActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

export function startAdminWatch(): () => void {
  watchers += 1;
  if (!pollTimer) {
    void refreshAdminFeed();
    pollTimer = setInterval(() => {
      if (appActive) void refreshAdminFeed();
    }, POLL_MS);
    appStateSub = AppState.addEventListener('change', (next) => {
      appActive = next === 'active';
      if (appActive) void refreshAdminFeed();
    });
  }
  return () => {
    watchers -= 1;
    if (watchers > 0) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    appStateSub?.remove();
    appStateSub = null;
    watchers = 0;
  };
}

export function useAdminLoginAlerts(): {
  events: LoginEvent[];
  unread: number;
  loaded: boolean;
  reload: () => Promise<void>;
  markSeen: () => Promise<void>;
  isAdmin: boolean;
} {
  const isAdminQuery = useQuery(api.admin.isAdmin) as boolean | undefined;
  const isAdmin = isAdminQuery === true;
  const state = useSyncExternalStore(subscribeAdminFeed, getAdminFeed, getAdminFeed);

  useEffect(() => {
    if (!isAdmin) return;
    return startAdminWatch();
  }, [isAdmin]);

  const reload = useCallback(async () => {
    await refreshAdminFeed();
  }, []);

  const markSeen = useCallback(async () => {
    feed = { ...feed, unread: 0, events: feed.events.map((e) => ({ ...e, seen: true })) };
    emitFeed();
    await markLoginEventsSeen();
  }, []);

  return { events: state.events, unread: state.unread, loaded: state.loaded, reload, markSeen, isAdmin };
}
