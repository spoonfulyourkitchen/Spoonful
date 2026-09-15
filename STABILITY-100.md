# 100 Punkte: Spoonful stabiler, sparsamer und flüssiger machen

Stand: **3.2.2** (das war die Stabilitäts-Runde) · ✅ = umgesetzt · ⬜ = offen
Jeder Punkt nennt den konkreten Weg, damit die Liste etwas wert ist.

## A. Abstürze verhindern (1–20)
1. ✅ **Bildgrößen begrenzen**: Listen laden kleine Bildvarianten
   (`lib/image-url.ts` → Wikimedia-Thumbnail bzw. Supabase-Bilddienst, 2× Breite).
   Vorher hing jede Liste an den Originalfotos — die häufigste Absturzursache.
2. ✅ Bild-Fehler stürzen nicht ab: Lädt die kleine Variante nicht, kommt
   automatisch das **Original**, erst dann das Ersatzbild.
3. ✅ Alle globalen Popups (Tutorial, Update, Anmeldung, Barcode, Bild-Ausschnitt)
   hängen an einem Aufräum-Pfad — kein `setState` nach dem Schließen.
4. ✅ Timer werden beim Verlassen gelöscht (Menü, Monstr-Seite, Shell).
5. ✅ **Absturz-Protokoll** (`lib/crash-log.ts`): Bildschirm- und globale
   JS-Fehler mit Zeit und Ort (max. 25, nur Text, wird nicht gesendet).
