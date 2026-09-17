# Spoonful 3.3.0

Diese Version behebt die wichtigsten Alltagsprobleme: Tastatur und Eingabefelder,
Kochmodus, Bildausschnitt, KI-Rezepte, Barcode-Erkennung und Geschwindigkeit.
Zusätzlich: alle Hinweise erscheinen jetzt im App-Design statt als System-Dialog.

## Tastatur und Eingabefelder

* Eingabefelder wurden von der Tastatur verdeckt — man konnte nicht sehen, was
  man schreibt. Ursache war Edge-to-Edge unter Android 15+: `adjustResize` aus
  dem Manifest wirkte dadurch nicht mehr.
* Die App schiebt den Inhalt jetzt selbst hoch (eine KeyboardAvoidingView auf
  App-Ebene, zusätzlich in jedem Dialog mit Eingabefeldern, weil Dialoge in
  einem eigenen Fenster liegen).
* Gilt überall: Haushalt, Einkaufsliste, Kommentare, Profil, Rezept-Formular,
  Tracker, Einstellungen, Kochmodus-Notizen.

## Meldungen im App-Design

* Alle System-Dialoge (`Alert`) wurden ersetzt. Hinweise, Rückfragen und Fehler
  erscheinen als Karte in der App, in Theme-Farben, in der eingestellten Sprache
  und ohne gerätespezifische Optik.
* Am Ende des Kochmodus gibt es keine „zackige" Systemmeldung mehr; der Modus
  wechselt einfach in den Fertig-Zustand. Die Mahlzeit wird still im
  Hintergrund erfasst.

## Kochmodus

* Jeder Schritt hat einen Bereich mit „Coach-Tipp" und „Achte auf". Diese
  Hinweise gehören zum Rezept (Bibliotheksinhalt) und sind pro Schritt
  hinterlegt; ist ein Rezept noch ohne Hinweise, sagt die App das offen, statt
  allgemeine Sätze zu erfinden.
* Neuer Vorlesen-Knopf neben jedem Schritt: die App liest den Schritt vor, damit
  man beim Kochen nicht auf das Display sehen muss. Nochmal tippen stoppt. Gilt
  für den klassischen und den erweiterten Kochmodus; fehlt die Sprachausgabe auf
  dem Gerät, wird der Knopf nicht angezeigt.
* Langes Drücken auf die Schritt-Box öffnet nur diese Box als Pop-up: ohne
  Vorbereitungsteil darüber und ohne Timer-Liste darunter. Das Pop-up scrollt
  nicht, dafür lässt sich darin bequem zwischen den Schritten wischen; der Timer
  für den Schritt lässt sich auch dort starten.
* Die Zusätze „hinzugefügt" beim Beenden sind entfernt.

## Bilder

* Der Bildausschnitt zeigte immer die Bildmitte statt der gewählten Stelle. Die
  Anzeige konnte die Bildgröße nicht zuverlässig ermitteln (bei Bildern aus der
  Kamera/App als data-URL), und ohne Größe ließ sich der Ausschnitt nicht
  berechnen.
* Jetzt wird die Bildgröße beim Zuschneiden mitgespeichert und beim Anzeigen
  verwendet — der gewählte Bereich erscheint exakt, in jeder Rahmengröße.

## KI

* Rezepte der KI haben jetzt mindestens 8 Schritte und je Schritt eine Handlung
  mit Mengen und Zeiten im Text.
* Video-Erkennung: Beschreibungen enthalten fast immer Text, der kein Rezept ist
  (Abo-Aufrufe, Links, Hashtags, Werbung, Zeitstempel, „bewertet das Video").
  Diese Zeilen werden erkannt und entfernt. Danach ordnet die KI den Text
  vollständig: Zutaten sauber, Schritte vollständig — fehlende offensichtliche
  Schritte werden ergänzt, ohne Zutaten zu erfinden.
* Übersetzer: die Quellsprache wird automatisch erkannt (vorher immer Englisch,
  dadurch wurden deutsch/arabisch verfasste Rezepte falsch übersetzt) und bereits
  übersetzte Zeilen werden zwischengespeichert — Umschalten und erneutes Öffnen
  sind sofort da.

## Tracker

* Die Gewichts-Box ist wie Wasser und Essen standardmäßig geschlossen und wird
  bei Bedarf geöffnet.
* Barcode: deutlich mehr Produkte werden erkannt.
  * Namen fehlten bisher bei vielen Einträgen (nur generischer oder fremd-
    sprachiger Name) und der Treffer wurde verworfen. Jetzt werden alle
    Namensvarianten genutzt, zur Not Marke + Menge.
  * EAN-8, UPC-A und EAN-13 werden als Varianten abgefragt (mit und ohne
    führende Null), zusätzlich zwei Datenbank-Endpunkte.
  * Einträge ohne Nährwerte werden nicht mehr als Treffer ausgegeben.

## Sonstiges

* Einkaufsliste: die leere Liste zeigte den technischen Schlüssel
  `shopping.empty` als Text. Sie zeigt jetzt den richtigen Text.
* Ist ein Text in einer Sprache nicht hinterlegt, wird nie mehr ein technischer
  Schlüssel angezeigt, sondern ein lesbarer Ersatz.
* Bibliothek/Landing zeigen die echte Rezeptzahl (live aus der Bibliothek statt
  fester Marketing-Zahl).
* Einkaufsliste läuft weiter lokal und sofort; Aktualisierungen lösen nur noch
  die betroffene Zeile aus statt der ganzen Liste.
