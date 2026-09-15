 /**
 * Baut den Stand „3.2.1“ aus dem aktuellen Arbeitsverzeichnis nach:
 * alle **3.2.2-Änderungen** werden entfernt (Funktionen), damit ein
 * Vergleichs-APK entsteht.
 *
 * Wichtig: Nur Funktionen werden zurückgebaut. Die Text-Aufräumung
 * (Übersetzungen) bleibt drin — sie ändert kein Verhalten.
 *
 * Aufruf:  node tools/make-321.mjs [--write]
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const WRITE = process.argv.includes('--write');
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
const write = (rel, text) => WRITE && writeFileSync(new URL(rel, ROOT), text, 'utf8');

/* ── 1. Dateien, die es in 3.2.1 nicht gab ───────────────────────────────── */
const DELETE = [
  'mobile/src/lib/image-url.ts',
  'mobile/src/lib/crash-log.ts',
  'mobile/src/lib/safe.ts',
  'mobile/src/lib/i18n-322.ts',
  'mobile/__tests__/stability.test.ts',
];

/* ── 2. CroppedImage + RecipeImage zurück auf den 3.2.1-Stand ─────────────── */
const CROPPED_IMAGE_321 = `import React, { useEffect, useState } from 'react';
import { Image, LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

import { clampCrop, getCrop, isCropDefault, type PhotoCrop } from '../lib/photo-crop';

export function CroppedImage({
  uri,
  source,
  style,
  imageStyle,
  resizeMode = 'cover',
  onError,
}: {
  uri?: string | null;
  /** eigene Bildquelle (z. B. mit Headern); sonst wird \`uri\` benutzt */
  source?: any;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onError?: () => void;
}) {
  const [crop, setCropState] = useState<PhotoCrop | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    let alive = true;
    if (!uri) {
      setCropState(null);
      return () => {
        alive = false;
      };
    }
    getCrop(uri).then((c) => {
      if (alive) setCropState(c);
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const active = crop && !isCropDefault(crop) && size.w > 0 && size.h > 0;
  const c = active ? clampCrop(crop as PhotoCrop) : null;

  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]} onLayout={onLayout}>
      {uri ? (
        <Image
          source={source ?? { uri }}
          resizeMode={resizeMode}
          onError={onError}
          style={[
            { width: '100%', height: '100%' },
            c
              ? {
                  width: size.w * c.zoom,
                  height: size.h * c.zoom,
                  transform: [
                    { translateX: (0.5 - c.fx) * size.w * c.zoom },
                    { translateY: (0.5 - c.fy) * size.h * c.zoom },
                  ],
                }
              : null,
            imageStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

export default CroppedImage;
`;

const RECIPE_IMAGE_321 = `import React, { useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { colors } from '../theme';
import { CroppedImage } from './CroppedImage';

/**
 * Recipe photo. When a real remote image exists and loads we show it;
 * otherwise a warm decorative plate tile (no emoji, per the design rules).
 */
export function RecipeImage({
  uri,
  style,
  imageStyle,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: object;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !uri || failed;

  const source = React.useMemo(
    () => (uri ? { uri, headers: { 'User-Agent': 'Spoonful/1.0 (Android; React Native recipe app)' } } : undefined),
    [uri],
  );

  return (
    <View
      style={[
        {
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showFallback ? (
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <G>
            <Circle cx="60" cy="60" r="42" fill={colors.accentTint} />
            <Circle cx="60" cy="60" r="34" fill={colors.card} />
            <Ellipse cx="60" cy="62" rx="26" ry="14" fill={colors.accentSoft} />
            <Path
              d="M60 60 q-26 -18 -4 -26 q22 -8 8 24 M60 60 q26 -18 4 -26 q-22 -8 -8 24"
              stroke={colors.accent}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
            <Circle cx="44" cy="78" r="1.6" fill={colors.accent} opacity="0.6" />
            <Circle cx="60" cy="82" r="2" fill={colors.accent} opacity="0.45" />
            <Circle cx="74" cy="77" r="1.4" fill={colors.accent} opacity="0.55" />
          </G>
        </Svg>
      ) : (
        <CroppedImage uri={uri} source={source} style={{ width: '100%', height: '100%' }} imageStyle={imageStyle} onError={() => setFailed(true)} />
      )}
    </View>
  );
}

export default RecipeImage;
`;

