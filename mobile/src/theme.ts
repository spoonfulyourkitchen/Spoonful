import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ============================================================================
   Spoonful RN theme engine.
   Mirrors the web app: 20 selectable themes applied as opaque tokens,
   persisted under "spoonful-theme-id". Default theme is Warm Cream.
   ========================================================================== */

export type ThemeDef = {
  id: string;
  name: string;
  tagline: string;
  colors: string[];
  dark: boolean;
  bodyBg: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  accentText: string;
  headerBg: string;
  bottomBarBg: string;
};

export const THEME_STORAGE_KEY = 'spoonful-theme-id';

export const themes: ThemeDef[] = [
  { id: 'warm-cream', name: 'Warm Cream', tagline: 'The original warm kitchen feel', colors: ['#f8f5f0', '#d4a574', '#7c5a3c', '#ffffff', '#f5e6d3'], dark: false, bodyBg: '#f8f5f0', textPrimary: '#33291f', textSecondary: '#6f6252', cardBg: '#fffdf9', cardBorder: 'rgba(255,255,255,0.85)', accent: '#92400e', accentText: '#fffdfa', headerBg: '#f8f5f0', bottomBarBg: '#ffffff' },
  { id: 'dark-mode', name: 'Midnight', tagline: 'Deep dark, easy on the eyes', colors: ['#0f172a', '#1e293b', '#f8fafc', '#38bdf8', '#334155'], dark: true, bodyBg: '#0f172a', textPrimary: '#f1f5f9', textSecondary: '#94a3b8', cardBg: '#1e293b', cardBorder: 'rgba(148,163,184,0.16)', accent: '#38bdf8', accentText: '#0f172a', headerBg: '#0f172a', bottomBarBg: '#0f172a' },
  { id: 'ocean-teal', name: 'Ocean', tagline: 'Cool teal and sandy warmth', colors: ['#f0fdfa', '#0d9488', '#134e4a', '#ffffff', '#ccfbf1'], dark: false, bodyBg: '#f0fdfa', textPrimary: '#134e4a', textSecondary: '#0f766e', cardBg: '#ffffff', cardBorder: 'rgba(204,251,241,0.8)', accent: '#0d9488', accentText: '#ffffff', headerBg: '#f0fdfa', bottomBarBg: '#ffffff' },
  { id: 'forest', name: 'Forest', tagline: 'Deep green, earthy tones', colors: ['#f0fdf4', '#16a34a', '#14532d', '#ffffff', '#dcfce7'], dark: false, bodyBg: '#f0fdf4', textPrimary: '#14532d', textSecondary: '#15803d', cardBg: '#ffffff', cardBorder: 'rgba(220,252,231,0.8)', accent: '#16a34a', accentText: '#ffffff', headerBg: '#f0fdf4', bottomBarBg: '#ffffff' },
  { id: 'sunset', name: 'Sunset', tagline: 'Warm orange and golden hour vibes', colors: ['#fff7ed', '#ea580c', '#7c2d12', '#ffffff', '#fed7aa'], dark: false, bodyBg: '#fff7ed', textPrimary: '#7c2d12', textSecondary: '#9a3412', cardBg: '#ffffff', cardBorder: 'rgba(254,215,170,0.8)', accent: '#ea580c', accentText: '#ffffff', headerBg: '#fff7ed', bottomBarBg: '#ffffff' },
  { id: 'lavender', name: 'Lavender', tagline: 'Soft purple, calm and elegant', colors: ['#faf5ff', '#9333ea', '#581c87', '#ffffff', '#e9d5ff'], dark: false, bodyBg: '#faf5ff', textPrimary: '#581c87', textSecondary: '#7e22ce', cardBg: '#ffffff', cardBorder: 'rgba(233,213,255,0.8)', accent: '#9333ea', accentText: '#ffffff', headerBg: '#faf5ff', bottomBarBg: '#ffffff' },
  { id: 'rose-gold', name: 'Rose Gold', tagline: 'Blush pink with metallic warmth', colors: ['#fff5f6', '#be185d', '#881337', '#ffffff', '#fbcfe8'], dark: false, bodyBg: '#fff5f6', textPrimary: '#881337', textSecondary: '#9f1239', cardBg: '#ffffff', cardBorder: 'rgba(251,207,232,0.8)', accent: '#be185d', accentText: '#ffffff', headerBg: '#fff5f6', bottomBarBg: '#ffffff' },
  { id: 'arctic', name: 'Arctic', tagline: 'Clean white with icy blue accents', colors: ['#f8fafc', '#0284c7', '#0c4a6e', '#ffffff', '#bae6fd'], dark: false, bodyBg: '#f8fafc', textPrimary: '#0c4a6e', textSecondary: '#0369a1', cardBg: '#ffffff', cardBorder: 'rgba(186,230,253,0.7)', accent: '#0284c7', accentText: '#ffffff', headerBg: '#f8fafc', bottomBarBg: '#ffffff' },
  { id: 'coffee', name: 'Coffee', tagline: 'Rich brown, like your morning brew', colors: ['#f6ecdd', '#78350f', '#3b2416', '#ffffff', '#e7c9a8'], dark: false, bodyBg: '#f6ecdd', textPrimary: '#3b2416', textSecondary: '#6b4a2f', cardBg: '#fffdf9', cardBorder: 'rgba(231,201,168,0.65)', accent: '#78350f', accentText: '#fffdfa', headerBg: '#f6ecdd', bottomBarBg: '#ffffff' },
  { id: 'olive', name: 'Olive', tagline: 'Muted green, Mediterranean kitchen', colors: ['#f9fafb', '#65a30d', '#365314', '#ffffff', '#d9f99d'], dark: false, bodyBg: '#f9fafb', textPrimary: '#365314', textSecondary: '#3f6212', cardBg: '#ffffff', cardBorder: 'rgba(217,249,157,0.7)', accent: '#4d7c0f', accentText: '#ffffff', headerBg: '#f9fbfb', bottomBarBg: '#ffffff' },
  { id: 'coral', name: 'Coral', tagline: 'Warm coral reef tones', colors: ['#fff0ed', '#e11d48', '#9f1239', '#ffffff', '#ffd0c8'], dark: false, bodyBg: '#fff0ed', textPrimary: '#9f1239', textSecondary: '#be185d', cardBg: '#ffffff', cardBorder: 'rgba(255,208,200,0.8)', accent: '#e11d48', accentText: '#ffffff', headerBg: 'rgba(255,240,237,0.8)', bottomBarBg: '#ffffff' },
  { id: 'slate-minimal', name: 'Slate', tagline: 'Clean, minimal, professional', colors: ['#f8fafc', '#475569', '#0f172a', '#ffffff', '#cbd5e1'], dark: false, bodyBg: '#f8fafc', textPrimary: '#0f172a', textSecondary: '#475569', cardBg: '#ffffff', cardBorder: 'rgba(203,213,225,0.6)', accent: '#475569', accentText: '#ffffff', headerBg: '#f8fafc', bottomBarBg: '#ffffff' },
  { id: 'champagne', name: 'Champagne', tagline: 'Luxurious gold on cream', colors: ['#fefce8', '#ca8a04', '#713f12', '#ffffff', '#fef08a'], dark: false, bodyBg: '#fefce8', textPrimary: '#713f12', textSecondary: '#a16207', cardBg: '#ffffff', cardBorder: 'rgba(254,240,138,0.6)', accent: '#a16207', accentText: '#ffffff', headerBg: '#fefce8', bottomBarBg: '#ffffff' },
  { id: 'sage', name: 'Sage', tagline: 'Soft green, modern and calm', colors: ['#f1f5f0', '#4d7c0f', '#365314', '#ffffff', '#d9f99d'], dark: false, bodyBg: '#f1f5f0', textPrimary: '#365314', textSecondary: '#3f6212', cardBg: '#ffffff', cardBorder: 'rgba(217,249,157,0.5)', accent: '#4d7c0f', accentText: '#ffffff', headerBg: '#f1f5f0', bottomBarBg: '#ffffff' },
  { id: 'terracotta', name: 'Terracotta', tagline: 'Earthy clay, warm and grounding', colors: ['#fef2f0', '#c2410c', '#7c2d12', '#ffffff', '#fed7aa'], dark: false, bodyBg: '#fef2f0', textPrimary: '#7c2d12', textSecondary: '#9a3412', cardBg: '#fffdf9', cardBorder: 'rgba(254,215,170,0.7)', accent: '#c2410c', accentText: '#ffffff', headerBg: '#fef2f0', bottomBarBg: '#ffffff' },
  { id: 'nordic', name: 'Nordic', tagline: 'Cool Scandinavian minimalism', colors: ['#eef2f6', '#526d82', '#1e293b', '#ffffff', '#d7e0e8'], dark: false, bodyBg: '#eef2f6', textPrimary: '#1e293b', textSecondary: '#475569', cardBg: '#f8fafc', cardBorder: '#d7e0e8', accent: '#526d82', accentText: '#ffffff', headerBg: 'rgba(238,242,246,0.85)', bottomBarBg: '#ffffff' },
  { id: 'honey', name: 'Honey', tagline: 'Sweet amber, golden warmth', colors: ['#fffbeb', '#d97706', '#78350f', '#ffffff', '#fde68a'], dark: false, bodyBg: '#fffbeb', textPrimary: '#78350f', textSecondary: '#92400e', cardBg: '#ffffff', cardBorder: 'rgba(253,230,138,0.7)', accent: '#d97706', accentText: '#ffffff', headerBg: 'rgba(255,251,235,0.8)', bottomBarBg: '#ffffff' },
  { id: 'charcoal', name: 'Charcoal', tagline: 'Sleek dark, warm amber accents', colors: ['#18181b', '#27272a', '#fafafa', '#fbbf24', '#3f3f46'], dark: true, bodyBg: '#18181b', textPrimary: '#fafafa', textSecondary: '#a1a1aa', cardBg: '#27272a', cardBorder: 'rgba(161,161,170,0.16)', accent: '#fbbf24', accentText: '#18181b', headerBg: '#18181b', bottomBarBg: '#18181b' },
  { id: 'plum', name: 'Plum', tagline: 'Rich purple, regal and bold', colors: ['#faf5ff', '#7e22ce', '#581c87', '#ffffff', '#d8b4fe'], dark: false, bodyBg: '#faf5ff', textPrimary: '#581c87', textSecondary: '#7e22ce', cardBg: '#ffffff', cardBorder: 'rgba(216,180,254,0.6)', accent: '#7e22ce', accentText: '#ffffff', headerBg: '#faf5ff', bottomBarBg: '#ffffff' },
  { id: 'berry-dark', name: 'Berry Dark', tagline: 'Deep plum with berry accents', colors: ['#1a1025', '#2d1b4e', '#f5f0ff', '#c084fc', '#3b2560'], dark: true, bodyBg: '#1a1025', textPrimary: '#f5f0ff', textSecondary: '#a78bfa', cardBg: '#2d1b4e', cardBorder: 'rgba(167,139,250,0.16)', accent: '#c084fc', accentText: '#1a1025', headerBg: '#1a1025', bottomBarBg: '#1a1025' },
];

