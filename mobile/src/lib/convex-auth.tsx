import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, requireUserId, toError, type Session, type User } from './supabase';
import { api, runOp, isRef, type FnRef } from './api';
import { AUTH_REDIRECT_URL, RESET_REDIRECT_URL, initAuthLinkHandling } from './auth-link';

/**
 * Supabase-backed replacement for the old `convex-auth` module.
 *
 * The rest of the app keeps importing the same names as before
 * (`ConvexAuthProvider`, `useQuery`, `useMutation`, `useAction`,
 * `useAuthActions`, `convexClient`, …) so screens did not need rewrites.
 */

export { supabase, api };

/** Kept for backwards compatibility with old imports. */
export const authStorage = AsyncStorage;

/* ─── Auth context ──────────────────────────────────────────────────────── */

type AuthValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  refresh: () => void;
};

const AuthContext = createContext<AuthValue>({ session: null, user: null, isLoading: true, refresh: () => {} });

/** Minimal refresh signal used by useQuery so lists re-sync after mutations. */
let tick = 0;
const tickSubs = new Set<() => void>();
function bumpTick() {
  tick += 1;
  tickSubs.forEach((fn) => fn());
}
function subscribeTick(fn: () => void) {
  tickSubs.add(fn);
  return () => {
    tickSubs.delete(fn);
  };
}
const getTick = () => tick;

export function refreshAllQueries() {
  bumpTick();
}

/**
 * Auth provider that wraps the whole app (drop-in for ConvexAuthProvider).
 * Exposes the session through context and re-renders on auth changes.
 */
