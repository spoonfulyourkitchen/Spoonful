import { supabase } from '../../../mobile/src/lib/supabase';
import { SUPABASE_URL } from '../../../mobile/src/config';

const origin = window.location.origin;
const env = (import.meta as any).env ?? {};
/** Build base: '/' locally, '/Spoonful/' when hosted inside the community site. */
const base = String(env.BASE_URL || '/');

/** Where Supabase sends the browser after signup / email confirmation / OAuth. */
export const WEB_AUTH_REDIRECT = String(env.VITE_AUTH_REDIRECT_URL || new URL(base, `${origin}/`).href);
/** Where Supabase sends the browser after a password reset. */
export const WEB_RESET_REDIRECT = String(
  env.VITE_RESET_REDIRECT_URL || `${new URL(base, `${origin}/`).href}?type=recovery`,
);

/**
 * The mobile app deep-links back into `spoonful://…`. In a browser those URLs are
 * unreachable, so the same calls are pointed at this origin. Everything else
 * (session handling, token exchange) stays in the app's own auth-link module,
 * which reads the tokens out of the current URL.
 */
function patchSupabaseRedirects() {
  const auth = supabase.auth as any;

  const patch = (name: string, rewrite: (args: any[]) => any[]) => {
    const original = auth[name];
    if (typeof original !== 'function') return;
    auth[name] = (...args: any[]) => original.apply(supabase.auth, rewrite(args));
  };

  patch('signInWithOAuth', (args) => {
    const [creds, ...rest] = args;
    return [{ ...creds, options: { ...creds?.options, redirectTo: WEB_AUTH_REDIRECT } }, ...rest];
  });

  patch('signUp', (args) => {
    const [creds, ...rest] = args;
    return [{ ...creds, options: { ...creds?.options, emailRedirectTo: WEB_AUTH_REDIRECT } }, ...rest];
  });

  patch('signInWithOtp', (args) => {
    const [creds, ...rest] = args;
    return [{ ...creds, options: { ...creds?.options, emailRedirectTo: WEB_AUTH_REDIRECT } }, ...rest];
  });

  patch('resetPasswordForEmail', (args) => {
    const [email, options, ...rest] = args;
    return [email, { ...options, redirectTo: WEB_RESET_REDIRECT }, ...rest];
  });
}

let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

/** Keeps access tokens out of the address bar once the app has picked them up. */
function scheduleTokenCleanup() {
  const sensitive = /(access_token|refresh_token|token_hash|code)=/i.test(
    `${window.location.search}${window.location.hash}`,
  );
  if (!sensitive) return;
  if (cleanupTimer) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    const url = `${window.location.pathname}`;
    window.history.replaceState({}, document.title, url);
  }, 2500);
}

/**
 * The offline probe requests the bare project URL, which returns no CORS
 * headers in a browser. Point it at the health endpoint instead so a working
 * connection is not mistaken for an offline one.
 */
function patchConnectivityProbe() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: any, init?: any) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : String(input?.url ?? '');
    const bare = url === SUPABASE_URL || url === `${SUPABASE_URL}/`;
    const isGet = !init || !init.method || String(init.method).toUpperCase() === 'GET';
    if (bare && isGet) return nativeFetch(`${SUPABASE_URL}/auth/v1/health`, init);
    return nativeFetch(input, init);
  }) as typeof window.fetch;
}

/**
 * Desktop: the eight bottom tabs are wider than the window. Browsers scroll
 * them only with shift+wheel or the scrollbar, so a normal wheel, a mouse drag
 * and the arrow keys scroll the tab bar sideways.
 */
function findTabScroller(): HTMLElement | null {
  const tab = document.querySelector('[role="tab"]');
  if (!tab) return null;
  let node = tab.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 4
    ) {
      node.style.overscrollBehaviorX = 'contain';
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function enhanceTabBar() {
  let dragging = false;
  let swallowClick = false;
  let startX = 0;
  let startScroll = 0;

  document.addEventListener(
    'wheel',
    (event) => {
      const scroller = findTabScroller();
      if (!scroller || !(event.target instanceof Node) || !scroller.contains(event.target)) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      scroller.scrollLeft += event.deltaY;
      event.preventDefault();
    },
    { passive: false, capture: true },
  );

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      const scroller = findTabScroller();
      if (!scroller || !(event.target instanceof Node) || !scroller.contains(event.target)) return;
      dragging = true;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      scroller.style.cursor = 'grabbing';
    },
    true,
  );

  document.addEventListener(
    'pointermove',
    (event) => {
      if (!dragging) return;
      const scroller = findTabScroller();
      if (!scroller) {
        dragging = false;
        return;
      }
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 4) {
        swallowClick = true;
        scroller.scrollLeft = startScroll - dx;
      }
    },
    true,
  );

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    const scroller = findTabScroller();
    if (scroller) scroller.style.cursor = '';
    setTimeout(() => {
      swallowClick = false;
    }, 0);
  };
  document.addEventListener('pointerup', stopDragging, true);
  document.addEventListener('pointercancel', stopDragging, true);

  document.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const scroller = findTabScroller();
    if (!scroller || !scroller.contains(document.activeElement)) return;
    scroller.scrollLeft += event.key === 'ArrowRight' ? 140 : -140;
    event.preventDefault();
  });
}

/** React Navigation writes the route name into the document title. */
function keepDocumentTitle() {
  const apply = () => {
    if (!document.title || document.title === 'undefined') document.title = 'Spoonful';
  };
  apply();
  const title = document.querySelector('title');
  if (title) new MutationObserver(apply).observe(title, { childList: true });
}

export function installWebGlue() {
  keepDocumentTitle();
  enhanceTabBar();
  patchConnectivityProbe();
  patchSupabaseRedirects();
  scheduleTokenCleanup();
  window.addEventListener('hashchange', scheduleTokenCleanup);

  // React Native Web leaves the surface white when the browser is pulled down.
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
}
