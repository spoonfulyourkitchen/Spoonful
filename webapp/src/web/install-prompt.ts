/**
 * The app only runs as an installed web app, and every browser hides that
 * behind a different menu. iOS Safari, iOS Chrome/Edge/Firefox, Android
 * Chrome/Edge, Samsung Internet, Android Firefox, desktop Chromium and desktop
 * Safari each get a walkthrough with a mock of the UI the user is actually
 * looking at. Where the browser offers `beforeinstallprompt`, a one-tap install
 * button sits above the steps.
 *
 * The overlay stays until Spoonful runs in standalone mode, except in browsers
 * that cannot install web apps at all - there it points at a browser that can.
 */

const base = String((import.meta as any).env?.BASE_URL || '/');

const ICON = {
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15.5V3.2"/><path d="M8.4 6.6 12 3l3.6 3.6"/><path d="M5 11.5v8.8h14v-8.8"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.2"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0L6 13a3.5 3.5 0 0 0 5 5l1-1"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 17.5h15"/></svg>`,
  tabs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="12" height="12" rx="2.5"/><path d="M8 19h10a2 2 0 0 0 2-2V7"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7"/></svg>`,
  dots: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.5" r="1.7"/></svg>`,
  bars: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  install: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v10"/><path d="M8.3 9.6 12 13.3l3.7-3.7"/><path d="M5 15.5v3.2A2.3 2.3 0 0 0 7.3 21h9.4A2.3 2.3 0 0 0 19 18.7v-3.2"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10.5"/><path d="M7.8 10.3 12 14.5l4.2-4.2"/><path d="M4.5 19.5h15"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
};

/* ------------------------------------------------------------------ artwork */

function bar(parts: string[], caption: string): string {
  return `<div class="sp-art"><div class="sp-bar">${parts.join('')}</div><div class="sp-bar__label">${caption}</div></div>`;
}

/** Mock of a phone browser toolbar with one highlighted control. */
function toolbar(kind: 'ios' | 'android', pick: 'share' | 'menu', caption: string): string {
  const item = (icon: string, hot = false) =>
    `<span class="sp-bar__item${hot ? ' sp-bar__pick' : ''}">${icon}</span>`;
  if (kind === 'ios') {
    return bar(
      [item(ICON.back), item(ICON.share, pick === 'share'), item(ICON.book), item(ICON.tabs)],
      caption,
    );
  }
  const menuIcon = /Samsung/.test(caption) ? ICON.bars : ICON.dots;
  return bar([item(ICON.back), item(ICON.tabs), item(menuIcon, pick === 'menu')], caption);
}

/** Mock of a menu / share sheet with one highlighted row. */
function menu(rows: string[], pick: number, opts: { grabber?: boolean } = {}): string {
  const html = rows
    .map((label, i) => {
      const icon = i === 0 ? ICON.link : i === pick ? ICON.home : ICON.tabs;
      return `<div class="sp-sheet__row${i === pick ? ' sp-sheet__row--pick' : ''}">${icon}${label}</div>`;
    })
    .join('');
  return `<div class="sp-art"><div class="sp-sheet">${
    opts.grabber ? '<div class="sp-sheet__grab"></div>' : ''
  }${html}</div></div>`;
}

function dialog(title: string, field: string, confirm: string): string {
  return `<div class="sp-art"><div class="sp-dialog">
    <div class="sp-dialog__title">${title}</div>
    <div class="sp-dialog__field">${field}</div>
    <div class="sp-dialog__actions">
      <div class="sp-dialog__btn">Abbrechen</div>
      <div class="sp-dialog__btn sp-dialog__btn--pick">${confirm}</div>
    </div>
  </div></div>`;
}

/** Mock of a desktop address bar with the install control highlighted. */
function addressBar(caption: string): string {
  return `<div class="sp-art"><div class="sp-addr">
    <span class="sp-addr__lock">${ICON.lock}</span>
    <span class="sp-addr__url">${location.host}</span>
    <span class="sp-addr__install">${ICON.install}</span>
  </div><div class="sp-bar__label">${caption}</div></div>`;
}

