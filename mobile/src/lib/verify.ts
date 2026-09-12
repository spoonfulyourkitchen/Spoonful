import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Email confirmation handling.
 *
 * Concept (2.0.0):
 *  - While the confirmation email cannot be sent, the account stays usable
 *    ("grace mode") and the app only shows a gentle banner.
 *  - As soon as the email really went out, the app locks until the address is
 *    confirmed.
 *  - With `MAILER_AUTOCONFIRM=true` in Supabase (the current setting while the
 *    SMTP sender is being fixed) the user object is confirmed right away, so
 *    nothing is ever locked.
 */

const KEY = 'spoonful:verify';

export type VerifyState = {
  email: string;
  createdAt: number;
  /** Set once a confirmation email was really delivered. */
  sentAt: number | null;
};

export async function loadVerifyState(): Promise<VerifyState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== 'string') return null;
    return { email: parsed.email, createdAt: Number(parsed.createdAt) || Date.now(), sentAt: parsed.sentAt ?? null };
  } catch {
    return null;
  }
}

async function persist(state: VerifyState | null) {
  try {
    if (state) await AsyncStorage.setItem(KEY, JSON.stringify(state));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}

/** Called after a sign-up: remember that this address still has to confirm. */
export async function markVerifyPending(email: string): Promise<VerifyState> {
  const state: VerifyState = { email, createdAt: Date.now(), sentAt: null };
  await persist(state);
  return state;
}

/** Called when the confirmation mail was delivered - from now on we lock. */
export async function markEmailDelivered(): Promise<void> {
  const state = await loadVerifyState();
  if (!state) return;
  await persist({ ...state, sentAt: Date.now() });
}

export async function clearVerifyState(): Promise<void> {
  await persist(null);
}

/** True when the signed-in user still has to confirm their email address. */
export function needsConfirmation(user: any): boolean {
  if (!user) return false;
  return !user.email_confirmed_at && !user.confirmed_at;
}

export type SendResult = { ok: boolean; reason: 'sent' | 'mail_failed' | 'throttled' | 'error'; message?: string };

/** Sends (or re-sends) the Supabase confirmation email. */
export async function sendConfirmationEmail(email: string): Promise<SendResult> {
  if (!email) return { ok: false, reason: 'error', message: 'Missing email address.' };
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email } as any);
    if (!error) {
      await markEmailDelivered();
      return { ok: true, reason: 'sent' };
    }
    const msg = String(error.message ?? '');
    if (/sending confirmation email|error sending/i.test(msg)) {
      return { ok: false, reason: 'mail_failed', message: msg };
    }
    if (/rate|too many|seconds/i.test(msg)) {
      return { ok: false, reason: 'throttled', message: msg };
    }
    return { ok: false, reason: 'error', message: msg };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'unknown error' };
  }
}

/** Re-reads the session so a confirmation done in the mail app shows up. */
export async function refreshConfirmation(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.refreshSession();
    const user: any = data?.session?.user ?? data?.user;
    return !!user && !needsConfirmation(user);
  } catch {
    return false;
  }
}
