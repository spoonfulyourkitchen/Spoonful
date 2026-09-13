# Spoonful 3.1.0 — Haushalt komplett, Foto-Ausschnitt, Kochmodus-Schalter

Version 3.1.0 baut auf 3.0.0 auf (Kochmodus-Ausbau) und bringt vier große Blöcke.

## 1. Foto-Ausschnitt überall (Popup)

* Nach jedem Foto (Kamera/Galerie) öffnet sich ein Popup: **ziehen** = welche
  Stelle sichtbar ist, **+ / -** = Zoom, **Zurücksetzen**, **Übernehmen**.
* Greift bei Rezept-Fotos (Formular) **und** bei Schritt-Fotos (Kochmodus).
* Das gewählte Bild wird überall so angezeigt (Karten, Kopfbereich, Diashow) -
  auch nach dem Upload, weil der Ausschnitt mitwandert.
* Ohne Auswahl bleibt alles wie vorher.

## 2. "Cooking Mode Advanced" in den Einstellungen

* Einstellungen → Kochmodus: Schalter **Cooking Mode Advanced**.
* **An** (Standard): alle 3.0.0-Funktionen - Schritt-Titel, Badges,
  Teilschritte, Notizen, Fotos, Zweitgericht, Haushalts-Kochstand, "Wo war ich?".
* **Aus**: klassischer Kochmodus wie vor 3.0.0 - nur Fortschritt, Schritt-Chips,
  Timer und die **Coach-Tipps** (die bleiben in beiden Modi).

## 3. Kochmodus-Fixes

* **"Nochmal kochen"**-Knopf direkt auf dem Endbildschirm (plus "Fertig") -
  Timer, Haken und Portionen werden dabei zurückgesetzt.
* Schritt-Fotos werden sofort mit Ausschnitt gespeichert.

## 4. Haushalt: eigene Seite + 20 Funktionen

Neuer Tab **Haushalt** in der unteren Leiste (neben Tracker, Community, …).

| # | Funktion | # | Funktion |
|---|----------|---|----------|
| 1 | Haushalt gründen | 11 | Pinnwand (Notizen an alle) |
| 2 | Haushaltsname ändern | 12 | Wochenplan (Mo–So) |
| 3 | Einladungscode erzeugen + teilen | 13 | Plan → Einkaufsliste |
| 4 | Mit Code beitreten | 14 | Vorratskammer |
| 5 | Haushalt verlassen | 15 | Ausgaben + Saldo |
| 6 | Mitglieder mit Avataren | 16 | Gemeinsame Einkaufsliste (Kurz + alles abhaken) |
| 7 | Rollen (Admin/Mitglied) vergeben | 17 | Rezepte für den Haushalt teilen |
| 8 | Aktivitäts-Feed | 18 | "Was kochen wir?" (Idee) |
| 9 | Kochstand live + "Öffnen" | 19 | Statistik (Sessions, Aufgaben, Ausgaben, Vorrat) |
| 10 | Aufgaben (anlegen, abhaken, mir zuweisen) | 20 | Erinnerung schicken (offene Aufgaben + Einkauf) |

**Wichtig:** dafür einmal `db/3.1.0-household.sql` im Supabase SQL-Editor
ausführen. Ohne dieses SQL läuft die App normal weiter - die Haushalts-Seite
zeigt dann nur Mitglieder und den Kochstand.

## 5. Schritt-Fotos als Diashow (Library)

* Hat man für ein Rezept Schritt-Fotos gespeichert, erscheint auf der
  Rezeptseite der Streifen **"Deine Schritt-Fotos"**.
* Antippen öffnet die Diashow: **wischen oder Pfeile**, jedes Bild zeigt
  "Schritt 4 · 2 von 5" und den Text des Schritts.
* Die Fotos bleiben **beim eigenen Konto** (lokal, kein Upload, nicht im
  Haushalt sichtbar).

## Technisch

* Neue Dateien: `src/lib/photo-crop.ts`, `src/components/PhotoCropModal.tsx`,
  `src/components/CroppedImage.tsx`, `src/lib/app-prefs.ts`,
  `src/lib/household.ts`, `src/components/StepPhotoSlideshow.tsx`,
  `src/screens/HouseholdScreen.tsx`, `src/lib/i18n-310.ts`,
  `db/3.1.0-household.sql`.
* Alle neuen Texte in 10 Sprachen (de, en, ar, fr, es, it, tr, pt, nl, ru).
* Version 3.1.0 (`versionCode 9`), Anzeige in den Einstellungen aktualisiert.
