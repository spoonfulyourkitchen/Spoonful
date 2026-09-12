import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { useQuery } from './convex-auth';
import { api } from './api';
import { showAdminLoginAlert } from './notifications';
import { APP_VERSION } from '../config';

/**
 * Admin login notifications (2.1.2).
 *
 * Flow
 * 1. after every sign-in the app calls `log_login_event` → one row in
 *    `public.login_events` (name, email, device, platform, app version, time),
 * 2. admins only: the RPC `admin_login_events` returns the recent logins, and
 *    *only* admins get a row back (the SQL checks `is_admin()`),
 * 3. the admin device shows a local notification + an in-app list.
 *
 * Nothing is visible for normal users: the SQL function returns an empty set
 * for them and the hook additionally checks the admin role before doing
 * anything.
 */

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

/** Short human readable device label, e.g. "Android 14". */
function deviceLabel(): string {
  try {
    const os = String(Platform.Version ?? '');
    const label = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${os}`.trim();
    try {
      // keep the last label around so the admin list is readable offline
      void (require('@react-native-async-storage/async-storage') as any)
        .default?.setItem?.(DEVICE_LABEL_KEY, label);
    } catch {
      /* ignore */
    }
    return label;
  } catch {
    return Platform.OS ?? 'device';
  }
}

/**
 * Writes one login row for the signed-in user. Called once per app start after
 * the session is ready; failures are silent (the user must never see an error
 * because an admin feature could not be logged).
 */
export async function logLoginEvent(): Promise<void> {
  try {
    await supabase.rpc('log_login_event' as any, {
      p_device: deviceLabel(),
      p_platform: Platform.OS,
      p_app_version: APP_VERSION,
    } as any);
  } catch {
    /* best effort */
  }
}

/** Recent logins - empty for everyone except admins. */
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
  } catch {
    /* best effort */
  }
}

/**
 * Hook for the AdminScreen: the list of logins, a "new" counter and - for
 * admins only - a local notification for every new sign-in.
 */
export function useAdminLoginAlerts(opts: { title: (name: string, device: string) => string; body: (name: string, device: string) => string }):
  { events: LoginEvent[]; unread: number; reload: () => Promise<void>; markSeen: () => Promise<void>; isAdmin: boolean } {
  // Role check first: nothing is fetched (and nothing pops up) for normal users.
  const isAdminQuery = useQuery(api.admin.isAdmin) as boolean | undefined;
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const lastIdRef = useRef(0);
  const textRef = useRef(opts);
  textRef.current = opts;

  const reload = useCallback(async () => {
    const rows = await fetchLoginEvents();
    setEvents(rows);
    setUnread(rows.filter((r) => !r.seen).length);
    const newest = rows.reduce((max, r) => Math.max(max, r.id), 0);
    // Notify only about logins that arrived after this device started watching.
    if (lastIdRef.current && newest > lastIdRef.current) {
      const fresh = rows.filter((r) => r.id > lastIdRef.current).slice(0, 3);
      for (const f of fresh) {
        void showAdminLoginAlert(textRef.current.title(f.name, f.device), textRef.current.body(f.name, f.device));
      }
    }
    if (newest > lastIdRef.current) lastIdRef.current = newest;
  }, []);

  useEffect(() => {
    if (isAdminQuery !== true) return;
    void reload();
    const timer = setInterval(() => void reload(), 45000);
    return () => clearInterval(timer);
  }, [isAdminQuery, reload]);

  const markSeen = useCallback(async () => {
    setUnread(0);
    setEvents((prev) => prev.map((e) => ({ ...e, seen: true })));
    await markLoginEventsSeen();
  }, []);

  return { events, unread, reload, markSeen, isAdmin: isAdminQuery === true };
}