/** Mock of the installed app in its own window. */
function windowArt(caption: string): string {
  return `<div class="sp-art"><div class="sp-window">
    <div class="sp-window__bar"><i></i><i></i><i></i><span>Spoonful</span></div>
    <div class="sp-window__body">
      <img class="sp-window__icon" src="${base}icon-192.png" alt="" />
      <div class="sp-window__meta"><strong>Spoonful</strong><small>ohne Adressleiste</small></div>
    </div>
  </div><div class="sp-bar__label">${caption}</div></div>`;
}

/** A single centred control, for the one icon Safari hides in its toolbar. */
function centeredArt(caption: string, icon: string): string {
  return `<div class="sp-art"><div class="sp-center"><span class="sp-bar__pick">${icon}</span></div><div class="sp-bar__label">${caption}</div></div>`;
}

/* ----------------------------------------------------------------- variants */

type Variant = {
  browser: string;
  title: string;
  lead: string;
  foot: string;
  steps: { title: string; text: string; art: string }[];
  /** Offer the one-tap install button when the browser fires beforeinstallprompt. */
  cta?: boolean;
  /** Browser cannot install web apps at all: offer the link instead. */
  unsupported?: boolean;
  /** Desktop Firefox: also offer a way past the guide, because there is none. */
  continueAnyway?: boolean;
};

function iosVariant(browser: string, isSafari: boolean, isPad: boolean): Variant {
  const barName = isSafari ? 'Safari-Leiste' : `${browser}-Leiste`;
  return {
    browser: `${browser} auf ${isPad ? 'dem iPad' : 'dem iPhone'}`,
    title: 'Erst auf den Startbildschirm, dann kochen.',
    lead: `Spoonful läuft im Vollbild ohne Adressleiste. Dafür muss die App einmal in ${browser} hinzugefügt werden. Dauert 20 Sekunden.`,
    foot: 'Danach Spoonful über das neue Icon öffnen. Diese Anleitung erscheint nur hier und ist danach weg.',
    steps: [
      {
        title: 'Teilen-Symbol antippen',
        text: isPad
          ? `Oben in der ${barName}: das Quadrat mit dem Pfeil nach oben.`
          : `Unten in der ${barName}: das Quadrat mit dem Pfeil nach oben.`,
        art: toolbar('ios', 'share', 'Teilen'),
      },
      {
        title: '„Zum Startbildschirm“ wählen',
        text: 'Im Menü nach unten scrollen und die Zeile mit dem Plus im Kasten antippen.',
        art: menu(['Link kopieren', 'Lesezeichen', 'Zum Startbildschirm', 'Neues Fenster'], 2, {
          grabber: true,
        }),
      },
      {
        title: '„Hinzufügen“ bestätigen',
        text: 'Oben rechts auf „Hinzufügen“ tippen. Der Name bleibt „Spoonful“.',
        art: dialog('Zum Startbildschirm', 'Spoonful', 'Hinzufügen'),
      },
    ],
  };
}

function androidChromeVariant(browser: string): Variant {
  return {
    browser: `${browser} auf Android`,
    title: 'Spoonful installieren, dann kochen.',
    lead: 'Spoonful läuft dann im eigenen Fenster, ohne Adressleiste, mit Icon auf dem Startbildschirm.',
    foot: 'Danach Spoonful über das neue App-Symbol öffnen. Diese Anleitung erscheint nur im Browser.',
    cta: true,
    steps: [
      {
        title: 'Menü oben rechts öffnen',
        text: 'Die drei Punkte in der Leiste oben rechts antippen.',
        art: toolbar('android', 'menu', 'Menü'),
      },
      {
        title: '„App installieren“ wählen',
        text: 'Je nach Version heißt der Eintrag auch „Zum Startbildschirm hinzufügen“.',
        art: menu(['Neuer Tab', 'Verlauf', 'App installieren', 'Einstellungen'], 2),
      },
      {
        title: '„Installieren“ bestätigen',
        text: 'Der Dialog zeigt Name und Icon von Spoonful.',
        art: dialog('Spoonful installieren', 'Spoonful', 'Installieren'),
      },
    ],
  };
}

