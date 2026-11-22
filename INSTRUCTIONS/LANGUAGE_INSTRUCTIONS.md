# Spoonful — Sprachen hinzufügen (Language Instructions)

Gültig ab 3.5.0. Verbindlich für jede KI/jeden Entwickler, der Sprachen
hinzufügt oder Texte übersetzt. **Kein** hartcodierter Text in der App — alles
läuft über `t('…')`-Tags und die Wörterbücher. Wenn jemand sagt: *"Füge 10
Sprachen hinzu"*, dann ist **hier** beschrieben, was überall zu tun ist.

> Faustregel: Eine Sprache ist erst fertig, wenn (1) das UI übersetzt ist,
> (2) die **Live-Rezeptübersetzung** (Library-Button) die Sprache kennt und
> (3) alle Prüfungen unten grün sind.

---

## 1. Aktuelle Sprachen (16)

`en, de, ar, fr, es, it, tr, pt, nl, ru, uk, zh, ja, ko, hi, pl`

- RTL: nur `ar` (siehe `RTL_LANGUAGES`).
- `en` ist immer der letzte Fallback. Jeder Key **soll** in jeder Sprache
  existieren; fehlt er, greift Englisch.

---

## 2. Wo Sprachen registriert sind

| Datei | Rolle |
|---|---|
| `mobile/src/lib/i18n.tsx` | `Language`-Union, `LANGUAGES`-Liste, `RTL_LANGUAGES`, `baseDicts`, Merge-Kette |
| `mobile/src/lib/i18n-langs35.ts` | Wörterbuch der 3.5.0-Sprachen (zh, ja, ko, hi, pl) |
| `mobile/src/lib/i18n-ui.ts` | `UI_L10N` — `ui`-Namespace (Einstellungen, Benachrichtigungen, Hilfe, Gefahrenzone) |
| `mobile/src/lib/i18n-screens.ts` | `SCREENS_L10N` — `s`-Namespace (Screen-Tags) |
| `mobile/src/lib/i18n-350.ts` | v3.5-Keys (Sammlungen, Haushalts-QR) für die 11 Basissprachen |
| `mobile/src/lib/i18n-theme.ts` | `THEME_UI` + Design-Namen/Taglines je Sprache |
| `mobile/src/lib/recipe-translate.ts` | Offline-Wörterbuch, Online-Engines, Glossar, Button-Sperre |
| `mobile/src/lib/recipe-translate-dict.ts` | `maps` (Offline-Dicts je Sprache) |
| `mobile/src/lib/recipe-translate-extra.ts` | `EXTRA_TERMS` (Begriffs-Erweiterungen) |
| `mobile/src/lib/ai.ts` | Spracherkennung für den AI-Chef |
| `mobile/src/lib/i18n-212.ts` | alte Landing-Texte (Zähler) — **keine neuen Zahlen hart hineinschreiben**, zählfrei halten |

### Merge-Reihenfolge (wichtig!)

`baseDicts` → dann der Reihe nach
`FEATURES, APP_212, APP_310, APP_312, APP_320, APP_320B, APP_320C, APP_321,
APP_322, I18N_TEXTS, I18N_TEXTS_EXTRA, APP_330, APP_332, APP_342, APP_350` →
**zuletzt `LANGS_35`**.

Jedes Modul wird über `languageModule(source, lang)` gelesen:

```ts
{ ...(source.en ?? {}), ...(source[lang] ?? {}) }
```

**Falle:** Die meisten `APP_*`-Module haben für die neuen Sprachen nur `en`.
Dadurch tragen sie automatisch das **englische** Wort ein und überschreiben
u. U. nichts Sinnvolles. Deshalb müssen die Texte der neuen Sprachen in
`LANGS_35` stehen — es wird **zuletzt** gemergt und gewinnt gegen diese
Fallbacks. Alternativ die Sprache in jedes Modul aufnehmen (aufwändiger).

Danach werden `ui` und `s` nochmal zusammengesetzt:

```ts
ui: { ...(merged.ui ?? {}), ...(UI_L10N.en ?? {}), ...(UI_L10N[lang] ?? {}) }
s:  { ...(merged.s  ?? {}), ...(SCREENS_L10N.en ?? {}), ...(SCREENS_L10N[lang] ?? {}) }
```

`UI_L10N`/`SCREENS_L10N` gewinnen also gegen `ui`/`s` aus den anderen Modulen.

---

## 3. Eine neue Sprache hinzufügen — Schritt für Schritt

Angenommen, es sollen `sv` (Schwedisch) usw. dazu. Für **jede** Sprache:

1. **`i18n.tsx`**
   - `Language`-Union um den Code erweitern.
   - `LANGUAGES`-Eintrag mit `code`, englischem `name` und `native` ergänzen.
   - In `baseDicts` den Code ergänzen (neue Sprachen starten als `{}`).
   - RTL? → in `RTL_LANGUAGES` aufnehmen.
