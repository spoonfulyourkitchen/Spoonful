import { Linking } from 'react-native';
import { supabase } from './supabase';
import { setRecoveryPending } from './recovery';

/**
 * Auth deep-link handling for Spoonful.
 *
 * Supabase emails now point to:
 *  - spoonful://auth/callback for sign-in / confirmation
 *  - spoonful://reset for password reset (→ shows the "new password" screen)
 */
export const AUTH_REDIRECT_URL = 'spoonful://auth/callback';
export const RESET_REDIRECT_URL = 'spoonful://reset';

function collectParams(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const fragment = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
  const query = queryIdx >= 0 ? url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined) : '';
  for (const part of [query, fragment]) {
    if (!part) continue;
    try {
      const p = new URLSearchParams(part);
      p.forEach((v, k) => {
        if (!out.has(k)) out.set(k, v);
      });
    } catch {
      /* ignore malformed fragment */
    }
  }
  return out;
}

export async function handleAuthUrl(rawUrl: string): Promise<boolean> {
  try {
    const params = collectParams(rawUrl);
    const error = params.get('error_description') ?? params.get('error');
    if (error) {
      console.warn('[spoonful] auth link error:', error);
      return false;
    }

    const type = params.get('type');
    const isRecovery = /spoonful:\/\/reset/.test(rawUrl) || type === 'recovery';
    const markDone = () => {
      if (isRecovery) setRecoveryPending(true);
    };

    // PKCE-style callback: ?code=…
    const code = params.get('code');
    if (code) {
      const { error: e } = await supabase.auth.exchangeCodeForSession(code);
      if (e) throw e;
      markDone();
      return true;
    }

    // Implicit flow: #access_token=…&refresh_token=…
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error: e } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (e) throw e;
      markDone();
      return true;
    }

    // Fallback: token_hash links (older magic-link / recovery format)
    const tokenHash = params.get('token_hash');
    if (tokenHash && type) {
      const { error: e } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'email' | 'signup' | 'recovery' | 'invite' | 'magiclink',
      });
      if (e) throw e;
      markDone();
      return true;
    }
  } catch (e) {
    console.warn('[spoonful] could not handle auth url', e instanceof Error ? e.message : e);
  }
  return false;
}

/** Start listening for deep links while the app is running + cold start. */
export function initAuthLinkHandling(): () => void {
  let cancelled = false;
  const sub = Linking.addEventListener('url', ({ url }) => {
    if (url) void handleAuthUrl(url);
  });

  Linking.getInitialURL()
    .then((url) => {
      if (!cancelled && url) void handleAuthUrl(url);
    })
    .catch(() => {
      /* noop */
    });

  return () => {
    cancelled = true;
    try {
      sub.remove();
    } catch {
      /* noop */
    }
  };
}
