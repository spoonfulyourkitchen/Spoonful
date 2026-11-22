import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, requireUserId, toError, type Session, type User } from './supabase';
import { api, runOp, isRef, type FnRef } from './api';
import { AUTH_REDIRECT_URL, RESET_REDIRECT_URL, initAuthLinkHandling } from './auth-link';
import { exitLocalTest, isLocalTestActive } from './local-test';

export { supabase, api };

export const authStorage = AsyncStorage;

type AuthValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  event: string | null;
  refresh: () => void;
};

const AuthContext = createContext<AuthValue>({ session: null, user: null, isLoading: true, event: null, refresh: () => {} });

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

export function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<string | null>(null);

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
          setAuthEvent(data.session ? 'INITIAL_SESSION' : null);
          setIsLoading(false);
        })
        .catch(() => {
          if (alive) setIsLoading(false);
        });

      const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
        if (!alive) return;
        setSession(next);
        setUser(next?.user ?? null);
        setAuthEvent(event);
        setIsLoading(false);
        

        if (!next?.user) clearQueryCache();
        bumpTick();
      });
      return () => {
        alive = false;
        unlink();
        try {
          sub.subscription.unsubscribe();
        } catch {}
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
    () => ({ session, user, isLoading, event: authEvent, refresh: bumpTick }),
    [session, user, isLoading, authEvent],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useConvexAuth() {
  const { session, isLoading, event } = useAuth();
  return { isAuthenticated: !!session, isLoading, event };
}

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

const queryCache = new Map<string, any>();

function clearQueryCache() {
  queryCache.clear();
}

export function useQuery(ref: any, args?: any): any {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const refreshTick = useSyncExternalStore(subscribeTick, getTick, getTick);
  const inFlight = useRef(false);
  const disposed = useRef(false);
  const key = cacheKey(ref, args, uid);
  const [value, setValue] = useState<any>(() => (uid && ref ? queryCache.get(key) : undefined));
  

  const latest = useRef({ ref, args });
  latest.current = { ref, args };

  useEffect(() => {
    disposed.current = false;
    if (!uid || !latest.current.ref) {
      setValue(undefined);
      return;
    }
    
    const cached = queryCache.get(key);
    if (cached !== undefined) setValue(cached);
    let retryTimer: any = null;
    let attempt = 0;
    const load = async () => {
      if (inFlight.current || disposed.current) return;
      inFlight.current = true;
      try {
        const result = await runOp(latest.current.ref, 'query', uid, latest.current.args);
        queryCache.set(key, result);
        if (!disposed.current) setValue(result);
        attempt = 0;
      } catch (e) {
        console.warn('[spoonful] query failed', key, e instanceof Error ? e.message : e);
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
  }, [key, uid, refreshTick]);

  return value;
}

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
    [ref, user?.id],
  );
}

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
    [ref, user?.id],
  );
}

export function useAuthActions() {
  const refresh = useAuth().refresh;

  const getSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }, []);

  const signUp = useCallback(
    async (opts: {
      email: string;
      password: string;
      name?: string;
      cookingExperience?: string;
      

      ageConfirmed?: boolean;
      termsAcceptedAt?: number;
      healthConsentAt?: number;
    }) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: opts.email.trim().toLowerCase(),
          password: opts.password,
          options: {
            data: {
              name: opts.name ?? '',
              cooking_experience: opts.cookingExperience ?? '',
              age_confirmed: opts.ageConfirmed ?? false,
              terms_accepted_at: opts.termsAcceptedAt ?? null,
              health_consent_at: opts.healthConsentAt ?? null,
            },
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

  
  

  const signInWithGoogle = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) await Linking.openURL(data.url);
    } catch (e) {
      throw toError(e);
    }
  }, []);

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
    if (isLocalTestActive()) {
      await exitLocalTest();
      return;
    }
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
    signInWithGoogle,
    signIn,
    sendOtp,
    verifyOtp,
    sendReset,
    signOut,
    onAuthStateChange,
  };
}

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