2. **Wörterbuch füllen** — alle Namespaces, die Englisch hat, übersetzen.
   Bei den 3.5.0-Sprachen liegt das in `i18n-langs35.ts`. Vollständiger
   Namensraum-Satz (Stand 3.5.0):
   `nav, common, dashboard, recipe, dialog, library, tutorial, kitchen, saved,
   tracker, assistant, shopping, community, shared, settings, admin, auth,
   landing, notFound, errors, palette, onboarding, cooking, legal, langue, tut,
   hh, shop, x, s, onb`.
3. **`i18n-ui.ts`** — `UI_L10N[code]` ergänzen (`notifTitle, notifMeal,
   notifMealDesc, notifDrink, notifDrinkDesc, notifAi, notifAiDesc, notifAdded,
   notifAddedDesc, help, contact, exportData, danger, deleteAccount,
   deleteAccountBody, tutorialSection, name, email, offlineNoNet, notifAdmin,
   notifAdminDesc`).
4. **`i18n-screens.ts`** — `SCREENS_L10N[code]` ergänzen (alle `s`-Keys).
5. **`i18n-350.ts`** — die v3.5-Keys der Sprache ergänzen (Sammlungen,
   Haushalts-QR-Scanner: `collectionRename, collectionDelete,
   collectionDeleteBody, collectionManageHint, hhScanTitle, hhScanIntro,
   hhScanManual, hhScanManualPh, hhScanJoin, hhScanNoCamera`).
6. **`i18n-theme.ts`** — `THEME_UI[code]` und jeden Design-Namen/Tagline in
   `L10N` ergänzen (siehe `themeUi()`/`themeText()`).
7. **Live-Rezeptübersetzung** — siehe Abschnitt 4.
8. **AI-Chef-Erkennung** — siehe Abschnitt 5.
9. **Landing-Zähler** — nichts hart hineinschreiben. `LandingScreen` nutzt
   bereits `s.statLangsLive` mit `LANGUAGES.length`; die alten Texte in
   `i18n-212.ts` sind absichtlich **zählfrei** ("Viele Sprachen").
10. **Prüfungen** laufen lassen (Abschnitt 7).

---

## 4. Live-Rezeptübersetzung (Library-Button) — **jede** Sprache komplett

In der Library/Rezeptansicht gibt es einen Button, der die Sprache ändert und
das **Rezept live übersetzt**. Der Button erscheint nur, wenn die Sprache
„übersetzbar" ist:

```ts
export function isTranslatableLanguage(language: string): boolean {
  return !!language && language !== 'en' && !!maps[language];
}
```

Damit eine neue Sprache den Button bekommt und übersetzt wird, **alle** Punkte
abarbeiten:

1. **`recipe-translate-dict.ts` → `maps`**: Eintrag für die Sprache ergänzen.
   - Entweder mit Offline-Wörtern füllen (wie `de`, `fr`, …), oder
   - leer `{}` lassen — dann ist `isTranslatableLanguage(language) === true`
     und die Online-Engines + Glossar übersetzen (Ergebnis wird serverseitig in
     `recipe_translations` gecacht). Die 3.5.0-Sprachen nutzen diesen Weg.
2. **`recipe-translate.ts` → `ONLINE_LANGS`**: `code: '<BCP-47>'`, z. B.
   `zh: 'zh-CN'`, `ja: 'ja'`, `ko: 'ko'`, `hi: 'hi'`, `pl: 'pl'`, `uk: 'uk'`.
3. **`recipe-translate.ts` → `MM_PAIRS`** (zweite Engine MyMemory):
   `zh: 'zh-CN'`, `ja: 'ja-JP'`, `ko: 'ko-KR'`, `hi: 'hi-IN'`, `pl: 'pl-PL'`,
   `uk: 'uk-UA'`.
4. **`recipe-translate.ts` → `GLOSSARY_EXTRA`**: Küchen-/Technikbegriffe für die
   Sprache ergänzen (mindestens `fold, fold in, whisk, simmer, sear, deglaze,
   julienne, knead, marinate, bring to a boil, reduce the heat,
   preheat the oven, season to taste, drain, set aside`). `applyGlossary` nutzt
   `GLOSSARY` **und** `GLOSSARY_EXTRA`.
5. Optional: `recipe-translate-extra.ts` (`EXTRA_TERMS`) ergänzen, wenn es für
   die Sprache mehr Fachbegriffe braucht.