/* ── 3. Funktionale 3.2.2-Änderungen zurücknehmen ────────────────────────── */
const REPLACEMENTS = {
  'mobile/src/lib/i18n.tsx': [
    ["import { APP_322 } from './i18n-322';\n", ''],
    [', mergeDict(mergeDict(APP_322[lang] ?? {}, I18N_TEXTS[lang] ?? {}), I18N_TEXTS_EXTRA[lang] ?? {})', ', I18N_TEXTS[lang] ?? {}'],
  ],
  'mobile/App.tsx': [
    ["import { hydrateCrashLog, installGlobalErrorHandler, recordError } from './src/lib/crash-log';\n", ''],
    ['// 3.2.2: globale JS-Fehler mitprotokollieren (Absturz-Spur für die Einstellungen).\ninstallGlobalErrorHandler();\n', ''],
    ['    void hydrateCrashLog();\n', ''],
    ["  componentDidCatch(error: unknown) {\n    recordError('screen', error);\n  }\n", ''],
  ],
  'mobile/src/screens/SettingsScreen.tsx': [
    ["import { clearCrashLog, getCrashLog, subscribeCrashLog } from '../lib/crash-log';\n", ''],
    ['/**\n * 3.2.2: Einstellungen abonnieren das Absturz-Protokoll — so erscheint ein\n * neuer Fehler sofort in der Liste, ohne dass etwas neu geladen werden muss.\n */\nfunction useCrashLog() {\n  return useSyncExternalStore(subscribeCrashLog, getCrashLog, getCrashLog);\n}\n\n', ''],
    ['  const errors = useCrashLog();\n', ''],
    ["import React, { useEffect, useState, useSyncExternalStore } from 'react';", "import React, { useEffect, useState } from 'react';"],
  ],
  'mobile/src/lib/api.ts': [
    [
      "    // 3.2.2: gleiche Zutat nicht doppelt anlegen (Punkt 82 der Stabilitäts-Liste).\n    // Doppelte innerhalb der Anfrage und gegenüber der offenen Liste fallen raus.\n    const wanted = new Map<string, any>();\n    for (const it of items) {\n      const name = String(it?.name ?? '').trim();\n      if (!name) continue;\n      const key = name.toLowerCase();\n      if (!wanted.has(key)) wanted.set(key, { ...it, name });\n    }\n    if (!wanted.size) return [];\n    let have = new Set<string>();\n    try {\n      const { data: existing } = await supabase.from('shopping_list_items').select('name').eq('checked', false);\n      have = new Set((existing ?? []).map((r: any) => String(r?.name ?? '').trim().toLowerCase()));\n    } catch {\n      /* Wenn die Liste nicht lesbar ist, wird trotzdem eingetragen */\n    }\n    const rows = [...wanted.entries()]\n      .filter(([key]) => !have.has(key))\n      .map(([, it]: any) => ({\n        user_id: uid,\n        name: it?.name ?? '',\n        recipe_key: it?.recipeKey ?? null,\n        recipe_title: it?.recipeTitle ?? null,\n        checked: false,\n        created_at: t,\n      }));",
      "    const rows = items.map((it) => ({\n      user_id: uid,\n      name: it?.name ?? '',\n      recipe_key: it?.recipeKey ?? null,\n      recipe_title: it?.recipeTitle ?? null,\n      checked: false,\n      created_at: t,\n    }));",
    ],
  ],
  'mobile/src/lib/household.ts': [
    [
      "/**\n * Teilt eine Liste mit dem Haushalt. Wirft bei \"limit reached\" (2 Listen).\n *\n * 3.2.2: Doppel-Tipp-Schutz (Punkt 85). Vorher konnte ein zweites Tippen\n * parallel dieselbe Liste anlegen — dann stand sie zweimal im Haushalt.\n */\nlet shareInFlight = false;\n\nexport async function shareHouseholdList(title: string, items: HhShoppingItem[]): Promise<{ ok: boolean; error?: string }> {\n  if (shareInFlight) return { ok: false, error: 'busy' };\n  shareInFlight = true;\n  try {",
      "/** Teilt eine Liste mit dem Haushalt. Wirft bei \"limit reached\" (2 Listen). */\nexport async function shareHouseholdList(title: string, items: HhShoppingItem[]): Promise<{ ok: boolean; error?: string }> {\n  try {",
    ],
    ['    return { ok: false, error: String(e?.message ?? e) };\n  } finally {\n    shareInFlight = false;\n  }\n}', '    return { ok: false, error: String(e?.message ?? e) };\n  }\n}'],
  ],
  'mobile/src/lib/ai.ts': [
    ["import { withTimeout } from './safe';\n\n/** 3.2.2: Obergrenze für einen KI-Aufruf. */\nconst AI_TIMEOUT_MS = 60000;\n", ''],
    [
      "  const { data, error } = await withTimeout(\n    supabase.functions.invoke('ai', {\n      body: {\n        system,\n        user,\n        temperature: Math.max(0, Math.min(1.2, Number(temperature) || 0.7)),\n      },\n    }),\n    AI_TIMEOUT_MS,\n    'Die KI hat zu lange gebraucht.',\n  );",
      "  const { data, error } = await supabase.functions.invoke('ai', {\n    body: {\n      system,\n      user,\n      temperature: Math.max(0, Math.min(1.2, Number(temperature) || 0.7)),\n    },\n  });",
    ],
  ],
  'mobile/src/components/BarcodeScannerModal.tsx': [
    [
      "  /**\n   * 3.2.2: Der Live-Scanner schließt sich nach 45 Sekunden von selbst\n   * (Punkt 12). Vorher lief die Kamera weiter, wenn man das Popup einfach\n   * liegen ließ — das kostet Akku und kann den Speicher voll laufen lassen.\n   */\n  useEffect(() => {\n    if (!visible || !live || busy) return;\n    const timer = setTimeout(() => onClose(), 45000);\n    return () => clearTimeout(timer);\n  }, [visible, live, busy, onClose]);\n\n",
      '',
    ],
  ],
  'mobile/src/screens/CookingScreen.tsx': [
    [
      "  /**\n   * 3.2.2: Wenn eine Sitzung fortgesetzt wurde, sagen wir es kurz (Punkt 84).\n   * Vorher sprang der Kochmodus wortlos mitten in die Schritte — das wirkte\n   * wie ein Fehler.\n   */\n  const [resumedAt, setResumedAt] = useState<number | null>(null);\n",
      '',
    ],
    [
      "        if (typeof s.index === 'number') {\n          const next = Math.max(0, Math.min(total - 1, s.index));\n          setIndex(next);\n          if (next > 0) setResumedAt(next + 1);\n        }",
      "        if (typeof s.index === 'number') setIndex(Math.max(0, Math.min(total - 1, s.index)));",
    ],
    [
      "          {/* 3.2.2: kurzer Hinweis, dass eine alte Sitzung weiterläuft (Punkt 84) */}\n          {resumedAt ? (\n            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t('s.cookResume', { n: resumedAt })}</Text>\n          ) : null}\n",
      '',
    ],
  ],
  'mobile/src/screens/TrackerScreen.tsx': [
    ['setAgeT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 150) updateProfile({ age: n });', 'setAgeT(v); const n = Number(v); if (Number.isFinite(n) && n > 0 && n < 150) updateProfile({ age: Math.round(n) });'],
    ['setHeightT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 250) updateProfile({ height: n });', 'setHeightT(v); const n = Number(v); if (Number.isFinite(n) && n > 0 && n < 250) updateProfile({ height: Math.round(n) });'],
    ["setWeightT(v); const n = parseNum(v); if (n !== undefined && n > 0 && n < 300) updateProfile({ weight: n });", "setWeightT(v); const n = Number(v.replace(',', '.')); if (Number.isFinite(n) && n > 0 && n < 300) updateProfile({ weight: Math.round(n * 10) / 10 });"],
  ],
  'mobile/src/screens/LibraryScreen.tsx': [[' thumbWidth={single ? 420 : 260}', '']],
  'mobile/src/screens/MyRecipesScreen.tsx': [[' thumbWidth={110}', '']],
  'mobile/src/screens/CommunityScreen.tsx': [[' thumbWidth={460}', ''], [' thumbWidth={340}', '']],
  'mobile/src/screens/MonstrScreen.tsx': [
    ['  formatValidity,\n', ''],
    ["{[deal.market, size, formatValidity(deal)].filter(Boolean).join(' · ')}", "{[deal.market, size].filter(Boolean).join(' · ')}"],
  ],
  'mobile/src/lib/offline.tsx': [
    ["import { useTranslation } from './i18n';\n", ''],
    [
      "  /**\n   * 3.2.2: „Offline\" allein sagt nichts über die Arbeit, die noch wartet.\n   * Jetzt steht die Anzahl dabei (\"Offline · 3 Änderungen warten\") — so weiß\n   * man, dass nichts verloren ist (Punkt 71 der Stabilitäts-Liste).\n   */\n  const { t } = useTranslation();\n  const pending = useSyncExternalStore(subscribePendingOps, pendingOpsCount, pendingOpsCount);\n",
      '',
    ],
    ["  const label = pending > 0 ? `Offline · ${t('s.offlinePending', { n: pending })}` : 'Offline';\n", ''],
    ['      {label}\n', '      Offline\n'],
  ],
  'mobile/android/app/build.gradle': [['versionCode 13\n        versionName "3.2.2"', 'versionCode 12\n        versionName "3.2.1"']],
  'mobile/src/config.ts': [["export const APP_VERSION = '3.2.2';", "export const APP_VERSION = '3.2.1';"]],
};

