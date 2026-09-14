# Spoonful 3.2.0 — neue Einkaufsliste, geteilte Listen, aufgeräumte Screens

## 1. Einkaufsliste komplett neu (schnell und schlicht)
* Was du über "Add to shopping list" bei einem Rezept hinzufügst, steht hier -
  **nach Rezept gruppiert**.
* Neben jeder Gruppe steht **"Zum Haushalt"**: die Posten wandern in eine
  **Haushalts-Liste**, die alle sehen und abhaken können.
* **Höchstens 2 Listen pro Haushalt** (aus allen Mitgliedern). Ist das Limit
  erreicht, kommt ein Hinweis und die Liste bleibt bei dir.
* Weg sind: Filter-Chips, Vorschlags-Chips, Mehrfachauswahl, Extra-Knöpfe und
  der Knopf "Add from recipe" - dadurch ruckelt nichts mehr.
* Tippen = abhaken, lange drücken = löschen, "Erledigt" ist eingeklappt.

## 2. Haushalt: geteilte Listen
* Neuer Abschnitt **"Geteilte Listen"** - aufklappen, Posten abhaken (alle
  dürfen), **"Zurückholen"** (Posten kommen in deine Liste) oder **"Löschen"**.
* Neue Tabelle/Funktionen: `db/3.2.0-household-lists.sql` (bitte einmal
  ausführen - ohne sie meldet "Zum Haushalt" nur, dass es nicht geklappt hat).

## 3. Tracker aufgeräumt
* **Essen, Wasser, Gewicht** sind jetzt **aufklappbar** (wie die
  Community-Challenges): Titel + Linie + Pfeil (unten = zu, oben = offen).
  Wasser/Gewicht zeigen den Wert, wenn sie zu sind - kein Scrollen mehr.
* **Makro-Aufteilung** (Makro-Energiekarte) entfernt.

## 4. Community aufgeräumt
* **Challenges** und der Knopf **"Go to my recipes"** sind raus.
* Alle Filter (Sortierung, Schwierigkeit) stecken jetzt in einem
  **Filter-Popup** hinter einem Filter-Knopf neben der Suche.

## 5. AI Chef
* **"Ernährung"** und **"Chef-Optionen"** sind eingeklappt - dadurch sieht man
  die Chef-Modi ohne Scrollen und kann leichter durchwischen.
* Alle Beschriftungen dort laufen jetzt über Übersetzungen (kein fester Text).

## 6. Einstellungen: Profil-Editor
* Neuer Abschnitt **"Profil"** mit Knopf **"Profil bearbeiten"**: ein Popup, in
  dem **alle** Profildaten an einer Stelle geändert werden (Name, Region,
  Allergien, Wasserziel, Ziel, Kocherfahrung).

## 7. Scanner: Produkte suchen
* Der Scanner kann jetzt **nach Namen suchen** (offene Produktdatenbank) -
  nicht nur scannen. Tippen auf einen Treffer übernimmt das Produkt direkt.
* Zusätzlich weiterhin: Live-Scanner (Handy hinhalten) und Foto-Weg.

## Offen (nächste Runde)
* **Video → Rezept** (Link einfügen, Rezept rausziehen) ist noch **nicht**
  gebaut. Wichtig: es soll **kein Guthaben** verbrauchen - geplant ist, das
  Rezept ohne KI aus den Video-Untertiteln zu ziehen. Sag Bescheid, dann baue
  ich es als Nächstes (mit Schalter, der standardmäßig aus ist).

## Technik
* Neu: `src/components/Collapsible.tsx`, `src/components/ProfileEditor.tsx`,
  `src/lib/i18n-320.ts` (46 neue Keys × 10 Sprachen),
  `db/3.2.0-household-lists.sql`.
* `ShoppingScreen.tsx` neu geschrieben (keine FlatList-/Chip-Last mehr).
* Alle neuen Texte über i18n-Keys, keine festen Strings.
* Version 3.2.0 (`versionCode 11`).
