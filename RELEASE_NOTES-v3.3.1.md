# Spoonful 3.3.1

Korrektur-Update zu 3.3.0. Alle Änderungen betreffen ausschließlich die App.

## Bildausschnitt: sitzt jetzt wirklich

Der Fehler war zäher als gedacht und hatte zwei Ursachen:

1. Für **ältere Ausschnitte** war die Bildgröße nicht mitgespeichert, und
   `Image.getSize` liefert bei Fotos aus der App (Kamera) keine Größe. Ohne
   Größe kann der Ausschnitt nicht berechnet werden — die Anzeige fiel auf
   „mittig, ohne Zoom" zurück. Genau das war zu sehen.
2. Die Größe wird jetzt **beim Laden des Bildes selbst** mitgelesen (`onLoad`)
   und zusätzlich beim Zuschneiden gespeichert. Damit stimmt der Ausschnitt
   auch bei alten Fotos, in jeder Rahmengröße.

Zusätzlich gibt es dafür jetzt automatische Tests (`__tests__/crop.test.ts`),
die für Quer-, Hoch-, Quadrat- und Extremformat prüfen, dass der gewählte Punkt
in der Mitte des sichtbaren Bereichs liegt.

## Dashboard / Landing

* „Neu in …" nennt jetzt **immer die installierte Version** (Platzhalter statt
  fest eingetragener Zahl).
* Die Rezeptzahl kommt **live aus der Bibliothek** statt aus einer festen
  Angabe — auch ohne Anmeldung (eigene Datenbankfunktion für den Zähler).
* Sprachzahl und Version standen schon richtig.

## Kochmodus

* Die Schritt-Hinweise (Coach-Tipp und „Achte auf") werden **übersetzt**, wenn
  die App auf einer anderen Sprache läuft (mit Zwischenspeicher, damit es
  schnell bleibt).
* Neues, klareres Layout der Hinweise: Beschriftung fett und hell, darunter der
  Text. „Achte auf" steht in einem eigenen, hellen Gelb — so ist sofort
  erkennbar, was die Aussage und was der Hinweis dazu ist.
* **Vorlesen** benutzt die Sprache **des Textes**. Ein englischer Coach-Tipp
  wird also englisch vorgelesen und nicht mehr mit deutscher Aussprache.
* „Zweites Gericht parallel kochen" ist **vollständig entfernt** (Knopf, Popup
  und die zugehörige Speicherung).

## Rezept-Formular: gleiche Feldhöhen

Bei langen Beschriftungen (deutsch z. B. „Vorbereitungszeit (min)") brach die
Beschriftung um, dadurch wurden nebeneinander liegende Felder unterschiedlich
hoch. Jetzt hat die Beschriftung eine feste Zeilenhöhe, wird bei Bedarf
automatisch kleiner und die Felder haben eine einheitliche Mindesthöhe — die
Reihen stehen in jeder Sprache exakt auf gleicher Höhe.

## „KI schätzen": stabile Nährwerte

Fünfmal schätzen ergab fünf verschiedene Kalorienwerte (1000 / 800 / 400). Das
ist jetzt behoben:

* eine feste Nährwert-Tabelle rechnet aus den Mengen der Zutaten mit,
* die KI wird mit Temperatur 0 gefragt (gleiche Frage → gleiche Antwort),
* weichen beide stark ab, wird gemittelt statt zu springen,
* das Ergebnis wird gemerkt: dasselbe Rezept liefert immer dieselben Werte.

## Tracker: Gewicht ist aufklappbar

Die Gewichts-Karte hatte keine Kopfzeile zum Ein-/Ausklappen (ein Fehler in den
vorherigen Versionen): der Knopf existierte an der falschen Stelle im Code, die
Karte war immer sichtbar. Jetzt ist sie wie „Essen" und „Wasser" ein
Aufklapp-Bereich und standardmäßig geschlossen.

## Meldungen

Alle Hinweise („gespeichert", „nicht gefunden", Rückfragen) kommen weiterhin
als gestaltete Karte in der App — keine System-Dialoge.

## Titel der KI-Rezepte

Rezepte aus einem Video-Link bekommen einen **gebauten Titel** statt des
Videotitels: Clickbait, Kanalnamen, Emojis, Hashtags, „shorts" und Schreien
werden entfernt. Passt der Videotitel schon als Gerichtname, bleibt er.
