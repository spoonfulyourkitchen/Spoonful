# Spoonful — Build & Release (Android)

Gültig ab 3.3.3, gepflegt für 3.5.0. Kurz, verbindlich, ohne Experimente.

## 1. Voraussetzungen
- Node 22+ (`node -v`), JDK 17 unter `C:\Java\jdk-17.0.10+7`
- Android SDK, Pfad in `mobile/android/local.properties` (`sdk.dir=…`)
- `cd mobile; npm ci` — **immer** `npm ci`, nie `npm install` mit gelöschtem
  `node_modules` (3.3.3: ein halb installiertes `node_modules` mit 610 statt 948
  Paketen hat den Start zum Absturz gebracht).

## 2. Prüfungen vor dem Build (alle müssen grün sein)
```
node tools/check-version.mjs                 # config.ts == build.gradle
node tools/typecheck.cjs                     # TS-Fehler (schreibt typecheck.log)
node tools/check-missing-i18n-keys.cjs       # benutzte, aber fehlende t('…')-Keys
cd mobile; npx jest --silent                 # Unit-Tests
cd mobile; npx eslint .                      # 0 Errors (Warnungen sind ok)
```
`tools/typecheck.cjs` läuft in Etappen: bricht der Lauf ab, einfach erneut
starten — er macht beim letzten Stand weiter (`typecheck.state.json`).

## 3. Release bauen
```
_build_arm.bat        (bzw. mobile/android: gradlew.bat -PreactNativeArchitectures=arm64-v8a,armeabi-v7a assembleRelease)
```
Ergebnis: `mobile/android/app/build/outputs/apk/release/app-release.apk`

Regeln (aus 3.3.3, nicht ändern):
- **kein** `gradlew clean` — das hat Bundles/`node_modules` zerschossen
- **keine** ABI-Splits in `build.gradle` — sonst heißen die Dateien
  `app-arm64-v8a-release.apk` u. ä. und die Installation schlägt fehl
- **kein** R8/Minify (`minifyEnabled false`)
- **keine** globalen Polyfills (`core-js`, `intl`) — die haben 3.3.3 crashen lassen
- keine Geheimnisse im APK (Edge Function hält die KI-Schlüssel serverseitig)

## 4. Prüfung nach dem Build
```
node tools/check-apk.mjs mobile/android/app/build/outputs/apk/release/app-release.apk
```
Erwartet: ABIs `arm64-v8a, armeabi-v7a`, kein x86, `assets/index.android.bundle`
vorhanden, keine Service-Role-Keys/Tokens im APK.

## 5. Ausliefern
1. APK umbenennen: `Spoonful-v<version>.apk` (alte Datei vorher löschen)
2. `RELEASE_NOTES-v<version>.md` (englisch) und `GITHUB_RELEASE_v<version>.md`
3. `git tag v<version>` und Push
