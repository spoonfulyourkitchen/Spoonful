## Spoonful 3.7.0

Das Personalisierungs-Update: deine Angaben werden einmal kurz aufgefrischt, Mahlzeiten kommen direkt aus deinen Rezepten, und Bibliothek und KI-Koch richten sich nach deiner Erfahrung.

**Download:** `Spoonful-v3.7.0.apk` unten unter Assets. Android 7.0 oder neuer, arm64 und armv7. Installation wie gewohnt über die APK, bereits installierte Versionen werden aktualisiert.

### Neu

**Profil-Auffrischung für Bestandsnutzer**
Wer schon länger dabei ist, bekommt beim Start einen kurzen Hinweis, warum ein paar Angaben jetzt wichtig sind: Allergien, Ernährung, Kocherfahrung, Haushaltsgröße, Kochzeit und Küchen. Rezepte, Bibliothek und KI-Koch können nur passen, wenn sie diese Angaben kennen. Ein Tipp auf "Jetzt ergänzen" öffnet eine kompakte Fassung des Onboardings mit nur diesen Fragen, die bestehenden Antworten bleiben erhalten. Wer neu anfängt, sieht den Hinweis nicht, weil das Onboarding diese Angaben schon abfragt.

**Mahlzeit aus Rezepten erfassen**
"Mahlzeit erfassen" startet mit zwei Tabs: links ein Rezept aus der eigenen Sammlung mit Portions-Schritten, rechts die manuelle Eingabe. Damit landen Nährwerte aus dem Rezept direkt im Tracker, statt abgetippt zu werden.

**Barcode mit Codefeld**
Die Karte heißt wieder "Barcode", und im Scanner gibt es unter der Produktsuche ein Feld, um die Nummer direkt einzutippen. Die Foto-Erfassung bleibt als Rückfallebene.

**Bibliothek aufgeräumt**
Filter und Küchen-Auswahl öffnen als zentrierte Dialoge, die Bibliothek bleibt dahinter sichtbar. Die Küchen-Auswahl liegt über dem Filter, der Schließen-Knopf ist wieder da, und die Rezepte sind nach Bild und Alphabet sortiert.

**Erfahrung wächst mit**
Neue Konten starten mit einfachen Rezepten. Nach etwa drei Wochen kommen mittlere Schwierigkeiten dazu, nach etwa acht Wochen alle. Der KI-Koch arbeitet mit derselben Stufe.

**KI-Koch mit Zielgewicht**
Der Prompt nutzt jetzt aktuelles und Zielgewicht für Portionsgröße und Energiedichte, zusammen mit Ziel, Küchen, Allergien und Erfahrung.

**Schlankeres Rezeptformular**
Foto, Titel, Zutaten, Schritte. Alles andere, also Zeiten, Portionen, Tags und Nährwerte, liegt zusammengeklappt unter "Details".

**Kleineres**
Ernährungs-Tags und Schwierigkeits-Stufen sind vollständig übersetzt, die Portionsanzeige im Rezeptdetail stimmt wieder, Haushalt und Tracker haben ihre neuen Karten, und die Texte im Kochmodus sind klarer.

### Technisch

- Version 3.7.0, Build 28, minSdk 24, targetSdk 36
- ABIs: arm64-v8a, armeabi-v7a
- Hermes-Bundle, kein R8/Minify
- Keine Datenbank-Migration nötig, bestehende Konten und Daten bleiben unverändert

### Hinweis

Die App spricht weiterhin mit demselben Backend wie 3.6.x. Wer von 3.6.1 aktualisiert, behält Rezepte, Einkaufsliste, Tracker und Haushalt.
