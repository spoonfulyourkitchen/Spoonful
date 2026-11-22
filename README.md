# Spoonful

Spoonful keeps recipes, nutrition, shopping and household lists in one Android app.

## What is in the app

**Recipes.** A library with photos, preparation time, difficulty and nutrition values. Search by dish or ingredient, filter by cuisine, meal type, total time, calories and diet, and cook from a step by step guide with timers.

**AI Chef.** Describe what is in your fridge or what you feel like eating. The chef writes a recipe around your ingredients, your time and your preferences, suggests substitutes for missing ingredients and can rework an existing recipe.

**Tracker.** Log meals by hand, from a recipe or from a scanned product. Calories, protein, carbohydrates and fat are counted per day and per week against a goal calculated from your body data. Weekly report, water goal and weight trend included.

**Barcode scanning.** Point the camera at a barcode. The app reads the code, finds the product, shows the values per 100 grams and logs the portion you choose.

**Shopping.** Turn a recipe into a shopping list, add items by hand, group by aisle or course, add prices and share one list with your household through an invite code.

**Saved recipes.** Collections, personal notes and your own versions of recipes.

**Community.** Publish recipes, rate and comment, repost and follow other cooks.

**Languages.** The interface, recipes and notifications are translated, with right to left layout for Arabic. The app takes the device language on first start.

**Offline.** Lists you opened stay readable without a connection, and changes made offline are sent when the connection returns.

## Prüfen vor jeder Version (1 Minute)
```bash
cd mobile
npx tsc --noEmit              # Typen (bei Zeitnot: node tools/typecheck.cjs)
npx jest                      # Unit-Tests
npx eslint src App.tsx --quiet # Fehler (Warnungen sind erlaubt)
```
Dazu im Repo-Root:
```bash
node tools/check-version.mjs                    # Version überall gleich? + Notizen vorhanden
node tools/check-missing-i18n-keys.cjs           # benutzte, aber fehlende t('…')-Keys
node tools/typecheck.cjs                         # Typprüfung in Etappen (typecheck.log)
node tools/check-apk.mjs <pfad/zur.apk>          # ABIs, Hermes-Bundle, keine Geheimnisse
node tools/video-check.mjs "<Video-Link>"        # liefert das Video einen Rezept-Text?
node tools/ai-live-check.mjs                     # antwortet die KI-Funktion (inkl. Tageslimit)?
node tools/db-run.mjs --sql "select 1"           # SQL direkt aufs Projekt (DDL/Notfälle)
```

## Bauen und veröffentlichen (APK + GitHub-Release)

Die vollständige Anleitung steht in **`INSTRUCTIONS/BUILD_INSTRUCTIONS.md`**
(Voraussetzungen, Prüfschritte, Verbote wie ABI-Splits/R8/Polyfills,
Verifikation des Pakets, Ablage als `Spoonful-v<version>.apk`, GitHub-Release).

## Stabilität
* `STABILITY-100.md`: offene und erledigte Punkte.
* `RELEASE_NOTES-v3.5.0.md`: Ukrainian and five more languages, dairy-aware AI estimates, recipe collections, household QR scanner, community count and report label fixes.
* `RELEASE_NOTES-v3.4.1.md`: glass effect removed, Google login, library loading percentage, password strength, em dashes removed, legal texts.
* `RELEASE_NOTES-v3.4.0.md`: offline first (water, weight, saving, likes, comments, own recipes, meals), cooking mode, real recipe count on the start screen.
* `RELEASE_NOTES-v3.3.3.md`: performance (inlineRequires, lazy dictionary, query cache), WebP images, meal popup, build instructions.
* `RELEASE_NOTES-v3.3.2.md`: admin reports, password eye, onboarding, shopping list.
* `RELEASE_NOTES-v3.2.3.md`: polish, local shopping list, daily AI limit.
* Abstürze nachlesen: App → Einstellungen → Letzte Fehler.
