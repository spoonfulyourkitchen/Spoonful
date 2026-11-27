import React, { useEffect, useRef } from 'react';
import * as RNW from 'react-native-web';

export * from 'react-native-web';

type AlertButton = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };

const rnw: any = RNW;

/** react-native-web ships no Alert; map it onto the browser dialogs. */
const AlertImpl = {
  alert(title?: string, message?: string, buttons?: AlertButton[]) {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[buttons.length - 1];
      const confirm = buttons.find((b) => b !== cancel) ?? buttons[0];
      if (window.confirm(text)) confirm?.onPress?.();
      else cancel?.onPress?.();
      return;
    }
    window.alert(text);
    buttons?.[0]?.onPress?.();
  },
  prompt(title?: string, message?: string, buttons?: AlertButton[]) {
    AlertImpl.alert(title, message, buttons);
  },
};

const noopSubscription = { remove() {} };

const AccessibilityInfoImpl = rnw.AccessibilityInfo ?? {
  isScreenReaderEnabled: async () => false,
  isReduceMotionEnabled: async () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  isBoldTextEnabled: async () => false,
  isGrayscaleEnabled: async () => false,
  isInvertColorsEnabled: async () => false,
  isHighTextContrastEnabled: async () => false,
  addEventListener: () => noopSubscription,
  removeEventListener: () => undefined,
  announceForAccessibility: () => undefined,
  setAccessibilityFocus: () => undefined,
};

const AppStateImpl = rnw.AppState ?? {
  currentState: 'active',
  addEventListener: (_type: string, handler: (state: string) => void) => {
    const onVisible = () => handler(document.visibilityState === 'visible' ? 'active' : 'background');
    document.addEventListener('visibilitychange', onVisible);
    return { remove: () => document.removeEventListener('visibilitychange', onVisible) };
  },
  removeEventListener: () => undefined,
};

const LinkingImpl = {
  ...(rnw.Linking ?? {}),
  async openURL(url: string) {
    const target = String(url ?? '');
    if (!target) return;
    // OAuth/magic links must stay in this tab so the session lands in this origin.
    if (/\/auth\/v1\/authorize/i.test(target) || target.startsWith('spoonful://')) {
      window.location.assign(target);
      return;
    }
    if (/^(mailto|tel):/i.test(target)) {
      window.location.href = target;
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  },
  async canOpenURL() {
    return true;
  },
  async getInitialURL() {
    return window.location.href;
  },
  addEventListener(_type: 'url', handler: (event: { url: string }) => void) {
    const fire = () => handler({ url: window.location.href });
    window.addEventListener('popstate', fire);
    window.addEventListener('hashchange', fire);
    return {
      remove: () => {
        window.removeEventListener('popstate', fire);
        window.removeEventListener('hashchange', fire);
      },
    };
  },
};

/**
 * Android text-to-speech through the browser's speech synthesis. The app
 * calls NativeModules.SpoonfulTts and only on Platform.OS === 'android'.
 */
const SpoonfulTts = {
  async available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
  async speak(text: string, lang: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text ?? ''));
      if (lang) utterance.lang = lang;
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  },
  async stop() {
    try {
      window.speechSynthesis?.cancel();
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * The app is an Android app; its platform branches (keyboard handling, text to
 * speech, login metadata) should behave exactly like the APK, not like iOS.
 */
export const Platform = {
  ...rnw.Platform,
  OS: 'android' as const,
  select: (spec: Record<string, any>) =>
    spec.android !== undefined ? spec.android : spec.default !== undefined ? spec.default : spec.web,
};

type ModalEntry = { id: number; close: () => void; consumed: boolean };

const modalStack: ModalEntry[] = [];
let modalListenersReady = false;
let modalIds = 0;
let suppressModalPops = 0;

function ensureModalListener() {
  if (modalListenersReady || typeof window === 'undefined') return;
  modalListenersReady = true;
  window.addEventListener('popstate', () => {
    if (suppressModalPops > 0) {
      suppressModalPops -= 1;
      return;
    }
    const top = modalStack[modalStack.length - 1];
    if (!top) return;
    top.consumed = true;
    top.close();
  });
}

/**
 * Every open modal adds one browser history entry. Back closes the top modal
 * instead of leaving the page; closing it in the app removes that entry again.
 */
function WebModal(props: any) {
  const visible = !!props.visible;
  const closeRef = useRef<(() => void) | undefined>(props.onRequestClose);
  closeRef.current = props.onRequestClose;

  useEffect(() => {
    if (!visible || typeof window === 'undefined' || typeof closeRef.current !== 'function') return;
    ensureModalListener();
    modalIds += 1;
    const entry: ModalEntry = {
      id: modalIds,
      consumed: false,
      close: () => closeRef.current?.(),
    };
    modalStack.push(entry);
    window.history.pushState({ ...(window.history.state ?? {}), spoonfulModal: entry.id }, '');
    return () => {
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      if (entry.consumed) return;
      // While the modal was open the app may have navigated (for example from
      // "open recipe"). Then this entry is no longer the top of the history
      // stack, and history.back() would undo that navigation and close the new
      // screen right after it opened.
      const state: any = typeof window === 'undefined' ? null : window.history.state;
      if (!state || typeof state !== 'object' || state.spoonfulModal !== entry.id) return;
      suppressModalPops += 1;
      window.history.back();
    };
  }, [visible]);

  return React.createElement(rnw.Modal, props);
}

export const Modal = rnw.Modal ? WebModal : rnw.Modal;
export const Alert = rnw.Alert ?? AlertImpl;
export const AccessibilityInfo = AccessibilityInfoImpl;
export const AppState = AppStateImpl;
export const Linking = LinkingImpl;
export const NativeModules = { ...(rnw.NativeModules ?? {}), SpoonfulTts };
export const Vibration = rnw.Vibration ?? { vibrate: () => undefined, cancel: () => undefined };
export const Share = rnw.Share ?? {
  async share(payload: { message?: string; url?: string; title?: string }) {
    const text = [payload?.message, payload?.url].filter(Boolean).join(' ');
    const nav: any = navigator;
    if (nav?.share) return nav.share({ title: payload?.title, text, url: payload?.url });
    if (nav?.clipboard?.writeText) await nav.clipboard.writeText(text);
    return undefined;
  },
};
