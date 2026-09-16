# Spoonful 3.2.3 — Feinschliff, Geschwindigkeit und das KI-Tageslimit

Diese Version räumt auf: MONSTR ist wieder raus, die Einkaufsliste läuft lokal,
Textfelder gehen mit der Tastatur mit, und die KI hat ein faires Tageslimit.

## 1. MONSTR ist entfernt
* Die Seite („Dosen-Angebote") hat nie so funktioniert wie gedacht — sie ist
  komplett aus der App raus: Tab, Menü-Eintrag und die zwei Tour-Schritte.
* Kein toter Code bleibt zurück (Screen, Deal-Logik und Tests sind gelöscht).

## 2. KI: 3 Nutzungen am Tag, Zähler im Kopf
* **Alle drei** Chef-Funktionen (Zutaten, Beschreiben, Video-Link) teilen sich
  **3 Nutzungen pro Tag** — für alle Nutzer außer Mods und Admins.
* Gezählt wird serverseitig in der Datenbank (`ai_usage`), also geräteübergreifend
  und nicht durch einen App-Neustart zurücksetzbar.
* **Zähler** steht oben rechts neben „Spoonful · AI Chef" (`2/3`); ist er leer,
  wird er rot und die KI meldet klar „für heute aufgebraucht".

## 3. Video → Rezept: die KI ergänzt fehlende Schritte
* Vorher wurde die Videobeschreibung **1:1** als Rezept übernommen — inklusive
  allem, was nicht in ein Rezept gehört.
* Jetzt: Zutaten werden aus dem Video erkannt; sind **zu wenige Schritte** dabei
  (typisch bei Reels), ergänzt die KI sie und räumt den Text auf. Die Zutaten
  aus dem Video bleiben erhalten (die KI füllt nur auf).
* Die Wisch-Hinweise im Chef sind eindeutig: „← beschreiben · nochmal ← Video"
  und „→ zurück". Die Video-Seite wird also nicht mehr übersprungen.

## 4. Einkaufsliste: lokal, sofort, offline
* Jede Aktion ging vorher zum Server → träge, und ohne Netz gar nicht bedienbar.
* Jetzt ist der **lokale Speicher** die Anzeige-Quelle: abhaken, hinzufügen,
  löschen sind **sofort** da und funktionieren **offline**. Ist Netz da, wird im
  Hintergrund zusätzlich synchronisiert.
* Ohne Netz ist der Knopf „Zum Haushalt" ausgeblendet (dafür braucht es den
  Server), die Liste selbst bleibt voll nutzbar.

## 5. Textfelder gehen mit der Tastatur mit
* Alle Dialoge mit Eingabefeldern (Haushalt, Kommentare, Portionen, Profil,
  Rezept-Formular, Tracker, Einstellungen …) liegen jetzt in einer
  `KeyboardAvoidingView`: das Feld wandert mit der Tastatur nach oben, man sieht
  immer, was man schreibt.

## 6. Haushalt im dunklen Theme
* Die Eingabefelder waren im dunklen Theme hell/weiß. Sie nutzen jetzt feste
  Theme-Flächen mit Rahmen — in jedem Theme korrekt.

## 7. Bilder: Ausschnitt stimmt wieder
* Beim Zuschneiden zeigte die App immer die **Bildmitte** statt der gewählten
  Stelle. Ursache: gerechnet wurde mit der Rahmengröße statt mit der echten
  Bildgröße (bei breiten Fotos verschob sich dadurch alles).
* Jetzt wird die Bildgröße mitgelesen und der gewählte Bereich exakt gezeigt.

## 8. Optik
* **Haupt-Theme ohne Glasmorphismus**: keine Farbschleier mehr, sondern die
  cleane Theme-Fläche; Karten sind flächig mit Rahmen.
* **Logo mit Theme-Hintergrund**: das Logo sitzt in einer themefarbenen Fläche
  und leuchtet auf dunklen Themes nicht mehr als heller Kasten.

## 9. Tracker, Bibliothek, Community, Rechtstexte
* Tracker: das Essens-Feld ist **standardmäßig geschlossen**, die Karte
  „Macro Split" ist entfernt (die Makros stehen weiter in der Plan-Karte).
* Bibliothek lädt **50** statt 24 Rezepte pro Seite.
* Community: die Box „The shared table" ist weg; alle alten geteilten Rezepte
  wurden gelöscht (Liste startet leer).
* Rechtstexte (Impressum, Datenschutz, Cookies, AGB) nennen jetzt **automatisch**
  die installierte Version und den aktuellen Stand — kein veraltetes Datum mehr.
* Landing/Dashboard zeigt **echte Zahlen**: die Rezeptzahl kommt live aus der
  Bibliothek, die Sprachzahl aus der Sprachliste, die Version aus der App.

## 10. Android: aufgeräumter Bildschirm
* Die **System-Navigationsleiste** (Gesten/3 Tasten) verschwindet, solange die
  App offen ist — wie bei anderen Apps. Ein Wisch von unten holt sie kurz zurück.
