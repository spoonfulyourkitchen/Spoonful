# Spoonful 3.2.2 — Stabilitäts-Runde (die Liste wird abgearbeitet)

Diese Version ist **keine neue Funktion**, sondern die Abarbeitung der
100-Punkte-Liste aus `STABILITY-100.md`. Fokus: nicht mehr abstürzen, weniger
Akku ziehen, flüssiger laufen — und Fehler endlich nachvollziehbar machen.

## 1. Bilder in Listen: der größte Hebel (Punkte 1, 3, 39, 40, 61)
* Jede Liste lud bisher das **Originalfoto** (oft 3000×2000 px). 24 Kacheln =
  mehrere hundert MB Speicher → das ist auf Handys mit wenig RAM die häufigste
  Absturz- und Ruckel-Ursache.
* Jetzt wird automatisch eine **kleine Bildvariante** angefordert
  (`lib/image-url.ts`):
  * Wikimedia → offizieller Thumbnail-Pfad (bzw. Breite ausgetauscht),
  * Supabase Storage → Bilddienst mit `width=…&quality=72`,
  * alles andere → original.
* **Sicherer Rückfall:** Lädt die kleine Variante nicht, wird automatisch das
  Original nachgeladen. Es kann also nichts verschwinden.
* Angewendet auf Bibliothek (260/420 px), Meine Rezepte (110 px),
  Community (340/460 px). 2× Breite für scharfe Displays.

## 2. Abstürze nachvollziehbar machen (Punkte 5, 6, 19, 20)
* Neues **Absturz-Protokoll** (`lib/crash-log.ts`): Bildschirm-Fehler und
  globale JS-Fehler werden mit Zeitpunkt und Ort gespeichert (max. 25 Einträge,
  nur Text, wird **nicht** gesendet).
* **Einstellungen → Letzte Fehler** zeigt sie an und kann sie löschen.
* Der Fehler-Bildschirm sagt jetzt „Der Fehler wurde gespeichert" und bietet
  **Neu starten** an (statt nur „nochmal").
* Globale JS-Fehler werden mitprotokolliert, ohne das normale Verhalten zu
  ändern (im Entwicklungsmodus bleibt der rote Kasten).

## 3. Nichts hängt mehr (Punkte 13, 70)
* Neue Helfer in `lib/safe.ts`: `withTimeout`, `fetchText` (mit Abbruch),
  `parseNum`, `at`.
* **KI-Aufrufe haben jetzt ein Zeitlimit** (60 s). Vorher konnte ein hängender
  Aufruf die Oberfläche „einfrieren".

## 4. Kleinere, konkrete Fehler weg (Punkte 12, 71, 82, 84, 85, 88)
* **Offline-Anzeige** sagt jetzt, wie viel wartet: „Offline · 3 Änderungen
  warten" (statt nur „Offline") — man weiß, dass nichts verloren ist.
* **Einkaufsliste legt nichts doppelt an**: gleiche Zutat innerhalb einer
  Anfrage und gegenüber der offenen Liste wird übersprungen.
* **Haushalt teilen** ist gegen Doppel-Tippen geschützt (vorher konnten zwei
  Listen in zwei schnellen Tipps entstehen).
* **Kochmodus** merkt sich die Sitzung (war schon so) und **sagt es jetzt
  auch**: „Weiter bei Schritt 4" — vorher sprang er wortlos mitten hinein.
* **Live-Scanner schließt sich nach 45 s** von selbst (Kamera lief sonst
  endlos weiter, wenn das Popup liegen blieb).
* Tracker akzeptiert Zahlen mit Komma **und** Punkt (Alter, Größe, Gewicht).

## 5. Prüfen statt raten (Punkte 89, 90, 92, 95, 100)
* **55 automatische Tests, alle grün** (Vorher: 41). Neu dabei: `stability.test.ts`
  für Bildgrößen, Zeitlimits, Zahlenerkennung, sichere Array-Zugriffe und das
  Absturz-Protokoll.
* Die Tests haben sofort einen **echten Pfad-Fehler** in meinem Thumbnail-Code
  gefunden (Wikimedia-Pfad) — behoben.
* Neues Prüfskript: `node tools/check-version.mjs` vergleicht `versionName`,
  `versionCode`, `APP_VERSION` und die Release-Notizen.
* `tsc --noEmit` und `eslint --quiet` laufen fehlerfrei durch.

## Technik
* `versionCode 13`, `versionName "3.2.2"`, `APP_VERSION = '3.2.2'`.
* Neu: `src/lib/image-url.ts`, `src/lib/crash-log.ts`, `src/lib/safe.ts`,
  `src/lib/i18n-322.ts` (6 Keys × 10 Sprachen), `tools/check-version.mjs`,
  `__tests__/stability.test.ts`.
* Geändert: `CroppedImage`, `RecipeImage`, Bibliothek/Community/Meine Rezepte,
  `SettingsScreen`, `App.tsx`, `api.ts`, `household.ts`, `offline.tsx`,
  `ai.ts`, `BarcodeScannerModal`, `CookingScreen`, `TrackerScreen`.

## Was als Nächstes in der Liste steht
* Punkt 2: Bild-Fehler im Hintergrund melden, Punkt 7: Speicherstand prüfen,
  Punkt 26/34: Akku-schonender Modus, Punkt 62-75: Netzwerk-Feinschliff.
* Alles Offene steht mit „⬜" in `STABILITY-100.md`.
