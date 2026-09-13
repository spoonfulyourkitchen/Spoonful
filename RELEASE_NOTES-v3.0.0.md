# Spoonful 3.0.0 — Kochmodus, Haushalt & Feinschliff

Version 3.0.0 bündelt die erste große Ausbaustufe des Kochmodus und verbindet ihn
mit dem Haushalt.

## Kochmodus (aus COOKING_MODE_300.md)

1. **Schritt-Überschrift** – kurzer Titel ("Vorbereitung · Zwiebel schneiden…")
   über dem Schritt, plus "Schritt X von Y".
2. **Zwei Fortschrittsbalken** – dick für das ganze Rezept, fein für die Position
   innerhalb der Schritte.
3. **Gruppen je Schritt** – Vorbereitung / Kochen / Finish, farbig markiert.
4. **Schritte überspringen** – "Überspringen" blendet einen Schritt aus
   (zählt nicht mehr in den Fortschritt) und lässt sich zurücknehmen.
6. **Teilschritte aufklappen** – lange Schritte werden an Satzgrenzen zerlegt und
   mit einem Tipp auf "Teilschritte (3)" einzeln lesbar.
8. **Wischgeste** – nach links wischen = Schritt abhaken und weiter
   (nach rechts = zurück). Zusätzlich funktioniert sie jetzt stabil
   (Handler liegen in einem Ref).
10. **"Wo war ich?"** – war die App länger als 5 Minuten weg, erscheint ein Knopf,
    der direkt zum ersten offenen Schritt springt.
11. **Dauer je Schritt + Restzeit** – Schätzung pro Schritt (aus dem Text oder aus
    Erfahrungswerten), Gesamtschips "Noch ~25 min" passen sich live an.
12. **Zweites Gericht parallel** – ein zweites Rezept aus "Gespeichert" hinzufügen;
    es läuft als eigene Karte mit eigenem Fortschritt nebenher.
14. **Abhängigkeiten** – Hinweise wie "Läuft parallel" oder "Warten bis gar"
    werden erkannt und als Chip angezeigt.
16. **Notiz je Schritt** – "Notiz" öffnet ein Feld ("nächstes Mal mehr Chili");
    die Notiz bleibt beim Rezept gespeichert.
17. **Foto je Schritt** – Zwischenstand per Kamera oder Galerie anhängen.
    **Wichtig:** die Bilder bleiben **beim eigenen Konto** (lokal, pro Nutzer-ID,
    kein Upload). Andere Haushaltsmitglieder sehen sie nie.
25. **Soll/Ist-Zeit** – Startzeit wird gespeichert, "läuft 12 min" + "Noch ~18 min"
    zeigen geschätzt gegen tatsächlich.
26. **Haushalt: gemeinsam kochen** – der eigene Schritt wird im Haushalt geteilt
    ("Anna · Schritt 5/8"); man sieht die anderen und kann zu ihrem Schritt
    springen. Der Haushalts-Popup der Einkaufsliste zeigt zusätzlich
    "🍳 Anna: Pasta 5/8".
28. **Schwierigkeit je Schritt** – leicht / mittel / schwer als kleines Badge.

## Neu im Haushalt

* Neue Tabelle + Funktionen für den Koch-Stand (`db/3.0.0-household-cooking.sql`).
  Ohne dieses SQL läuft die App weiter; die Haushalts-Anzeige bleibt einfach leer.

## Sonstiges

* Version 3.0.0 (`versionCode 8`), Anzeige in den Einstellungen aktualisiert.
* Alle neuen Texte in allen 10 Sprachen (de, en, ar, fr, es, it, tr, pt, nl, ru).