export function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const unlink = initAuthLinkHandling();
    try {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!alive) return;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        })
        .catch(() => {
          if (alive) setIsLoading(false);
        });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        if (!alive) return;
        setSession(next);
        setUser(next?.user ?? null);
        setIsLoading(false);
        bumpTick(); // signed in/out → all queries re-run against the right user
      });
      return () => {
        alive = false;
        unlink();
        try {
          sub.subscription.unsubscribe();
        } catch {
          /* noop */
        }
      };
    } catch (e) {
      console.warn('[spoonful] auth init failed', e instanceof Error ? e.message : e);
      if (alive) {
        alive = false;
        setIsLoading(false);
      }
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, user, isLoading, refresh: bumpTick }),
    [session, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Convex-compatible auth hook: { isAuthenticated, isLoading }. */
export function useConvexAuth() {
  const { session, isLoading } = useAuth();
  return { isAuthenticated: !!session, isLoading };
}

/* ─── Query / mutation / action hooks (Convex-compatible) ──────────────── */

function cacheKey(ref: any, args: any, uid: string | null): string {
  const key = ref?.key ?? (typeof ref === 'string' ? ref : '');
  let argPart = '';
  try {
    argPart = JSON.stringify(args ?? {});
  } catch {
    argPart = String(args ?? '');
  }
  return `${key}|${argPart}|${uid ?? 'anon'}`;
}

/**
 * useQuery(ref, args?) → returns the query result or `undefined` while it is
 * loading. It refetches on mount, on user/session change, on every refresh
 * tick (after a mutation, sign in/out or app foreground) — matching the
 * reactive behaviour the screens expect from Convex.
 */
export function useQuery(ref: any, args?: any): any {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [value, setValue] = useState<any>(undefined);
  const refreshTick = useSyncExternalStore(subscribeTick, getTick, getTick);
  const inFlight = useRef(false);
  const disposed = useRef(false);
  const key = cacheKey(ref, args, uid);

  useEffect(() => {
    disposed.current = false;
    if (!uid || !ref) {
      setValue(undefined);
      return;
    }
    let retryTimer: any = null;
    let attempt = 0;
    const load = async () => {
      if (inFlight.current || disposed.current) return;
      inFlight.current = true;
      try {
        const result = await runOp(ref, 'query', uid, args);
        if (!disposed.current) setValue(result);
        attempt = 0;
      } catch (e) {
        // Keep the screen usable: Convex used to throw into an error
        // boundary here, but the offline cache + empty states handle this
        // more gracefully for the user.
        console.warn('[spoonful] query failed', key, e instanceof Error ? e.message : e);
        // A short network hiccup (cold start, wifi handover) should heal on its
        // own instead of leaving the screen empty until the next app event.
        if (!disposed.current && attempt < 3) {
          attempt += 1;
          retryTimer = setTimeout(() => {
            void load();
          }, 4000 * attempt);
        }
      } finally {
        inFlight.current = false;
      }
    };
    void load();
    return () => {
      disposed.current = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid, refreshTick]);

  return value;
}
/**
 * useMutation(ref) → returns a function that runs the mutation and then bumps
 * the refresh tick so every mounted useQuery re-fetches.
 */
export function useMutation(ref: any) {
  const { user } = useAuth();
  return useCallback(
    async (args?: any) => {
      try {
        const uid = user?.id ?? (await requireUserId());
        const result = await runOp(ref, 'mutation', uid, args ?? {});
        bumpTick();
        return result;
      } catch (e) {
        throw toError(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ref, user?.id],
  );
}

/** useAction(ref) → like useMutation but for long-running server actions. */
export function useAction(ref: any) {
  const { user } = useAuth();
  return useCallback(
    async (args?: any) => {
      try {
        const uid = user?.id ?? (await requireUserId());
        return await runOp(ref, 'action', uid, args ?? {});
      } catch (e) {
        throw toError(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ref, user?.id],
  );
}
/* ─── Auth actions ──────────────────────────────────────────────────────── */

export function useAuthActions() {
  const refresh = useAuth().refresh;

  const getSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }, []);

  const signUp = useCallback(
    async (opts: { email: string; password: string; name?: string; cookingExperience?: string }) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: opts.email.trim().toLowerCase(),
          password: opts.password,
          options: {
            data: { name: opts.name ?? '', cooking_experience: opts.cookingExperience ?? '' },
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
        });
        if (error) throw error;
        const user = data.user;
        if (user && opts.name) {
          await supabase
            .from('users')
            .update({
              name: opts.name,
              cooking_experience: opts.cookingExperience ?? undefined,
              updated_at: Date.now(),
            })
            .eq('id', user.id);
        }
        return data;
      } catch (e) {
        throw toError(e);
      }
    },
    [],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
    } catch (e) {
      throw toError(e);
    }
  }, []);

  /** Send an OTP / magic link to an email address. */
  const sendOtp = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (error) throw error;
    } catch (e) {
      throw toError(e);
    }
  }, []);

  const verifyOtp = useCallback(
    async (opts: { email: string; token: string; type: 'email' | 'signup' | 'recovery' }) => {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: opts.email.trim().toLowerCase(),
          token: opts.token,
          type: opts.type,
        });
        if (error) throw error;
        refresh();
        return data;
      } catch (e) {
        throw toError(e);
      }
    },
    [refresh],
  );

  /** Send a password reset email (Supabase recovery link). */
  const sendReset = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: RESET_REDIRECT_URL,
      });
      if (error) throw error;
    } catch (e) {
      throw toError(e);
    }
  }, []);

  /** Old convex-style compat: signIn('password', {flow:'signUp'|'signIn', …}). */
  const signIn = useCallback(
    async (method: string, opts: any) => {
      if (method === 'password' && opts?.flow === 'signUp') {
        return signUp({ email: opts.email, password: opts.password, name: opts.name });
      }
      if (method === 'password') {
        return signInWithPassword(opts?.email, opts?.password);
      }
      if (method === 'otp') {
        return sendOtp(opts?.email);
      }
      throw new Error(`Unsupported auth method: ${method}`);
    },
    [signUp, signInWithPassword, sendOtp],
  );

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      refresh();
    }
  }, [refresh]);

  const onAuthStateChange = useCallback(
    (callback: (event: string, session: Session | null) => void) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
      return () => data.subscription.unsubscribe();
    },
    [],
  );

  return {
    getSession,
    signUp,
    signInWithPassword,
    signIn,
    sendOtp,
    verifyOtp,
    sendReset,
    signOut,
    onAuthStateChange,
  };
}
/* ─── Drop-in for the old Convex client used by the offline queue ───────── */
export const convexClient = {
  async mutation(ref: any, args?: any) {
    const result = await runOp(ref, 'mutation', null, args ?? {});
    bumpTick();
    return result;
  },
  async query(ref: any, args?: any) {
    return runOp(ref, 'query', null, args ?? {});
  },
  async action(ref: any, args?: any) {
    return runOp(ref, 'action', null, args ?? {});
  },
};

export type { FnRef };
export { isRef };