function androidSamsungVariant(): Variant {
  return {
    browser: 'Samsung Internet auf Android',
    title: 'Spoonful installieren, dann kochen.',
    lead: 'Spoonful läuft dann im eigenen Fenster, ohne Adressleiste, mit Icon auf dem Startbildschirm.',
    foot: 'Danach Spoonful über das neue App-Symbol öffnen. Diese Anleitung erscheint nur im Browser.',
    steps: [
      {
        title: 'Menü unten rechts öffnen',
        text: 'Die drei Striche in der Leiste unten rechts antippen.',
        art: toolbar('android', 'menu', 'Samsung-Menü'),
      },
      {
        title: '„Seite hinzufügen“ wählen',
        text: 'Dann „Startbildschirm“ antippen.',
        art: menu(['Seite teilen', 'Seite hinzufügen', 'Als Startseite festlegen', 'Einstellungen'], 1),
      },
      {
        title: '„Hinzufügen“ bestätigen',
        text: 'Der Name bleibt „Spoonful“.',
        art: dialog('Zum Startbildschirm hinzufügen', 'Spoonful', 'Hinzufügen'),
      },
    ],
  };
}

function androidFirefoxVariant(): Variant {
  return {
    browser: 'Firefox auf Android',
    title: 'Spoonful auf den Startbildschirm, dann kochen.',
    lead: 'Spoonful läuft dann als eigene App mit Icon auf dem Startbildschirm, ohne Adressleiste.',
    foot: 'Danach Spoonful über das neue Symbol öffnen. Diese Anleitung erscheint nur im Browser.',
    steps: [
      {
        title: 'Menü oben rechts öffnen',
        text: 'Die drei Punkte rechts neben der Adressleiste antippen.',
        art: toolbar('android', 'menu', 'Firefox-Menü'),
      },
      {
        title: '„Zum Startbildschirm hinzufügen“ wählen',
        text: 'Der Eintrag steht weiter unten im Menü.',
        art: menu(['Lesezeichen', 'Teilen', 'Zum Startbildschirm hinzufügen', 'Einstellungen'], 2),
      },
      {
        title: '„Hinzufügen“ bestätigen',
        text: 'Der Name bleibt „Spoonful“.',
        art: dialog('Zum Startbildschirm hinzufügen', 'Spoonful', 'Hinzufügen'),
      },
    ],
  };
}

function desktopChromeVariant(browser: string): Variant {
  return {
    browser: `${browser} auf dem PC`,
    title: 'Spoonful installieren, dann kochen.',
    lead: 'Spoonful bekommt ein eigenes Fenster und ein Icon in der App-Liste. Ohne Adressleiste.',
    foot: 'Danach Spoonful über das neue App-Symbol öffnen. Diese Anleitung erscheint nur im Browser.',
    cta: true,
    steps: [
      {
        title: 'Installationssymbol in der Adressleiste',
        text: 'Rechts in der Adressleiste erscheint ein kleiner Bildschirm mit Pfeil. Das Menü oben rechts geht auch.',
        art: addressBar('Installieren'),
      },
      {
        title: '„Installieren“ bestätigen',
        text: 'Der Dialog zeigt Name und Icon von Spoonful.',
        art: dialog('Spoonful installieren', 'Spoonful', 'Installieren'),
      },
      {
        title: 'Fertig, eigenes Fenster',
        text: 'Spoonful startet danach aus dem Startmenü wie jede andere App, ohne Adressleiste.',
        art: windowArt('Eigenes Fenster'),
      },
    ],
  };
}

