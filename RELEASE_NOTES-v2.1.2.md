# Spoonful 2.1.2

**A bigger quality release: a tour people can actually finish, a real localisation system, right-to-left Arabic, device-language detection, a redesigned entry screen — and a privacy win: the app no longer asks for gallery access.**

`versionCode 5` · `versionName 2.1.2` · APK: `Spoonful-v2.1.2.apk` (74.2 MB) · minSdk 24 · targetSdk 36

---

## 🎓 Tutorial: rebuilt from scratch
The old tour was unusable — now it is a short, guided flow that cannot get stuck.

- **8 real steps**: welcome → Discover → search → open a recipe → save it → shopping list → tracker & barcode → finish.
- **Progress indicator**: “Step 3 of 8” plus a progress bar (counts only the steps you actually see).
- **Skip per step *and* globally** — plus back/forward navigation, “Later”, and a “Let's go” finish screen.
- **The fixes that mattered**:
  - The reset button works: it now clears AsyncStorage (progress *and* counters), the in-memory state and the “completed” version, then restarts the tour immediately.
  - Tapping the highlighted element really works — the overlay is no longer a separate native window, and only the spot under the spotlight accepts taps.
- **Translated in all 10 languages** (tutorial copy used to be English-only for 7 of them).
- No emojis: app-coloured pointer symbol, cleaner coach mark, respects “reduce motion”, screenreader announcements.

## 🌍 Localisation: every screen, 10 languages
- New namespaces with **all 10 languages filled in**: `tut`, `langue`, `home`, `adminAlert`, `aiLang`, `cat`, `err`, `notif`, `ui`, `s` (screens).
- **Placeholder support** in the translator: `t('tut.stepOf', { n: 3, total: 8 })`.
- **English is the last fallback only** — no more missing-key leaks.
- Migrated: notifications (meal/water reminders, “chef is done”, “recipe added”), the whole settings screen, the pre-login dashboard, tracker details, shopping list, community, my recipes, recipe form, admin tables, comment sheet.

## ⬅️ RTL support (Arabic)
- Arabic flips the whole layout: rows, text alignment, chevrons, back buttons, tab bar, tutorial.
- Direction is applied at start-up; switching to/from Arabic shows a **restart notice** (and reloads the bundle where the platform allows it).

## 📱 Device language on first start
- On the very first launch the app reads the phone language and uses it **without asking**.
- Not one of the 10 supported languages (or a related RTL language such as Farsi/Hebrew/Urdu → Arabic)? The app falls back to English and shows a **soft language picker** once.
- The choice is persisted.

## 🏠 Pre-login dashboard, redesigned
- Hero with “new in 2.1.2” badge, mock app illustration, stat pills (1,100+ recipes · 100 countries planned · 9 languages), social proof.
- **Six feature cards** for what shipping today actually does: library, AI Chef, barcode tracker, household shopping, community, languages & RTL.
- Three-step “how it works”, final call to action, legal footer — all i18n-tagged and RTL-ready.

## 🍲 Recipes: scaling to 100 per country
- **Country catalogue A→Z** (127 countries, Afghanistan … Zimbabwe) and the library’s country filter is now **sorted alphabetically**.
- A 100-slot plan per country with progress helpers and **lazy loading / pagination** through the existing `catalog_page` RPC (server-side paging, no full download).
- `db/2.1.2-catalog-100-per-country.sql` prepares the slots, counters and admin-only RLS — drop it into the Supabase SQL editor.

## 🔔 Admin-only login notifications
- Every sign-in writes one row (name, e-mail, device, platform, app version, time).
- **Only admins** can read them: the SQL function returns an empty set for everyone else, plus a role check in the app.
- Admin devices get a **local notification** for new sign-ins and a new **“Logins” tab** in the admin panel (unread marker, “mark all as read”).
- `db/2.1.2-admin-login-events.sql` sets up the table, the RPCs and the RLS policies.

## 🤖 The AI answers in *your* language
- The language is detected from **what the user writes**, not from the app settings — with script detection (Arabic, Russian, Hebrew, Greek, Hindi, Thai, Japanese, Korean, Chinese) and stop-word voting for the Latin languages.
- Example: app set to German, recipe described in Turkish → the recipe comes back in Turkish (title, ingredients, steps, tips).

