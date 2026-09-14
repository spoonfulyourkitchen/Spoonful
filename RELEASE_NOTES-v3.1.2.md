# Spoonful 3.1.2 — aufgeräumter Haushalt, Live-Scanner, QR-Beitritt

## Bild-Ausschnitt: die Stelle ist jetzt markiert

* Beim Ausschnitt-Popup (überall wo Fotos dazu kommen) sieht man im Vorschau-Rahmen
  das Foto, das man **verschieben** kann.
* Neu: eine kleine Karte daneben zeigt **das ganze Foto** - das Rechteck darin
  markiert die Stelle, die später angezeigt wird. Zoom ändert die Größe des
  markierten Bereichs, "Zurücksetzen" stellt die Mitte wieder her.

## Haushalt: komplett neu und übersichtlich

* Nur noch vier Blöcke, alles andere ist eingeklappt:
  **Mitglieder · Kocht gerade · Einkauf · Wochenplan · Aufgaben** -
  Ausgaben, Pinnwand, Statistik und Aktivität stecken hinter "Mehr anzeigen".
* **QR-Code oben rechts**: zeigt einen QR-Code, den andere mit dem Scanner
  einlesen → sie treten dem Haushalt bei. Darunter steht der Beitritts-Code
  zum Abschreiben/Teilen.
* **Wochenplan mit Rezepten aus der App**: "+" an einem Tag öffnet die Auswahl
  mit drei Tabs - **Bibliothek** (mit Suche), **Meine Rezepte**, **Gespeichert**.
  Ein Tipp trägt das Gericht ein, ein zweiter Knopf setzt gleich alle Zutaten
  auf die Einkaufsliste.
* **"Mit Haushalt teilen"** als klarer Knopf (teilt Code + lädt ein).
* Rollen (Admin/Mitglied) vergibt man per Langdruck auf ein Mitglied.

## Live-Scanner: Handy hinhalten statt Foto

* Der Scanner startet jetzt **sofort mit der Kamera** und liest den Code
  **laufend** ein - bis er ihn erkennt. Kein Foto mehr nötig.
* Klappt etwas nicht (Kamera verweigert), führt ein Knopf "Stattdessen Foto
  aufnehmen" zum bisherigen Weg (scharfes Foto + Erkennung + Tipp-Karte).
* Der Haushalts-QR wird über denselben Scanner gelesen: Code scannen → beitreten.

## Einkaufsliste: weniger Knöpfe

* Die doppelte "Teilen"-Schaltfläche oben ist weg, die Vorschläge
  (Eggs, Milk, …) sind **eingeklappt** und öffnen sich erst auf Tipp.
* Neu: **"Mit Haushalt teilen"** teilt die offene Liste und trägt es in den
  Haushalts-Feed ein, damit die anderen es sehen.

## Technik

* Neu: `src/components/QrCodeView.tsx` (QR offline über das vorhandene
  zxing-Asset + react-native-svg), `src/lib/i18n-312.ts` (10 Sprachen).
* `HouseholdScreen.tsx` komplett neu geschrieben (statt 20 verstreuten Blöcken
  jetzt klare Abschnitte, weniger Abfragen, graceful bei fehlendem SQL).
* Version 3.1.2 (`versionCode 10`).