function desktopSafariVariant(): Variant {
  return {
    browser: 'Safari auf dem Mac',
    title: 'Spoonful ins Dock, dann kochen.',
    lead: 'Safari kann Spoonful als Web-App ins Dock legen. Danach startet es ohne Adressleiste.',
    foot: 'Danach Spoonful über das Dock-Symbol öffnen. Diese Anleitung erscheint nur im Browser.',
    steps: [
      {
        title: 'Teilen-Symbol in der Symbolleiste',
        text: 'Oben rechts in der Safari-Symbolleiste: das Quadrat mit dem Pfeil nach oben.',
        art: centeredArt('Teilen', ICON.share),
      },
      {
        title: '„Zum Dock hinzufügen“ wählen',
        text: 'Der Eintrag steht im Teilen-Menü.',
        art: menu(['Als Lesezeichen sichern', 'In die Leseliste', 'Zum Dock hinzufügen'], 2),
      },
      {
        title: '„Hinzufügen“ bestätigen',
        text: 'Der Name bleibt „Spoonful“.',
        art: dialog('Zum Dock hinzufügen', 'Spoonful', 'Hinzufügen'),
      },
    ],
  };
}

function unsupportedVariant(browser: string, continueAnyway = false): Variant {
  return {
    browser,
    continueAnyway,
    title: 'Dieser Browser kann Spoonful nicht installieren.',
    lead: `${browser} kennt keine installierbaren Web-Apps. Öffne Spoonful in Chrome, Edge oder Safari. Dort führt dich die Anleitung in drei Schritten zum Icon.`,
    foot: 'Der Link bleibt gleich, deine Anmeldung auch.',
    unsupported: true,
    steps: [
      {
        title: 'Link kopieren',
        text: 'Der Knopf unten legt die Adresse in die Zwischenablage.',
        art: `<div class="sp-art"><div class="sp-addr">
          <span class="sp-addr__lock">${ICON.lock}</span>
          <span class="sp-addr__url">${location.host}${location.pathname}</span>
        </div><div class="sp-bar__label">Spoonful</div></div>`,
      },
      {
        title: 'In Chrome, Edge oder Safari öffnen',
        text: 'Adresse oben einfügen und laden.',
        art: addressBar('Chrome'),
      },
      {
        title: 'Anleitung dort folgen',
        text: 'Der Rest sind zwei Tipps.',
        art: dialog('Spoonful installieren', 'Spoonful', 'Installieren'),
      },
    ],
  };
}