Ablauf zur Laufzeit: `RecipeDetailScreen`/`CookingScreen` rufen
`api.translate.translateRecipe` mit `{recipeKey, targetLanguage, title,
description, ingredients, steps}`. `translateRecipeContentOnline(...)` nutzt
zuerst das Offline-Dict + Glossar, dann online; das Ergebnis wird über
`supabase.rpc('save_translation', …)` in `recipe_translations` gespeichert und
beim nächsten Mal aus dem Cache gelesen (Schlüssel = Rezept + Sprache).

**Test ohne Gerät:** Prüfen, dass `maps[code]` existiert, `ONLINE_LANGS[code]`
und `MM_PAIRS[code]` gesetzt sind und `GLOSSARY_EXTRA` die Sprache enthält.

---

## 5. AI-Chef — Spracherkennung

`mobile/src/lib/ai.ts` erkennt die Sprache der Nutzereingabe, damit der
AI-Chef in derselben Sprache antwortet:

- `SCRIPT_LANGUAGES`: Schriftsystem-Bereiche (deckt Chinesisch, Japanisch,
  Koreanisch, Hindi/Kyrillisch/Arabisch ab). Für eine neue Sprache mit eigenem
  Alphabet hier den Unicode-Bereich ergänzen.
- `LATIN_STOPWORDS`: Stoppwörter für lateinisch geschriebene Sprachen (u. a.
  `pl`). Für jede neue lateinische Sprache die typischen Stoppwörter ergänzen,
  sonst wird die Eingabe nicht erkannt.

---

## 6. RTL und Theme

- RTL: Sprache in `RTL_LANGUAGES` in `i18n.tsx`. Danach prüft der
  `langue.restart*`-Flow, ob ein Neustart nötig ist (nur `ar`).
- Theme: Neue Sprache in `i18n-theme.ts` in `THEME_UI`/`L10N` ergänzen; die
  Design-Auswahl (`ThemeScreen`) und `theme.name`/`theme.tagline` laufen über
  `themeUi(lang, key)` und `themeText(lang, id, kind, fallback)`.

---

## 7. Kein hartcodierter Text

- Alles sichtbare über `t('namespace.key')` bzw. die `ui`/`s`-Tags.
- Ausnahmen sind **nur** Markenzeichen: `© 2026 Spoonful`
  (`navigation/Shell.tsx`), `Spoonful · Legal` (`LegalScreen.tsx`), `Spoonful`
  (Onboarding/Announcement).
- Prüfen mit `node tools/find-hardcoded.mjs` (viele Treffer sind
  Fehlalarme — Marken und Code zählen nicht).
- Benutzte, aber fehlende Keys: `node tools/check-missing-i18n-keys.cjs`.

---

## 8. Prüfungen (alle müssen grün sein)

```
node tools/check-version.mjs                 # config.ts == build.gradle
node tools/typecheck.cjs                     # TS-Fehler; staged, notfalls typecheck.state.json + typecheck.log löschen
node tools/check-missing-i18n-keys.cjs       # benutzte, aber fehlende t('…')-Keys
cd mobile; npx jest --silent                 # Unit-Tests
cd mobile; npx eslint .                      # 0 Errors (Warnungen sind ok)
```

Danach Release bauen/prüfen (siehe `INSTRUCTIONS/BUILD_INSTRUCTIONS.md`):

```
_build_arm.bat
node tools/check-apk.mjs mobile/android/app/build/outputs/apk/release/app-release.apk
```

Hilfswerkzeuge: `node tools/apply-i18n.mjs` (Trockenlauf; mit `--write`
ersetzt es feste Texte durch Tags) und `node tools/add-i18n-key.mjs <key>`
(legt einen neuen Key in allen Sprachen von `i18n-texts-extra.ts` an).

---

## 9. Kurzrezept: „Füge 10 Sprachen hinzu“

1. 10 Codes in `Language` + `LANGUAGES` (+ `RTL_LANGUAGES`, falls RTL).
2. Je Code in `baseDicts` ein `{}` ergänzen.
3. In `i18n-langs35.ts` (oder einem neuen, **zuletzt** gemergten Modul) je
   Sprache **alle** Namensräume aus Abschnitt 3.2 übersetzen.
4. `UI_L10N`, `SCREENS_L10N`, `i18n-350.ts`, `i18n-theme.ts` je Sprache.
5. Je Sprache für die **Live-Rezeptübersetzung**: `maps`, `ONLINE_LANGS`,
   `MM_PAIRS`, `GLOSSARY_EXTRA` (Abschnitt 4).
6. `ai.ts`: `SCRIPT_LANGUAGES` und/oder `LATIN_STOPWORDS` ergänzen.
7. Tests/Zähler prüfen — **keine** Zahl hart eintragen.
8. Prüfungen aus Abschnitt 8 laufen lassen, dann APK bauen.

Fertig ist eine Sprache erst, wenn Button und Übersetzung funktionieren **und**
keine Prüfung rot ist.