6. ✅ Der Fehler-Bildschirm sagt, dass der Fehler gespeichert wurde, und bietet
   **Neu starten** an (statt nur „nochmal").
7. ⬜ Speicherstand prüfen: unter ~300 MB frei vor großen Ladevorgängen warnen.
8. ⬜ Alle Server-Antworten mit Standardwerten belegen (vielerorts schon so).
9. ✅ Zahlenerkennung vereinheitlicht (`parseNum`: „1,5" **und** „1.5"), getestet.
10. ✅ `at()` für sichere Array-Zugriffe (getestet) — kein Zugriff ins Leere.
11. ⬜ Kamera/Scanner nur mit Berechtigung öffnen; sonst Dialog.
12. ✅ **Live-Scanner schließt nach 45 s von selbst** (Kamera lief sonst endlos).
13. ✅ **Zeitlimit für KI-Aufrufe** (60 s, `withTimeout`) — kein Einfrieren mehr.
14. ⬜ Nach 3 Fehlversuchen derselben Anfrage eine ruhige Meldung.
15. ⬜ Doppel-Tipps beim Speichern blocken (Haushalt ist mit 85 erledigt).
16. ✅ Keine Navigation mehr aus alten Callbacks (Menü-Timer werden aufgeräumt).
17. ⬜ Beim Abmelden alle Zwischenspeicher des Nutzers leeren.
18. ⬜ Speicher-Vollstand beim Rezept-Speichern prüfen.
19. ✅ Fehler sind nach dem Neustart nachlesbar (Einstellungen → Letzte Fehler).
20. ⬜ Jede `.then()`-Kette braucht ein `.catch()` (Stichprobe ok, Rest offen).

## B. Akku (21–35)
21. ✅ Offline-Prüfung pausiert im Hintergrund, prüft beim Zurückkommen sofort.
22. ✅ Admin-Polling (45 s) hält im Hintergrund an.
23. ✅ Tutorial-Lupe misst im Hintergrund nicht mehr.
24. ✅ Tutorial-Lupe rendert nur bei echter Bewegung (vorher 3×/s).
25. ⬜ Koch-Timer nur ticken, wenn der Kochmodus offen ist.
26. ⬜ „in der Nähe"-Funktionen nur auf Tippen.
27. ⬜ Animationen auf `useNativeDriver` prüfen (Großteil ist ok).
28. ⬜ Kein `Animated.loop` auf unsichtbaren Tabs.
29. ⬜ Bildschirm/Tastatur nicht künstlich offen halten.
30. ⬜ Benachrichtigungen nur bei Änderung neu planen.
31. ⬜ Große Listen nicht im Hintergrund nachladen.
32. ⬜ Vibrations-Feedback sparsam einsetzen.
33. ⬜ Bild-Zwischenspeicher begrenzen.
34. ⬜ Akku < 15 %: Animationen und Live-Scanner aus.
35. ⬜ Akku-Test-Skript (10 Min Kochmodus + Scrollen) als Vergleichswert.

## C. Flüssiger / kein Ruckeln (36–50)
36. ✅ Hintergrund-Verläufe memoisiert (kein SVG-Neuaufbau je Tastendruck).
37. ✅ Übersetzungen werden zwischengespeichert.
38. ✅ Monstr-Trefferliste memoisiert (FlatList-Tuning).
39. ✅ Bibliothek lädt Thumbnails — das war der größte Ruckler.
40. ✅ Bilder werden in der richtigen Größe angefordert.
41. ⬜ Suche: alte Anfragen wirklich abbrechen.
42. ⬜ Community-Liste: gleiche Einstellungen wie Bibliothek prüfen.
43. ⬜ Bilder außerhalb des Bildschirms gar nicht erst zeichnen.
44. ⬜ Ladezustände als Skelett statt Spinner-Wechsel.
45. ⬜ Keine vollflächigen Schatten in Listen.
46. ⬜ Tab-Wechsel: Screens nach Inaktivität entladen.
47. ⬜ Kochmodus: Schritt-Liste virtualisieren.
48. ⬜ Kopfbereich nicht bei jedem Scroll neu bauen.
49. ✅ Messungen nur bei sichtbarem Popup (Tutorial-Lupe macht es jetzt so).
50. ⬜ Profiler: 500 ms Bildzeit als Ziel pro Screen.

## D. Speicher & Bilder (51–62)
51. ✅ Fotos werden vor jedem Anzeigen verkleinert angefordert (Punkt 1).
52. ⬜ Fotos vor dem Hochladen auf max. 1600 px kürzen.
53. ⬜ Bild-Zwischenspeicher (Cache) auf 60 MB begrenzen.
54. ⬜ Kein `base64` für Bilder im Zustand (vielfacher Speicherbedarf).
55. ✅ Ausschnitt wird als Fokuspunkt + Zoom gespeichert (klein, keine Kopie).
56. ✅ Ausschnitt-Popup zeigt das ganze Bild (kein „reingezoomt ohne Ausweg").
57. ⬜ Ausschnitt: Vorschau für 3 Rahmengrößen (Karte, Kopf, Quadrat).
58. ⬜ Bilder nach dem Hochladen komprimiert neu laden.
59. ⬜ Abgebrochene Uploads aufräumen.
60. ✅ Fehlende Bilder werden eindeutig ersetzt (Ersatzbild statt Spinner).
61. ✅ Rezept-Details/Listen laden keine Originalbilder mehr (Punkt 1).
62. ⬜ Beim Beenden Zwischenspeicher nicht komplett neu schreiben.

## E. Netz & Offline (63–75)
63. ✅ Monstr: drei Quellen parallel, jede mit 9-s-Zeitlimit, Ausfall egal.
64. ✅ Monstr: Antworten tolerant lesen (Feldnamen können sich ändern).
65. ✅ Monstr: letzter Stand erscheint sofort aus dem Zwischenspeicher.
66. ✅ Video-Rezept: Beschreibung und Untertitel getrennt, und die App sagt,
   woher der Text kam („Aus dem Video-Text zusammengestellt").
67. ⬜ Video-Rezept: „Text einfügen"-Feld als letzter Ausweg.
68. ⬜ Video-Rezept: Zwischenspeicher pro Link (derselbe Link = sofort da).
69. ⬜ Instagram/TikTok: bei Login-Sperre ehrlich sagen, warum es nicht geht.
70. ✅ `withTimeout`/`fetchText` (mit Abbruch) für Anfragen — nichts hängt mehr.
71. ✅ **Offline-Anzeige mit Anzahl**: „Offline · 3 Änderungen warten".
72. ⬜ Beim Zurückkommen aus dem Offline alle Listen einmal auffrischen.
73. ⬜ Server-Fehlermeldungen in die Sprache der App übersetzen.
74. ⬜ Doppelte Anfragen derselben Daten zusammenfassen.
75. ⬜ „Kein Internet"-Seite mit direktem „Erneut versuchen".

## F. Daten & Bugs (76–88)
76. ✅ Teilen-Ziel (TikTok/YouTube/Instagram → Spoonful): `onNewIntent` setzt
   den Intent — das war der Grund, warum es nur beim ersten Start ging.
77. ✅ Video-Rezept: relative Untertitel-Adresse wurde nicht ergänzt (der Grund,
   warum NIE ein Rezept rauskam).
78. ✅ Video-Rezept: Text wird auch in Sätzen/Abschnitten/Komma-Listen gesucht.
79. ✅ Video-Rezept: Notfall über Gratis-KI-Modelle, wenn lokal nichts passt.
80. ✅ Video-Rezept: statt „nichts" kommt notfalls der Text mit „bitte prüfen".
81. ✅ Drei Absturz-Ursachen behoben (Hooks standen hinter der Offline-Seite in
   AssistantScreen, CommunityScreen, LibraryScreen).
82. ✅ **Einkaufsliste legt nichts doppelt an** (innerhalb der Anfrage und
   gegenüber der offenen Liste).
83. ✅ Tracker akzeptiert „1,5" und „1.5" (Alter, Größe, Gewicht).
84. ✅ **Kochmodus** merkt sich die Sitzung und sagt es: „Weiter bei Schritt 4".
85. ✅ **Haushalt teilen** ist gegen Doppel-Tippen geschützt.
86. ⬜ Kontrolle: nach dem Anmelden Profil nur einmal laden.
87. ⬜ Datums-/Zeitzonen rechnen überall auf dieselbe Weise.
88. ✅ Bibliothek lädt seitenweise (24 + „mehr laden") — kein 1000er-Ruckler.

## G. Prüfen, Messen, Ausliefern (89–100)
89. ✅ Tests laufen wirklich: **55 automatische Prüfungen** (Preise, Video-Text,
   Bild-Ausschnitt, Bildgrößen, Zeitlimits, Absturz-Protokoll).
90. ✅ `tsc --noEmit` und `eslint --quiet` laufen fehlerfrei durch.
91. ✅ Prüfskripte: `tools/video-check.mjs`, `tools/monstr-check.mjs`.
92. ✅ Prüf-Routine vor jeder Version steht in der README (Typen + Tests + Lint).
93. ⬜ Ein echtes Gerät mit wenig Speicher (2–3 GB) als Testgerät festlegen.
94. ⬜ Google Play „Pre-launch report" / Crash-Liste lesen.
95. ✅ `node tools/check-version.mjs` vergleicht `versionName`, `versionCode`,
   `APP_VERSION` und die Release-Notizen.
96. ⬜ `npm audit`/Abhängigkeiten regelmäßig aktualisieren.
97. ✅ Release-Notizen je Version im Repo (`RELEASE_NOTES-v3.2.2.md` …).
98. ⬜ Kaltstart-Zeit messen (Ziel < 2 s bis zum ersten Bild).
99. ⬜ Nutzer-Feedback-Feld in den Einstellungen.
100. ✅ Nach jedem Fix ein Test, der den Fehler festhält (Video-Rezept,
   Preis-Logik, Ausschnitt, Thumbnails, Zeitlimits).

## Wie man das prüft (1 Minute)
```
cd mobile
npx tsc --noEmit        # Typen
npx jest                # 55 Tests
npx eslint src --quiet  # Fehler
```