/* ── 4. Ablauf ───────────────────────────────────────────────────────────── */
let changed = 0;
let missing = 0;

for (const rel of DELETE) {
  if (existsSync(new URL(rel, ROOT))) {
    if (WRITE) unlinkSync(new URL(rel, ROOT));
    changed += 1;
    console.log(`gelöscht: ${rel}`);
  }
}

if (WRITE) {
  writeFileSync(new URL('mobile/src/components/CroppedImage.tsx', ROOT), CROPPED_IMAGE_321, 'utf8');
  writeFileSync(new URL('mobile/src/components/RecipeImage.tsx', ROOT), RECIPE_IMAGE_321, 'utf8');
}
changed += 2;
console.log('zurückgesetzt: CroppedImage.tsx, RecipeImage.tsx');

for (const [rel, pairs] of Object.entries(REPLACEMENTS)) {
  const url = new URL(rel, ROOT);
  if (!existsSync(url)) continue;
  // Zeilenenden vereinheitlichen - die Dateien sind gemischt (LF/CRLF).
  let text = readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      console.log(`FEHLT ${rel}: ${from.slice(0, 60)}…`);
      missing += 1;
      continue;
    }
    text = text.split(from).join(to);
    changed += 1;
  }
  if (WRITE) writeFileSync(url, text, 'utf8');
}

/* Absturz-Bereich in den Einstellungen entfernen (ganzer Block). */
const settingsUrl = new URL('mobile/src/screens/SettingsScreen.tsx', ROOT);
let settings = readFileSync(settingsUrl, 'utf8');
const start = settings.indexOf('        {/* 3.2.2: Absturz-Protokoll');
const end = settings.indexOf("© 2026 Spoonful");
if (start >= 0 && end > start) {
  settings = settings.slice(0, start) + settings.slice(settings.lastIndexOf('<Text', end));
  if (WRITE) writeFileSync(settingsUrl, settings, 'utf8');
  changed += 1;
  console.log('entfernt: Absturz-Bereich in den Einstellungen');
} else {
  console.log('FEHLT: Absturz-Bereich in den Einstellungen');
  missing += 1;
}

console.log(`\n${changed} Änderungen ${WRITE ? 'geschrieben' : 'geplant'}, ${missing} fehlend.`);
process.exit(missing > 0 ? 1 : 0);