## 🔒 Privacy: no gallery permission
- **All storage permissions are removed** from the app (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`).
- Photos are picked through the **system picker**, which never needs a runtime permission.
- Verified in the shipped APK: only `INTERNET`, `CAMERA`, `POST_NOTIFICATIONS`, `VIBRATE` and the notification-service permissions remain.

## 🧹 Blocker fixed in the recipe translations
- The 6,000-word dictionary had a syntax error that broke **every** build (`s'mores:` unquoted, `Za'atar`/`za'atar` with unescaped apostrophes in ~60 places, four malformed keys) — fixed.
- 43 duplicated keys were deactivated (JavaScript always used the last one, so behaviour is identical).

## 📷 Also in this line (2.1.1 — for anyone upgrading straight from 2.0.0)
- **Barcode scanning from a photo**: full-resolution capture, 7 decoding passes (grey-scale + contrast, up-scaling, 90°/270° rotation, binarising, centre crop) with TRY_HARDER and all common formats, blur detection with a clear popup, manual number as fallback.
- **Portion picker** after a scan: 1 portion / 100 g / whole package / own amount, scaled kcal & macros.
- **Popups instead of scrolling**: goal suggestions, weight, product lookups, shopping-list extras, scanner errors.
- **One water card** (the duplicate emoji version is gone) and a weight card with trend + goal suggestion.

---

## Installation
1. Download `Spoonful-v2.1.2.apk`.
2. Allow installation from unknown sources, install, sign in (or continue as a guest).
3. When Arabic is selected the app asks for a restart so the layout mirrors completely.

## Database migration
Run these once in the Supabase SQL editor (project `gmfkleugoxafmvprqatk`) to enable everything server-side:
- `db/2.1.2-catalog-100-per-country.sql` — recipe slots (100 per country), counters, A→Z view, RLS.
- `db/2.1.2-admin-login-events.sql` — login events, admin-only read, “mark as read”.

Without them the app still works; the admin login feed and the country progress counters stay empty.

## Known limitations
- The catalogue is not seeded yet — that is content work, the structure and pipeline are ready.
- A few long-form strings (recipe examples in the form) are still English by design; the pattern and namespaces are in place.
- `tsc` is type-checked everywhere except the 1.3 MB recipe dictionary, which is marked `@ts-nocheck` (syntax is still validated, and Metro compiles it).

## Thanks
Built with React Native 0.87, Supabase, OpenRouter and ZXing (bundled offline).

---

<details>
<summary><strong>Deutsche Kurzfassung</strong></summary>

- **Tutorial komplett neu**: 8 Schritte, Fortschritt „Schritt 3 von 8", Skip pro Schritt und global, Zurück/Vorwärts, Abschluss-CTA — und der Reset-Button funktioniert jetzt wirklich.
- **i18n**: neue Namespaces in **allen 10 Sprachen**, Platzhalter, keine hardcodierten Texte mehr in Einstellungen, Dashboard, Tracker, Einkauf, Community, Meine Rezepte, Rezeptformular, Admin und Kommentaren.
- **Arabisch = RTL**: die ganze App spiegelt sich, inklusive Neustart-Hinweis beim Sprachwechsel.
- **Gerätesprache beim ersten Start** wird automatisch übernommen; unbekannte Sprachen bekommen einen sanften Sprachwahl-Popup.
- **Dashboard vor dem Login neu**: Hero, Statistiken, 6 Feature-Karten, Social Proof, CTA.
- **100 Rezepte pro Land**: Länderliste A–Z (Afghanistan … Zimbabwe), Länderfilter alphabetisch, Slot-Struktur + Lazy-Loading + SQL-Gerüst.
- **Admin-Login-Benachrichtigung**: nur Admins sehen neue Anmeldungen (Tabelle, RPCs, RLS, lokale Notification, neuer „Logins"-Tab).
- **KI antwortet in der Sprache, in der du schreibst** (nicht in der App-Sprache).
- **Galerie-Berechtigung entfernt** — im fertigen APK verifiziert.
- **Build-Blocker behoben**: Syntaxfehler und 43 doppelte Keys in der 6.000-Wörter-Übersetzung.

</details>