/* ------------------- color math (hex / rgb / rgba) ----------------------- */

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(color: string): RGBA | null {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] !== undefined ? Number(m[4]) : 1 };
  }
  const hex = color.trim().replace('#', '');
  if (hex.length === 3) {
    return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: 1 };
  }
  if (hex.length === 6) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }
  return null;
}

function flattenOver(cardColor: string, bodyColor: string): string {
  const card = parseColor(cardColor);
  const body = parseColor(bodyColor);
  if (!card || !body) return cardColor;
  const r = Math.round(card.r * card.a + body.r * (1 - card.a));
  const g = Math.round(card.g * card.a + body.g * (1 - card.a));
  const b = Math.round(card.b * card.a + body.b * (1 - card.a));
  return `rgb(${r}, ${g}, ${b})`;
}

function rgba(c: RGBA, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** Relative luminance (0..1) of a color – used to pick readable button text. */
function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0;
  const f = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Mix two colors (0 = a, 1 = b) so call buttons can follow the theme accent. */
function mix(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  const r = Math.round(x.r + (y.r - x.r) * t);
  const g = Math.round(x.g + (y.g - x.g) * t);
  const bl = Math.round(x.b + (y.b - x.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function readableText(bg: string): string {
  // Pick whichever of black/white has the higher contrast ratio - a fixed
  // luminance threshold picked white on e.g. #38bdf8 or #c084fc, which is
  // exactly what made buttons unreadable in some themes.
  const l = luminance(bg);
  const contrastWithDark = (l + 0.05) / 0.0566; // #141414
  const contrastWithWhite = 1.05 / (l + 0.05);
  return contrastWithDark >= contrastWithWhite ? '#141414' : '#ffffff';
}

/** WCAG contrast ratio between two colours. */
function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const MIN_BUTTON_CONTRAST = 4.5;

/**
 * Nudges a surface away from its text colour until the contrast is guaranteed.
 * This is what makes the button design safe in *every* theme: a pale accent
 * gets a touch darker, a bright one a touch lighter, until text on it is
 * readable - no per-theme hand tuning needed.
 */
function surfaceForContrast(bg: string, text: string, min = MIN_BUTTON_CONTRAST): string {
  let out = bg;
  if (contrastRatio(out, text) >= min) return out;
  const dir = text === '#ffffff' ? '#000000' : '#ffffff';
  for (let step = 1; step <= 25 && contrastRatio(out, text) < min; step += 1) {
    out = mix(bg, dir, step * 0.02);
  }
  return out;
}

/** Keeps a preferred foreground colour but darkens/lightens it to stay readable. */
function foregroundOn(bg: string, preferred: string, min = MIN_BUTTON_CONTRAST): string {
  if (contrastRatio(bg, preferred) >= min) return preferred;
  const dir = luminance(bg) > 0.2 ? '#000000' : '#ffffff';
  let out = preferred;
  for (let step = 1; step <= 25 && contrastRatio(bg, out) < min; step += 1) {
    out = mix(preferred, dir, step * 0.04);
  }
  return contrastRatio(bg, out) >= min ? out : readableText(bg);
}

export function themeById(id: string): ThemeDef {
  return themes.find((t) => t.id === id) || themes[0];
}

/* ---------------------------------------------------------------------------
   Palette — concrete tokens consumed by every component. `colors` is mutated
   in place by applyTheme() so components reading `colors.*` during render see
   the active theme (the root navigator is re-keyed on theme change).
   ------------------------------------------------------------------------- */

export type Palette = {
  id: string;
  dark: boolean;
  bg: string;
  bgSoft: string;
  card: string;
  surfaceMuted: string;
  cardBorder: string;
  accent: string;
  accentStrong: string;
  accentText: string;
  accentSoft: string;
  accentTint: string;
  accentBorder: string;
  amber100: string;
  amber200: string;
  amber700: string;
  amber800: string;
  brandOrange: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  slate950: string;
  slate900: string;
  slate800: string;
  slate700: string;
  slate600: string;
  slate500: string;
  slate400: string;
  white: string;
  darkButton: string;
  darkButtonText: string;
  darkButtonPressed: string;
  success: string;
  successBg: string;
  rose: string;
  roseBg: string;
  danger: string;
  cyan: string;
  cyanBg: string;
  easy: string;
  easyBg: string;
  medium: string;
  mediumBg: string;
  hard: string;
  amber: string;
  hardBg: string;
  header: string;
  bottomBar: string;
  shadowStrong: string;
  shadowSoft: string;
  /* ---------- Helper-Keys ---------- */
  overlayMuted: string;    /* Halbtransparentes Overlay (z.B. Modal-Hintergrund) */
  overlayStrong: string;   /* Stärkeres Overlay (z.B. Vollbild-Modal) */
  borderSolid: string;     /* 1px feste Border-Farbe */
  borderStrong: string;    /* 2px starke Border-Farbe */
  muted: string;           /* Dezente Text-/Trennfarbe */
  mutedSoft: string;       /* Noch dezenter, z.B. für kleine Labels */
  pageBg: string;          /* Seiten-Hintergrund (Library, Rezept-Detail) */
};

function computePalette(theme: ThemeDef): Palette {
  const card = flattenOver(theme.cardBg, theme.bodyBg);
  const header = flattenOver(theme.headerBg, theme.bodyBg);
  const bottomBar = flattenOver(theme.bottomBarBg, theme.bodyBg);
  const borderSolid = flattenOver(theme.cardBorder, card);
  const accentRgba = parseColor(theme.accent) || { r: 146, g: 64, b: 14, a: 1 };
  const accentSoft = flattenOver(rgba(accentRgba, 0.12), theme.bodyBg);
  const accentSofter = flattenOver(rgba(accentRgba, 0.08), theme.bodyBg);
  const accentTint = flattenOver(rgba(accentRgba, 0.16), theme.bodyBg);
  // Never trust the hand-written accentText: pick black or white by luminance
  // so text on an accent surface is readable in every theme.
  const accentTextSafe = readableText(theme.accent);
  // the accent surface is nudged until that text is guaranteed readable
  const accentSurface = surfaceForContrast(theme.accent, accentTextSafe);
  // Visible button/UI stroke. Many light themes define `cardBorder` as a
  // translucent white (a glass highlight), which is invisible when used as a
  // border on a light page - that is what made buttons look "broken" there.
  const textRgba = parseColor(theme.textPrimary) || { r: 0, g: 0, b: 0, a: 1 };
  const strokeColor = flattenOver(rgba(textRgba, theme.dark ? 0.22 : 0.16), theme.bodyBg);
  const dark = theme.dark;
  /** Opaque tint of a status colour, blended over the page background. */
  const tint = (r: number, g: number, b: number, alpha: number) =>
    flattenOver(rgba({ r, g, b, a: 1 }, alpha), theme.bodyBg);

  // Status surfaces first, then a foreground that is guaranteed readable on it
  const successBg = dark ? tint(22, 163, 74, 0.18) : '#d1fae5';
  const roseBg = dark ? tint(225, 29, 72, 0.18) : '#ffe4e6';
  const cyanBg = dark ? tint(14, 116, 144, 0.2) : '#cffafe';
  const mediumBg = dark ? tint(234, 179, 8, 0.18) : '#fef3c7';

  return {
    id: theme.id,
    dark: theme.dark,
    bg: theme.bodyBg,
    bgSoft: card,
    card,
    surfaceMuted: accentSofter,
    cardBorder: strokeColor,
    accent: accentSurface,
    accentStrong: accentSurface,
    accentText: accentTextSafe,
    accentSoft,
    accentTint,
    accentBorder: accentSurface,
    amber100: accentSoft,
    amber200: flattenOver(rgba(accentRgba, 0.26), theme.bodyBg),
    amber700: theme.accent,
    amber800: flattenOver(rgba(accentRgba, 0.9), '#000000'),
    brandOrange: '#E8722A',
    text: theme.textPrimary,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    textMuted: theme.textSecondary,
    slate950: theme.textPrimary,
    slate900: theme.textPrimary,
    slate800: theme.textPrimary,
    slate700: theme.textPrimary,
    slate600: theme.textSecondary,
    slate500: theme.textSecondary,
    slate400: theme.textSecondary,
    white: '#ffffff',
    // Definitive button design (same rules for every theme):
    //  · primary  = the theme accent, text picked by luminance (never white on
    //    a pale accent, never black on a dark one)
    //  · pressed  = same accent, darkened a touch
    //  · secondary= surfaceMuted tint + the visible `cardBorder` stroke
    //  · ghost    = the card surface, textPrimary
    darkButton: accentSurface,
    darkButtonText: accentTextSafe,
    // pressed stays readable: darker when the label is white, lighter when dark
    darkButtonPressed: surfaceForContrast(
      mix(accentSurface, accentTextSafe === '#ffffff' ? '#000000' : '#ffffff', 0.14),
      accentTextSafe,
    ),
    // Status colours follow the theme as well: light themes use soft pastel
    // backgrounds with deep foregrounds, dark themes a translucent tint of the
    // same hue over the page background with a light foreground. Without this
    // those buttons/chips stayed bright in dark themes.
    success: foregroundOn(successBg, dark ? '#4ade80' : '#15803d'),
    successBg,
    rose: foregroundOn(roseBg, dark ? '#fb7185' : '#be123c'),
    roseBg,
    danger: foregroundOn(roseBg, dark ? '#f87171' : '#b91c1c'),
    cyan: foregroundOn(cyanBg, dark ? '#22d3ee' : '#155e75'),
    cyanBg,
    amber: foregroundOn(mediumBg, dark ? '#facc15' : '#a16207'),
    easy: foregroundOn(successBg, dark ? '#34d399' : '#15803d'),
    easyBg: successBg,
    medium: foregroundOn(mediumBg, dark ? '#fbbf24' : '#92400e'),
    mediumBg,
    hard: foregroundOn(roseBg, dark ? '#fb7185' : '#be123c'),
    hardBg: roseBg,
    header,
    bottomBar,
    shadowStrong: 'rgba(48,87,105,0.14)',
    shadowSoft: 'rgba(0,0,0,0.06)',
    /* ---------- Helper-Keys ---------- */
    overlayMuted: rgba({ r: 0, g: 0, b: 0, a: 1 }, 0.28),
    overlayStrong: rgba({ r: 0, g: 0, b: 0, a: 1 }, 0.65),
    borderSolid: strokeColor,
    borderStrong: flattenOver(rgba(accentRgba, 0.34), theme.bodyBg),
    muted: theme.textSecondary,
    mutedSoft: theme.dark ? theme.textSecondary : '#94a3b8',
    pageBg: theme.dark ? theme.bodyBg : theme.bodyBg,
  };
}

let currentTheme: ThemeDef = themes[0];
export const colors: Palette = computePalette(currentTheme);

let themeVersion = 0;
const themeListeners = new Set<() => void>();
export function subscribeTheme(fn: () => void): () => void {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
}
export function getThemeVersion(): number {
  return themeVersion;
}
function notifyThemeChanged() {
  themeVersion += 1;
  themeListeners.forEach((fn) => fn());
}

export function getThemeId(): string {
  return currentTheme.id;
}
export function isDarkTheme(): boolean {
  return currentTheme.dark;
}

export function applyTheme(themeId: string) {
  const theme = themeById(themeId);
  currentTheme = theme;
  Object.assign(colors, computePalette(theme));
  try {
    AsyncStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch { /* ignore */ }
  notifyThemeChanged();
}

export async function loadStoredThemeId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored && themes.some((t) => t.id === stored)) return stored;
  } catch { /* ignore */ }
  return 'warm-cream';
}

/* ---------------------------------------------------------------------------
   Typography. Web uses Playfair Display (display) + Inter (body). The RN app
   falls back to a platform serif until the real TTFs are added under
   android/app/src/main/assets/fonts (then set the two names below).
   ------------------------------------------------------------------------- */

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string | undefined,
  body: undefined as string | undefined,
};

/* ---------------------------------------------------------------------------
   Shared helpers (kept API-compatible for existing call sites).
   ------------------------------------------------------------------------- */

export function difficultyColor(level: 'easy' | 'medium' | 'hard' | string) {
  if (level === 'easy') return { fg: colors.easy, bg: colors.easyBg };
  if (level === 'hard') return { fg: colors.hard, bg: colors.hardBg };
  return { fg: colors.medium, bg: colors.mediumBg };
}

/* ---------- Helper-Farben (können auch direkt genutzt werden) ---------- */
export function rgbaHelper(hex: string, alpha: number) {
  const c = parseColor(hex) || { r: 0, g: 0, b: 0, a: 1 };
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/** Layered soft, cool-toned shadow used by Spoonful glass panels. */
export function glassShadow(level: 'sm' | 'md' | 'lg' | 'xl' = 'md') {
  const map = {
    sm: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    md: { shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
    lg: { shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 6 },
    xl: { shadowOpacity: 0.16, shadowRadius: 40, shadowOffset: { width: 0, height: 22 }, elevation: 10 },
  } as const;
  return { shadowColor: colors.shadowStrong, ...map[level] };
}
