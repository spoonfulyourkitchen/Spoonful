# Spoonful 3.2.1 — Video-Rezept repariert, Bild-Ausschnitt neu, MONSTR zurück

## 1. Video-Link → Rezept: funktioniert jetzt wirklich
Das war „die Funktion, die nie ging". Die echten Ursachen (gefunden und behoben):

* **Untertitel-Adresse war relativ.** Im YouTube-HTML steht sie als
  `/api/timedtext?...`. Die App hat sie so geladen → `fetch('/api/...')` scheitert
  in Android immer („Network request failed") → **es kamen nie Untertitel an.**
  Jetzt wird `https://www.youtube.com` davor gesetzt, `\u0026` wird zu `&`,
  und es wird zuerst `fmt=json3` versucht, dann XML.
* **Text wurde nur zeilenweise gelesen.** Untertitel sind ein einziger langer
  Block, Beschreibungen oft ein Absatz → 0 Zutaten, 0 Schritte → „kein Rezept".
  Jetzt wird zusätzlich nach **Sätzen**, **Abschnitten** (`Zutaten:`,
  `Zubereitung:`, `Ingredients:`, `Method:`) und **Komma-Listen** getrennt, und
  Zutaten werden auch **mitten im Satz** erkannt („… dann 250 ml Wasser dazu").
* **Zu strenge Grenze:** vorher mussten 2 Zutaten **und** 2 Schritte gefunden
  werden, sonst `null`. Jetzt reicht deutlich weniger.
* **KI-Notfall:** passt lokal nichts, ordnet einmal die KI den Text — über die
  bestehende Gratis-Modell-Funktion (`aiRecipeFromText`), also **kein Guthaben**.
* **Nie mehr „nichts":** im letzten Fall kommt der gefundene Text mit dem
  Hinweis „bitte einmal drüberschauen" — Bearbeiten ist besser als eine leere Seite.
* Untertitel-Spuren werden jetzt richtig ausgewählt (App-Sprache → `de` → `en`,
  echte Untertitel vor Automatik), und Instagram läuft über
  `/embed/captioned/` (ohne Login), TikTok über oEmbed + Meta-Tags.

**Beweis:** 18 neue automatische Tests (`__tests__/video-recipe.test.ts`) halten
genau diese Fehler fest — plus ein Lauf mit dem kompilierten Code gegen echte
Video-Texte. Prüfskript für die eigenen Videos:
`node tools/video-check.mjs "https://www.youtube.com/watch?v=..."`

## 2. Bild-Ausschnitt: ganzes Bild, beweglicher Rahmen, Zwei-Finger-Zoom
* Man sieht jetzt **das komplette Bild** (vorher nur einen Ausschnitt ohne
  Überblick).
* Der **Rahmen** (= das, was später angezeigt wird) lässt sich mit **einem
  Finger frei über das Bild schieben** — inklusive Raster und Griff in der Mitte.
* Mit **zwei Fingern** lässt sich das Bild **vergrößern und verkleinern**; die
  Stelle unter den Fingern bleibt stehen (wie in Karten-Apps). Zusätzlich gibt es
  weiterhin −/+ und „Zurücksetzen".
* **Wichtig:** Wird der Rahmen an den Rand geschoben, hebt die App den Zoom
  automatisch an, damit die gewählte Stelle **nicht** beim Speichern wieder zur
  Mitte gezogen wird (genau das war vorher „nicht perfekt").
* Gespeichert bleibt „Fokuspunkt + Zoom" → der Ausschnitt sitzt in jeder
  Rahmengröße (Karte, Kopfbereich, Diashow). 5 Tests decken die Rechnung ab.

## 3. MONSTR ist zurück (drei Quellen)
* Eigener Tab **und** Eintrag im Seitenmenü, immer schwarz + neon.
* **Preisrunter** (offen, kein Schlüssel), **Marktguru** (Schlüssel wird
  automatisch von der Webseite gelesen) und **ALDI Süd** (öffentliche API)
  werden **gleichzeitig** gefragt — fällt eine aus, liefern die anderen.
* **9 Sekunden Zeitlimit pro Quelle** → „Preise holen" hängt nie mehr.
* Quellen-Chips zeigen live/aus + Anzahl, Vergleich über den **Literpreis**,
  bestes Angebot, günstigste Dose, Zwischenspeicher, Produkt öffnen,
  „auf die Einkaufsliste" und „mit Haushalt teilen".
* „monster" wird zu „monster energy" (sonst kommen Chips und Duschgel).
* Alle Texte über i18n-Schlüssel (10 Sprachen).

## 4. Akku & Stabilität
* **Offline-Prüfung** pausiert im Hintergrund (statt alle 6 s) und prüft beim
  Zurückkommen **sofort**.
* **Admin-Login-Polling** (alle 45 s) hält im Hintergrund an.
* **Tutorial-Lupe** misst im Hintergrund nicht mehr und rendert nur bei echter
  Bewegung (vorher 3× pro Sekunde auch ohne Änderung).
* **Hintergrund** wird nicht mehr bei jedem Tastendruck neu aufgebaut (4
  Farbverläufe memoisiert) und **Übersetzungen werden zwischengespeichert**.
* Timer in Menü/Seite (Navigation, Abmelden, Hinweise) werden beim Verlassen
  aufgeräumt — vorher konnten sie nach dem Abmelden noch feuern.
* **Teilen-Ziel (Android) repariert:** bei `launchMode: singleTask` kommt ein
  neuer Teilen-Aufruf über `onNewIntent`; ohne `setIntent()` sah das Modul den
  alten Intent — deshalb ging es vorher nur beim ersten Start.
* **100-Punkte-Liste** für weitere Stabilität: `STABILITY-100.md`
  (24 davon sind in 3.2.1 erledigt — z. B. Bildgrößen und Crash-Protokoll stehen
  dort als die nächsten großen Hebel).

### 4.1 Drei echte Absturz-Ursachen gefunden (Hook-Reihenfolge)
Beim kompletten Durchleuchten der App (Lint mit „nur Fehler") kamen **drei
Stellen** zum Vorschein, die React zum Absturz bringen, sobald sich die
Verbindung ändert:

* `AssistantScreen` — ein `useState` stand **nach** der Offline-Seite,
* `CommunityScreen` — die gefilterte Liste (`useMemo`) stand nach der
  Offline-Seite,
* `LibraryScreen` — `openRecipe` (`useCallback`) stand nach der Offline-Seite.

Sobald die App online/offline umschaltet, zählt React weniger/mehr Hooks als
beim vorherigen Bild und bricht ab („Rendered more hooks than during the previous
render"). Genau das passt zu „die App stürzt die ganze Zeit ab". Alle drei sind
behoben: **alle Hooks stehen jetzt vor jedem `return`**.

Nebenbei ist toter Code raus (17 ungenutzte Importe/Variablen), damit die
Fehlerliste beim nächsten Mal wieder etwas bedeutet: `eslint --quiet` ist jetzt
**komplett grün** (vorher 25 Fehler).


## 5. Tests, Prüfskripte, Technik
* **`npx jest` → 41 Tests, alle grün** (`__tests__/deals.test.ts`,
  `video-recipe.test.ts`, `photo-crop.test.ts`). Der kaputte Template-Test
  (`App.test.tsx`, brauchte `react-test-renderer`, das nie installiert war) ist
  ersetzt — jetzt wird wirklich etwas geprüft.
* `npx tsc --noEmit` und `eslint --quiet` laufen fehlerfrei.
* Prüfskripte: `tools/video-check.mjs` (Video-Text) und
  `tools/monstr-check.mjs` (Preise) — zeigen live, ob die Quellen liefern.
* Version: `versionCode 12`, `versionName "3.2.1"`, `APP_VERSION = '3.2.1'`.
* Neu: `src/lib/deals.ts`, `src/lib/i18n-321.ts`, `src/screens/MonstrScreen.tsx`;
  neu gebaut: `src/lib/video-recipe.ts`, `src/components/PhotoCropModal.tsx`.
* Anleitung im Repo: `README.md`.

## 6. Was noch am Handy zu prüfen ist
* **Marktguru / ALDI Süd** antworten aus manchen Netzen mit 401/403. Dann steht
  an der Quelle „aus" und Preisrunter liefert weiter. Ein Marktguru-Schlüssel
  lässt sich ohne Code-Änderung über `setMarktguruKey(...)` hinterlegen.
* **Akku/Abstürze:** die offensichtlichen Dauerverbraucher sind raus (siehe
  Punkt 4). Der nächste große Hebel ist in `STABILITY-100.md` ganz oben
  beschrieben: Bilder in Listen als **Thumbnails** laden — große Fotos in langen
  Listen sind auf Handys mit wenig Speicher die häufigste Absturzursache.