/* ----------------------------------------------------------------- detection */

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  return (
    (navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

/** Instagram, WhatsApp and friends open links in a WebView that cannot install. */
function isInAppBrowser(): boolean {
  return /(FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|Twitter|TikTok|musical_ly|Pinterest|LinkedInApp|GSA\/)/i.test(
    navigator.userAgent,
  );
}

function browserName(
  platform: Platform,
): { name: string; kind: 'chromium' | 'samsung' | 'firefox' | 'safari' | 'unknown'; isPad: boolean } {
  const ua = navigator.userAgent;
  const isPad = platform === 'ios' && (/iPad/.test(ua) || navigator.platform === 'MacIntel');
  const edge = /Edg\//.test(ua) || /EdgiOS/.test(ua) || /EdgA/.test(ua);
  const opera = /OPR\//.test(ua) || /OPiOS/.test(ua);
  const samsung = /SamsungBrowser/.test(ua);
  const firefox = /Firefox\//.test(ua) || /FxiOS/.test(ua);
  const chrome = /Chrome\//.test(ua) || /CriOS/.test(ua);

  if (samsung) return { name: 'Samsung Internet', kind: 'samsung', isPad };
  if (edge) return { name: 'Edge', kind: 'chromium', isPad };
  if (opera) return { name: 'Opera', kind: 'chromium', isPad };
  if (firefox) return { name: 'Firefox', kind: 'firefox', isPad };
  if (chrome) return { name: 'Chrome', kind: 'chromium', isPad };
  if (/Safari\//.test(ua)) return { name: 'Safari', kind: 'safari', isPad };
  return { name: 'Browser', kind: 'unknown', isPad };
}

function pickVariant(): Variant {
  const platform = detectPlatform();
  const { name, kind, isPad } = browserName(platform);

  if (platform === 'ios') return iosVariant(name, kind === 'safari', isPad);
  if (platform === 'android') {
    if (kind === 'samsung') return androidSamsungVariant();
    if (kind === 'firefox') return androidFirefoxVariant();
    return androidChromeVariant(name);
  }
  if (kind === 'safari') return desktopSafariVariant();
  if (kind === 'chromium') return desktopChromeVariant(name);
  // Firefox on a computer has no install at all, so the guide must not be a dead end there.
  return unsupportedVariant(
    name === 'Browser' ? 'Dieser Browser' : name,
    platform === 'desktop' && kind === 'firefox',
  );
}

/* -------------------------------------------------------------------- styles */

const CSS = `
.sp-install {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  justify-content: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #f7f3eb;
  color: #1f1a17;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  text-align: left;
}
.sp-install__inner {
  width: 100%;
  max-width: 440px;
  padding: calc(28px + env(safe-area-inset-top)) 22px calc(28px + env(safe-area-inset-bottom));
}
.sp-install__head { display: flex; align-items: center; gap: 14px; }
.sp-install__icon {
  width: 74px; height: 74px; flex: 0 0 74px;
  border-radius: 19px;
  box-shadow: 0 8px 22px rgba(60, 34, 16, 0.18), 0 0 0 1px rgba(60, 34, 16, 0.06);
}
.sp-install__name { font-size: 21px; font-weight: 700; letter-spacing: -0.2px; }
.sp-install__tag { font-size: 13px; color: #8a7f74; margin-top: 3px; }
.sp-install__title {
  font-size: 26px; line-height: 1.15; font-weight: 750; letter-spacing: -0.6px;
  margin: 22px 0 8px;
}
.sp-install__lead { font-size: 15px; line-height: 1.45; color: #6b625c; margin: 0 0 22px; }
.sp-install__steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.sp-step {
  background: #fff;
  border: 1px solid rgba(60, 34, 16, 0.08);
  border-radius: 18px;
  padding: 15px 15px 13px;
  box-shadow: 0 1px 2px rgba(60, 34, 16, 0.04);
}
.sp-step__head { display: flex; align-items: center; gap: 10px; }
.sp-step__num {
  width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%;
  background: #92400e; color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.sp-step__title { font-size: 16px; font-weight: 680; letter-spacing: -0.2px; }
.sp-step__text { font-size: 13.5px; line-height: 1.45; color: #6b625c; margin: 7px 0 0 34px; }
.sp-step__art { margin: 12px 0 0 34px; }
.sp-step__art > * { margin: 0; }

.sp-art {
  background: #f4efe6;
  border-radius: 13px;
  padding: 12px 10px;
}
.sp-bar { display: flex; align-items: center; justify-content: space-between; color: #a99e92; }
.sp-bar svg { width: 21px; height: 21px; display: block; }
.sp-bar__item { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; }
.sp-bar__pick {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%;
  background: #92400e; color: #fff; position: relative;
}
.sp-bar__pick::after {
  content: ''; position: absolute; inset: -6px; border-radius: 50%;
  border: 2px solid rgba(146, 64, 14, 0.35);
  animation: sp-pulse 2.1s ease-out infinite;
}
.sp-bar__pick svg { width: 22px; height: 22px; }
.sp-bar__label {
  font-size: 10.5px; font-weight: 650; color: #92400e; text-align: center;
  letter-spacing: 0.3px; text-transform: uppercase; margin-top: 4px;
}
.sp-sheet {
  background: #fff; border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(60, 34, 16, 0.08);
}
.sp-sheet__row {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 11px; font-size: 12.5px; color: #6b625c;
  border-bottom: 1px solid rgba(60, 34, 16, 0.06);
}
.sp-sheet__row:last-child { border-bottom: 0; }
.sp-sheet__row svg { width: 16px; height: 16px; flex: 0 0 16px; }
.sp-sheet__row--pick {
  background: #fdf6f0; color: #92400e; font-weight: 650;
  box-shadow: inset 2.5px 0 0 #92400e;
}
.sp-sheet__row--pick::after {
  content: 'hier tippen'; margin-left: auto; font-size: 9.5px; font-weight: 700;
  letter-spacing: 0.4px; text-transform: uppercase; color: #b45309;
}
.sp-sheet__grab {
  width: 34px; height: 4px; border-radius: 2px; background: rgba(60, 34, 16, 0.16);
  margin: 6px auto 4px;
}
.sp-dialog { background: #fff; border-radius: 13px; border: 1px solid rgba(60, 34, 16, 0.08); overflow: hidden; }
.sp-dialog__title { font-size: 11px; font-weight: 650; text-align: center; padding: 8px 10px 4px; color: #6b625c; }
.sp-dialog__field {
  margin: 2px 10px 9px; padding: 7px 9px; border-radius: 8px;
  background: #f4efe6; font-size: 12px; color: #1f1a17; text-align: center;
}
.sp-dialog__actions { display: flex; border-top: 1px solid rgba(60, 34, 16, 0.09); }
.sp-dialog__btn {
  flex: 1; padding: 8px; font-size: 12px; text-align: center; color: #8a7f74;
  border-right: 1px solid rgba(60, 34, 16, 0.09);
}
.sp-dialog__btn:last-child { border-right: 0; }
.sp-dialog__btn--pick { color: #92400e; font-weight: 700; background: #fdf6f0; }

.sp-addr {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border-radius: 999px; padding: 7px 9px 7px 11px;
  border: 1px solid rgba(60, 34, 16, 0.1);
}
.sp-addr__lock { display: flex; color: #a99e92; }
.sp-addr__lock svg { width: 13px; height: 13px; }
.sp-addr__url {
  flex: 1; font-size: 11.5px; color: #6b625c; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
}
.sp-addr__install {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%;
  background: #92400e; color: #fff; position: relative; flex: 0 0 30px;
}
.sp-addr__install::after {
  content: ''; position: absolute; inset: -5px; border-radius: 50%;
  border: 2px solid rgba(146, 64, 14, 0.35);
  animation: sp-pulse 2.1s ease-out infinite;
}
.sp-addr__install svg { width: 17px; height: 17px; }

.sp-center { display: flex; justify-content: center; padding: 6px 0 2px; }
.sp-window { background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid rgba(60, 34, 16, 0.1); }
.sp-window__bar {
  display: flex; align-items: center; gap: 5px; padding: 7px 10px;
  border-bottom: 1px solid rgba(60, 34, 16, 0.08); background: #faf6ef;
}
.sp-window__bar i { width: 7px; height: 7px; border-radius: 50%; background: rgba(60, 34, 16, 0.18); }
.sp-window__bar span { margin-left: auto; font-size: 10.5px; color: #8a7f74; }
.sp-window__body { display: flex; align-items: center; gap: 10px; padding: 12px 12px 14px; }
.sp-window__icon { width: 34px; height: 34px; border-radius: 9px; }
.sp-window__meta { display: flex; flex-direction: column; gap: 2px; }
.sp-window__meta strong { font-size: 12.5px; color: #1f1a17; }
.sp-window__meta small { font-size: 11px; color: #8a7f74; }

.sp-install__cta { margin: 0 0 16px; }
.sp-install__link {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  margin-top: 10px; font-size: 12.5px; color: #8a7f74;
}
.sp-install__link svg { width: 14px; height: 14px; }
.sp-install__foot {
  display: flex; gap: 10px; align-items: flex-start;
  margin-top: 18px; padding: 13px 14px;
  border-radius: 14px; background: rgba(146, 64, 14, 0.07);
  font-size: 12.5px; line-height: 1.45; color: #7a531f;
}
.sp-install__foot svg { width: 17px; height: 17px; flex: 0 0 17px; margin-top: 1px; color: #92400e; }
.sp-install__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 14px 16px;
  border: 0; border-radius: 14px; background: #92400e; color: #fff;
  font: inherit; font-size: 15px; font-weight: 650; cursor: pointer;
}
.sp-install__btn svg { width: 18px; height: 18px; }
.sp-install__btn[disabled] { opacity: 0.6; }
.sp-install__plain {
  display: block; width: 100%; margin-top: 10px; padding: 12px 16px;
  border: 1px solid rgba(146, 64, 14, 0.28); border-radius: 14px;
  background: transparent; color: #92400e;
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
}
.sp-install__plain:hover { background: rgba(146, 64, 14, 0.06); }
@keyframes sp-pulse {
  0% { transform: scale(0.9); opacity: 0.9; }
  70% { transform: scale(1.25); opacity: 0; }
  100% { transform: scale(1.25); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sp-bar__pick::after, .sp-addr__install::after { animation: none; opacity: 0.5; }
}
@media (min-width: 700px) {
  .sp-install__inner { max-width: 600px; }
}
@media (min-width: 700px) and (min-height: 820px) {
  .sp-install__inner { margin: auto; }
}
`;

/* ------------------------------------------------------------------ rendering */

let overlay: HTMLElement | null = null;
let deferredPrompt: any = null;

/** Set when the visitor chose to keep working in Firefox instead of installing. */
const CONTINUE_KEY = 'spoonful:install-continue';

function continueInBrowser(): void {
  try {
    sessionStorage.setItem(CONTINUE_KEY, '1');
  } catch {
    // Private windows can refuse storage. Hiding the guide still has to work.
  }
  overlay?.remove();
  overlay = null;
  document.querySelector('style[data-sp-install]')?.remove();
}

function showCta(): void {
  const slot = overlay?.querySelector<HTMLElement>('[data-cta]');
  if (slot) slot.hidden = false;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  showCta();
});

window.addEventListener('appinstalled', () => {
  overlay?.remove();
  overlay = null;
  document.querySelector('style[data-sp-install]')?.remove();
});

async function copyLink(button: HTMLButtonElement, done: string): Promise<void> {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const field = document.createElement('textarea');
    field.value = url;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
  const label = button.querySelector('span');
  if (label) label.textContent = done;
}

async function runInstallPrompt(button: HTMLButtonElement): Promise<void> {
  if (!deferredPrompt) return;
  button.disabled = true;
  try {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
  } catch {
    // The browser may refuse outside a user gesture; the steps below still work.
  } finally {
    deferredPrompt = null;
    button.disabled = false;
  }
}

function mount(html: string): void {
  document.head.insertAdjacentHTML('beforeend', `<style data-sp-install>${CSS}</style>`);
  overlay = document.createElement('div');
  overlay.className = 'sp-install';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Spoonful installieren');
  overlay.innerHTML = `<div class="sp-install__inner">${html}</div>`;
  document.body.appendChild(overlay);
}

function head(variant: { browser: string; title: string; lead: string }): string {
  return `<div class="sp-install__head">
    <img class="sp-install__icon" src="${base}icon-192.png" alt="" width="74" height="74" />
    <div>
      <div class="sp-install__name">Spoonful</div>
      <div class="sp-install__tag">${variant.browser}</div>
    </div>
  </div>
  <h1 class="sp-install__title">${variant.title}</h1>
  <p class="sp-install__lead">${variant.lead}</p>`;
}

function stepsHtml(variant: Variant): string {
  return `<ol class="sp-install__steps">${variant.steps
    .map(
      (step, index) => `<li class="sp-step">
        <div class="sp-step__head"><span class="sp-step__num">${index + 1}</span><span class="sp-step__title">${step.title}</span></div>
        <p class="sp-step__text">${step.text}</p>
        <div class="sp-step__art">${step.art}</div>
      </li>`,
    )
    .join('')}</ol>`;
}

function renderVariant(variant: Variant): void {
  mount(`
    ${head(variant)}
    ${
      variant.unsupported
        ? `<div class="sp-install__cta"><button class="sp-install__btn" type="button" data-copy>${ICON.link}<span>Link kopieren</span></button>${
            variant.continueAnyway
              ? `<button class="sp-install__plain" type="button" data-continue>Trotzdem im Browser weiter</button>`
              : ''
          }</div>`
        : `<div class="sp-install__cta" data-cta hidden>
             <button class="sp-install__btn" type="button" data-install>${ICON.download}<span>Spoonful installieren</span></button>
             <div class="sp-install__link">${ICON.plus}<span>Ein Tipp, den Rest macht der Browser</span></div>
           </div>`
    }
    ${stepsHtml(variant)}
    <div class="sp-install__foot">${ICON.home}<span>${variant.foot}</span></div>
  `);

  overlay?.querySelector('[data-install]')?.addEventListener('click', (event) =>
    void runInstallPrompt(event.currentTarget as HTMLButtonElement),
  );
  const copy = overlay?.querySelector<HTMLButtonElement>('[data-copy]');
  copy?.addEventListener('click', () =>
    void copyLink(copy, 'Kopiert. Jetzt in Chrome, Edge oder Safari einfügen'),
  );
  overlay
    ?.querySelector('[data-continue]')
    ?.addEventListener('click', () => continueInBrowser());

  if (deferredPrompt) showCta();
}

function renderInAppBrowser(): void {
  mount(`
    <div class="sp-install__head">
      <img class="sp-install__icon" src="${base}icon-192.png" alt="" width="74" height="74" />
      <div>
        <div class="sp-install__name">Spoonful</div>
        <div class="sp-install__tag">Web-App für iPhone, iPad, Android und PC</div>
      </div>
    </div>
    <h1 class="sp-install__title">Einmal im Browser öffnen, bitte.</h1>
    <p class="sp-install__lead">Du bist in einem In-App-Browser (zum Beispiel aus Instagram, WhatsApp oder einer Mail). Dort lässt sich Spoonful nicht installieren.</p>
    <ol class="sp-install__steps">
      <li class="sp-step">
        <div class="sp-step__head"><span class="sp-step__num">1</span><span class="sp-step__title">Link kopieren</span></div>
        <p class="sp-step__text">Mit dem Knopf unten landet die Adresse in der Zwischenablage.</p>
      </li>
      <li class="sp-step">
        <div class="sp-step__head"><span class="sp-step__num">2</span><span class="sp-step__title">Im Browser einfügen</span></div>
        <p class="sp-step__text">Oben in der Adressleiste einfügen und die Seite laden.</p>
      </li>
      <li class="sp-step">
        <div class="sp-step__head"><span class="sp-step__num">3</span><span class="sp-step__title">Anleitung im Browser folgen</span></div>
        <p class="sp-step__text">Dort zeigt Spoonful dann die Schritte für genau diesen Browser.</p>
      </li>
    </ol>
    <div class="sp-install__cta"><button class="sp-install__btn" type="button" data-copy>${ICON.link}<span>Link kopieren</span></button></div>
  `);

  const copy = overlay?.querySelector<HTMLButtonElement>('[data-copy]');
  copy?.addEventListener('click', () => void copyLink(copy, 'Kopiert. Jetzt im Browser einfügen'));
}

export function installAppPrompt(): void {
  if (typeof window === 'undefined') return;
  if (isStandalone()) return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
  try {
    if (sessionStorage.getItem(CONTINUE_KEY) === '1') return;
  } catch {
    // No storage, no memory of the choice. The guide simply shows again.
  }
  if (isInAppBrowser()) {
    renderInAppBrowser();
    return;
  }
  renderVariant(pickVariant());
}
