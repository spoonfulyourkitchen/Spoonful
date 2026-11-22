# Spoonful – Premium-Audit (Design + Funktionen)

Stand: 19.11.2026 · Basis: kompletter Quellcode der Android-App (`mobile/`, 60 Screens/Komponenten, 10.100 Zeilen nur Screens), Theme-/Token-Analyse, Feature-Inventar, Wettbewerbs- und Benchmark-Recherche.

---

## 0. Prüfstatus – was gemessen wurde und was nicht

**Live-Test der App: nicht möglich gewesen.** Auf dem Rechner ist kein Android-Gerät erreichbar:

| Prüfung | Ergebnis |
|---|---|
| `adb devices -l` | Liste leer (mehrfach, über ~2 Minuten gepollt) |
| USB-Geräte (`Get-PnpDevice -Class USB`) | kein Android/ADB-Gerät angeschlossen |
| `adb mdns services` | keine Wireless-Debugging-Geräte im Netz |
| Emulator | startet nicht: `x86_64 emulation currently requires hardware acceleration!` |
| Ursache | `systeminfo`: „Virtualisierung in Firmware aktiviert: **Nein**" → VT-x ist im BIOS aus, deshalb lädt der AEHD-Treiber nicht (auch mit Admin-Rechten: `StartService` Fehler 0xFFFFFFA1) |
| Drittanbieter-Runtimes (BlueStacks/LDPlayer/WSA/MuMu) | nicht installiert |
| Release-APK | gebaut und vorhanden: `mobile/android/app/build/outputs/apk/release/app-release.apk`, 78,5 MB, `BUILD SUCCESSFUL` |

Konsequenz: Dieser Audit ist eine **Code- und Designsystem-Analyse plus Wettbewerbs-Benchmark**, kein Klick-Durchlauf. Alles, was nur im Betrieb sichtbar wird (echte Ladezeiten, Animationen auf 60/90/120 Hz, Tastatur-Verhalten, Fehlermeldungen bei Netzabbruch, Auth-Flow mit deinem Admin-Konto), ist hier **nicht** bewertet und in Abschnitt 9 als offen markiert.

Zum Freischalten reicht eins von beidem:
1. **Handy per USB** anschließen, USB-Debugging an, „Dateizugriff zulassen" bestätigen → ich installiere das APK und teste jede Funktion mit `salemibrahim011275@gmail.com`.
2. **VT-x/SVM im BIOS** aktivieren (Intel VT-x bzw. AMD-V, meist „Virtualization Technology"), Rechner neu starten → dann läuft der Emulator und ich teste dort.

---

## 1. Feature-Inventar (Ist-Zustand)

Spoonful ist funktional **deutlich weiter, als es aussieht**. Das ist der wichtigste Befund: das Problem ist fast nie „Feature fehlt", sondern „Feature ist versteckt, unfertig inszeniert oder nicht monetarisiert".

| Bereich | Datei | Vorhanden | Fehlt für „Premium" |
|---|---|---|---|
| **Onboarding** | `LandingScreen.tsx` | 17-Schritte-Interview vor der Registrierung: Ziel, Geschlecht, Alter, Größe, Gewicht, Aktivität, Zielgewicht, Diät, Allergien, Kocherfahrung, Haushaltsgröße, Kochzeit, Küchen, Erinnerungen, Review, Rating + Fortschrittsbalken, Skip, Autosave, Reduce-Motion-Support | Kurz-Onboarding (3–5 Schritte), „Aha"-Moment vor Registrierung, Personalisierung sichtbar machen (echte Beispiel-Rezepte statt Zahlen), Rating nicht vor Account-Erstellung |
| **Auth** | `AuthScreen.tsx` | Login, Registrierung (2 Schritte), Magic-Link/OTP, Passwort-Reset, Google-Login, Passwort-Stärke, 3 Pflicht-Consents, Resend-Mail | Social-Login-Parität (Apple), „Continue as guest" mit späterer Migration, Biometrie-Entsperrung |
| **Library/Discovery** | `LibraryScreen.tsx` | Suche mit Debounce + Übersetzung, 6 Filter (Küche, Mahlzeit, Zeit, Kalorien, Schwierigkeit, Diäten), Sortierung, „Match %", Saison-Filter, „Was kann ich kochen?"-Pantry, Filter-Presets, Suche in eigenen/gespeicherten Rezepten, Zufallsrezept, 2-Spalten-Grid oder Zeit-Gruppierung, Offline-Cache pro Filterkombination, Melde-Funktion für falsche Bilder (Admin) | Personalisierter „Für dich"-Feed, Social Proof (Sterne, „X-mal gekocht"), Video-/Reels-Feed, „passt zu deinem Tagesziel"-Sortierung, kuratierte Collections, Kochmodus-Vorschau auf der Karte |
| **Eigene Rezepte** | `MyRecipesScreen.tsx`, `RecipeFormScreen.tsx` | Anlegen/Bearbeiten/Löschen, Foto + Crop, KI-Nährwertschätzung mit Annahmen, Draft-Wiederherstellung, Diät-Tags | Import per URL/Foto/PDF, Duplikat-Erkennung, Zutaten-Autocomplete, Portionslogik beim Speichern, Rezept-Versionierung |
| **Rezeptdetail** | `RecipeDetailScreen.tsx` | Speichern in Collections, Favorit, Zutaten zur Einkaufsliste, Mahlzeit loggen, Teilen als Text, Rezept-Übersetzung (KI) mit Korrektur-Meldung, Schrittfotos/Slideshow, Scroll-to-top, Speicher-Animation | „Nachgekocht"-Bewertung mit Foto, Nährwerte pro Portion umschaltbar, ähnliche Rezepte, Autor*innen-Profil, Offline-Pinning |
| **Kochen** | `CookingScreen.tsx` | Schritt-für-Schritt, mehrere Timer (`kitchenTimers`), Sprachausgabe (TTS), Sub-Steps, automatische Schritt-Minuten, Portionsskalierung mit Brüchen, Schrittfotos machen/auswählen/croppen, Notizen, Bildschirm-Sperre-Schutz, Fortschritt speichern (`cooking-extras`) | Keep-awake, Handschuh-/Großmodus, Timer-Erkennung aus Text 100 %, „Schritt wiederholen"-Sprachbefehl, Live-Activity/Widget, Multi-Device-Timer-Sync |
| **AI-Assistent** | `AssistantScreen.tsx` | 3 Modi per Swipe (Zutaten, Freitext-Beschreibung, Video-Link), Optionen (Portionen, Küche, Max-Zeit, Schwierigkeit, Schärfe, leichter, kinderfreundlich, Equipment), Reroll, Verlauf (24 lokal), Teilen-Ziel aus anderen Apps, Offline-Erkennung, Status-Pille im Header | **Foto → Rezept** (Kamera), Spracheingabe, Streaming, sichtbare KI-Quota/Abo, Wochenplan-Generator, Allergen-Guardrail-Anzeige, „warum dieser Vorschlag" |
| **Tracker** | `TrackerScreen.tsx`, `TrackerExtras.tsx` | Mifflin-St-Jeor-BMR/TDEE, Kalorien-/Makro-Ziele, Tagesbilanz, 7-Tage-Chart, Wochenbericht, Streak, Badges, manuelles Log, Barcode (Long-Press auf Tab), Profil-Editor, Offline-Queue | Foto-Logging (KI), Wasser-Tracking-UI, Gewichtsverlauf-Chart, Mahlzeiten-Slots (Frühstück/Mittag/Abend/Snack), Health-Connect/Google-Health, Widgets, Mahlzeiten-Erinnerungen |
| **Community** | `CommunityScreen.tsx`, `CommentSheet.tsx` | 2-Seiten-Feed mit Swipe, Likes, Kommentare, Melden, Schwierigkeits-Filter, Suche, Sortieren, Speichern, Pull-to-Refresh | Creator-Profile + Follower, „nachgekocht"-Remix, Bewertungen mit Foto, Trending, Push bei Interaktion, transparente Moderation |
| **Einkaufsliste** | `ShoppingScreen.tsx` | Lokal-first, nach Rezept gruppiert, Abhaken, Undo (5 s), „Erledigt"-Bereich, Fortschrittsbalken, Teilen in den Haushalt, Draft-Erhalt | Gang-Reihenfolge (Aisle), Mengen zusammenführen (2× Zwiebel), Preise/Summe, Barcode-Abhaken, Sprach-Add, Widget/Watch, Sync-Konflikt-UI |
| **Haushalt** | `HouseholdScreen.tsx`, `lib/household.ts` | Mitglieder + Rollen, QR-/Code-Invite, Tasks, Wochenplan, Notizen, Ausgaben, Event-Log, Statistiken, geteilte Listen, „wer kocht was" | Echtzeit (aktuell Query/Polling), Live-Aktivitätsfeed, Push, klare Rechte-Erklärung, Onboarding in den Haushalt |
| **Dashboard** | `DashboardScreen.tsx` | Begrüßung nach Tageszeit, 3 Stats, Kalorienbalken, Streak, Quick-Links, Getting-Started-Checkliste | Ist nicht die Startseite, keine Karte „heute kochen", kein Wochenziel, Checkliste hat einen Bug |
| **Settings** | `SettingsScreen.tsx` | 11 Sprachen, Profil, Notification-Prefs (5 Typen), Theme, Feedback mit Sternen, Datenexport, Account-Löschung, Haushalt, Crash-Log, Tutorial-Neustart, Kochmodus-Advanced | Abo-Verwaltung, Einheiten (metrisch/imperial), Barrierefreiheits-Center, Datenschutz-Dashboard |
| **Themes** | `ThemeScreen.tsx`, `theme.ts` | **20 Themes**, automatische Kontrast-Korrektur (`surfaceForContrast`, `foregroundOn`), Live-Umschaltung ohne Neustart | Kuratierte 3–4 Modi statt 20, System-Dark-Mode-Erkennung, kein Theme-Export/Teilen |
| **Monetarisierung** | – | **nichts** | kein IAP, keine Paywall, kein Trial, keine Quoten, kein Premium-Gating |

---

## 2. Die fünf strukturellen Probleme

### 2.1 Navigation: 8 Tabs, von denen man 5 sieht

`RootTabs.tsx` legt 8 Tabs an (`Library, MyRecipes, Assistant, Saved, Tracker, Community, Shopping, Household`) und berechnet die Breite als `Math.max(70, width / 5)`. Auf einem 390-pt-Gerät sind das 78 pt pro Tab → **acht Tabs passen nie auf den Schirm**, die Leiste scrollt horizontal. Der wichtigste Ort des Produkts (Haushalt, Community, Shopping) ist damit hinter einer Wischgeste versteckt, die niemand entdeckt. Zusätzlich dupliziert das Drawer-Menü (`Shell.tsx`) dieselben Ziele ein zweites Mal — zwei Navigationen für ein Produkt.

Premium-Apps haben 3–5 Tabs und **eine** Hierarchie. TikTok: 5. Duolingo: 5. Spotify: 4 + „More". Instagram: 5. Keine einzige Top-App versteckt Kernfunktionen in einer scrollenden Tab-Leiste.

**Empfehlung:** 5 Tabs — `Home`, `Discover`, `AI`, `Track`, `More`. Home = Dashboard (Begrüßung, Streak, „Heute kochen"-Karte, Kalorien, Wochenziel). Discover = Library + Community als Segmented Control (Feed/Rezepte). More = Kitchen, Saved, Shopping, Household, Settings, Theme, Admin. Long-Press-Aktionen (Barcode) bleiben, werden aber zusätzlich als sichtbare Buttons angeboten.

### 2.2 Onboarding: 17 Fragen vor dem ersten Wert

`LandingScreen.tsx` baut die Schrittliste dynamisch: `welcome, goal, sex, age, height, weight, activity, [target], diet, allergies, experience, household, time, cuisines, reminders, review, rating`. Das sind 16–17 Screens, jeder mit „Weiter"-Button, davor keinerlei Produkterlebnis. Der Nutzer gibt Körperdaten und Allergien ein, bevor er ein einziges Rezept gesehen hat.

Benchmark: Adapty (State of Onboarding 2026) nennt **5 Screens als Median**; die Abschlussquote liegt bei **89,7 % bei 1–5 Screens gegenüber 62,8 % bei 21+ Screens**, der größte Einzelabbruch bereits auf Screen 1 (10,2 %). Gleichzeitig zeigt derselbe Report, dass lange Flows *mehr* Umsatz pro Öffnung bringen können — die Lösung ist also nicht „alles weg", sondern **Wert vor Abfrage**: erst kurz, dann progressiv nachfragen.

Dazu kommt: der **Rating-Schritt liegt vor der Account-Erstellung**. Ein 5-Sterne-Dialog, bevor der Nutzer die App benutzt hat, ist der klassische Weg zu 1-Stern-Reviews und ein App-Review-Risiko.

**Empfehlung:**
- **Schritt 1–3 (max. 45 s):** Ziel (abnehmen/halten/zunehmen) → Ernährungsform + Allergien → Kochzeit. Danach sofort ein personalisiertes Ergebnis: „3 Rezepte, die zu dir passen" (echte Bilder aus der Library).
- Alles andere (Alter, Größe, Gewicht, Aktivität, Erfahrung, Haushalt, Küchen) als **eine** optionale „Profil verfeinern"-Seite nach dem ersten gekochten Rezept, erreichbar aus dem Tracker — dort ist der Nutzen offensichtlich.
- Rating erst nach dem 3. gekochten Rezept, mit `In-App-Review`-Trigger, nicht im Onboarding.

### 2.3 Kein einheitliches Designsystem – zwei Systeme parallel

Es gibt `components/ui.tsx` mit `GlassCard` (Radius 22), `AppButton` (Radius 14), `Chip` (Radius 999), `TextField`, `PageHeader` (30 pt Serif), `Segmented`, `EmptyState`, `InfoBox`. Daneben stehen hunderte Inline-Styles mit frei gewählten Werten: Radien 9, 10, 12, 13, 14, 16, 18, 20, 22, 26; Schriftgrößen 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 19, 20, 21, 22, 26, 27, 28, 30, 34, 40, 46. Das ist keine Skala, das ist Akkumulation.

Weitere Belege:
- **Typografie:** `fonts.display = Platform.select({ ios: 'Georgia', android: 'serif' })` — auf Android ist das die System-Serif, also Times-artig. Eine Premium-Marke hat eine eigene Display-Schrift (Headspace: Aperçu; Duolingo: Feather Bold). System-Serif liest sich wie ein 2014er-Blog.
- **Elevation:** `glassShadow('sm'|'md'|'lg'|'xl')` existiert, wird aber fast überall als `'md'` benutzt → alle Karten liegen auf derselben Ebene, keine Tiefen-Hierarchie.
- **Farben:** 20 Themes (Warm Cream, Midnight, Ocean, Forest, Sunset, Lavender, Rose Gold, Arctic, Coffee, Olive, Coral, Slate, Champagne, Sage, Terracotta, Nordic, Honey, Charcoal, Plum, Berry Dark) mit je 5 Farben. Weil der Akzent automatisch auf 4.5:1 Kontrast korrigiert wird, sehen viele Themes am Ende ähnlich aus — viel Pflegeaufwand, wenig Markenwirkung.
- **Bilder:** `RecipeImage` setzt keine feste Aspect Ratio und keinen Placeholder → beim Nachladen springt das Layout.
- **Motion:** ausschließlich `Animated` (Timing/Spring, `useNativeDriver`). Kein `react-native-reanimated` (nicht in `package.json`), kein Lottie, keine Shared-Element-Transitions, keine Haptik (`expo-haptics`/`react-native-haptic-feedback` fehlen komplett — `code_search` nach `Haptic` liefert 0 Treffer außer i18n-Texten).

**Empfehlung (das ist der günstigste Premium-Sprung überhaupt):**
1. **Type-Scale mit 6 Rollen** statt 26 Größen: Display 30/34, Title 22/28, Headline 17/24, Body 15/22, Caption 13/18, Micro 11/14. Serif nur für Display + Title.
2. **Spacing-Grid 4/8:** alle Paddings/Gaps aus `{4, 8, 12, 16, 20, 24, 32}`.
3. **Radien-Set:** 12 (Controls), 16 (Chips/Inputs), 20 (Karten), 28 (Sheets), 999 (Pills). Schluss mit 9/13/18/26.
4. **Elevation 3 Stufen:** 0 flach (Listen), 1 Karte, 2 Overlay/Sheet.
5. **Haptik** bei Commit-Aktionen (Speichern, Abhaken, Timer-Start, Schritt-Weiter) — Duolingo berichtet, dass animierte Streak-Meilensteine die 7-Tage-Bindung neuer Lernender erhöhten.
6. **Skeletons** statt Spinner (siehe 2.4).
7. **Themes auf 4 reduzieren** (Light, Dark, Warm, High Contrast) — oder 20 behalten, aber nur 4 als „kuratiert" zeigen und den Rest unter „Alle Themes".

### 2.4 Zustände: Fake-Ladebalken, Vollbild-Offline, keine Skeletons

- **Library:** `loadPct` wird per `setInterval` mit einer Easing-Kurve hochgezählt (`1 - Math.exp(-elapsed / 2.2)`), während der echte Request läuft. Ein Ladebalken, der lügt, ist das Gegenteil von Premium — Nutzer merken es, wenn die Seite bei 93 % hängt.
- **Saved/MyRecipes:** zentrierter `ActivityIndicator` ohne Struktur. Premium-Apps zeigen das Layout schon und füllen es (Skeleton/Shimmer).
- **Offline:** `OfflineTv` **ersetzt** Library und Assistant komplett, obwohl `useCachedList` und der Page-Cache vorhanden sind. Der Nutzer verliert Inhalte, die die App längst hat. Richtiges Muster (Notion, Spotify): Inhalte zeigen + schmales „Offline – Änderungen werden synchronisiert"-Banner.
- **Fehler:** `ErrorState` gibt es nur im Listen-Footer der Library; Rezeptdetail, Cooking, Household und Community haben keinen einheitlichen Fehlerzustand.
- **Toasts:** `RecipeDetailScreen` hat einen eigenen `toast`-State (`flash()`), obwohl `components/AppNotice` mit `showNotice()` existiert — und mischt i18n mit hart kodiertem Englisch: `'Ingredients added to your shopping list'`, `'Logged to your tracker'`, `'Translation is not available for this language yet'`. In einer App mit 11 Sprachen.

### 2.5 Keine Monetarisierung – „Premium" ist derzeit nur ein Wort

In `mobile/package.json` gibt es **kein** `react-native-purchases`/RevenueCat, kein `react-native-iap`, keine `expo-in-app-purchases`. Es gibt keinen Paywall-Screen, keine Feature-Flags, keine Quoten, keinen Trial. Gleichzeitig ist der Funktionsumfang groß genug für ein Abo-Modell (AI, Foto-Import-Potenzial, Haushalt, Health-Sync, Offline-Pakete, Themes, Wochenrückblick). Das heißt: **die Infrastruktur für Umsatz fehlt vollständig**, nicht die Features.

---

## 3. Bugs und Inkonsistenzen, die im Code auffindbar sind

| # | Datei | Befund | Wirkung |
|---|---|---|---|
| 1 | `DashboardScreen.tsx` | `<CheckRow done={false} label={t('s.dashTryAi')} …>` | Der dritte Punkt der Getting-Started-Liste wird **nie** abgehakt, egal wie oft man die AI nutzt |
| 2 | `RecipeDetailScreen.tsx` | `flash('Ingredients added to your shopping list')`, `flash('Logged to your tracker')`, `'Translation is not available…'` | Englisch in DE/AR/TR/NL/RU/UK — wirkt billig und unfertig |
| 3 | `SavedScreen.tsx` | Der Button mit Label „Shopping" ruft `onPress={() => openRecipe(item)}` auf | Nutzer erwartet Zutaten auf der Einkaufsliste, bekommt das Rezept |
| 4 | `RootTabs.tsx` | `itemW = Math.max(70, width / 5)` bei 8 Tabs, Labels 10 pt | Zwei Tabs sind dauerhaft außerhalb des Sichtbereichs |
| 5 | `LibraryScreen.tsx` | `translateSearchTerm()` übersetzt die Suche stillschweigend | Suche nach „tomato" findet „Tomate", aber der Nutzer versteht nicht, warum „Tomaten" nichts findet |
| 6 | `RecipeDetailScreen.tsx` | `logThisMeal`/`addIngredientsToList` nutzen `Alert.alert` statt Toast + Haptik | Erfolg/Misserfolg fühlen sich gleich an |
| 7 | `OnboardingScreen.tsx` (nach Auth) | Nur Spinner + „Plan bereit"-Text, kein Inhalt | Der Moment nach der Registrierung ist der emotional wichtigste — und er ist leer |
| 8 | `theme.ts` | `applyTheme` schreibt in AsyncStorage, Start immer `warm-cream`, keine System-Dark-Erkennung | Nutzer mit Dark-Mode-System sieht beim Start kurz Hell |
| 9 | Projekt | Keine Haptik, kein Reanimated, keine Skeleton-Komponente, kein Error-Boundary pro Screen (nur global) | Fehlende Feingranularität bei Abstürzen |
| 10 | `CookingScreen` | Timer laufen über `kitchenTimers` lokal, nicht geräteübergreifend | Timer weg bei App-Kill (je nach Implementierung) |

---

## 4. Vergleich mit Premium-Apps: was genau übernommen werden sollte

### 4.1 Duolingo (Gamification, Retention)
| Duolingo macht | Spoonful hat | Übernehmen |
|---|---|---|
| Streak als zentrales Element auf dem Home-Screen, mit Animation bei Meilensteinen | Streak-Zahl klein im Tracker/Dashboard | Streak als Karte auf Home: Flamme, Zahl, „7-Tage-Ziel", Celebration-Animation beim Erreichen + Haptik |
| XP, Level, Ligen, Wochen-Quests | Badges im Tracker (`b.days`), sonst nichts | XP für „Rezept gekocht", „Zutat zur Liste", „AI genutzt"; Level 1–20; Wochen-Quest („koch 3 Gerichte") |
| Friend Streaks (Duolingo: +22 % Wahrscheinlichkeit, die tägliche Lektion abzuschließen) | Haushalt existiert, aber ohne gemeinsame Serie | „Haushalts-Streak": Tage in Folge, an denen jemand im Haushalt gekocht hat |
| Onboarding: Motivation + Einstufung statt Feature-Tour | 17-Schritte-Interview | Auf 3 Schritte kürzen, Rest progressiv |

### 4.2 TikTok (Discovery, Motion, Feed)
| TikTok macht | Spoonful hat | Übernehmen |
|---|---|---|
| Vollbild-Feed mit einer Geste pro Entscheidung | Library-Grid mit 2 Spalten und Filtern | „Entdecken"-Ansicht mit horizontalen, personalisierten Karussells („15 Minuten", „Aus deinem Kühlschrank", „Im Trend im Haushalt") |
| Sofortiges Feedback durch Motion, kein leerer Screen | Ladebalken mit Fake-Progress | Skeleton-Karten, die das Grid schon zeigen |
| Themen-/Keyword-Steuerung im Feed | Filter, aber kein „weniger davon" | „Zeig mir weniger"/„mehr davon" auf Rezeptkarten (Long-Press) |

### 4.3 Adobe Lightroom (Foto, Editing, Premium-Gating)
| Adobe macht | Spoonful hat | Übernehmen |
|---|---|---|
| Vorher/Nachher per Gedrückthalten | Foto-Crop, aber kein Vergleich | Beim Schrittfoto: gedrückt halten zeigt Original vs. Crop |
| Premium schaltet **konkrete Fähigkeiten** frei (Masking, Generative Remove) | nichts | Paywall nennt exakt: „KI-Rezept aus Foto", „Wochenplan", „unbegrenzte AI" |
| Kostenloser Kern, Premium für Tiefe | alles kostenlos | Core kostenlos, Tiefe bezahlt (siehe 6) |

### 4.4 Spotify (Wrapped, Persönlichkeit, Konsistenz)
| Spotify macht | Spoonful hat | Übernehmen |
|---|---|---|
| Jahresrückblick als teilbares Ereignis | Wochenbericht im Tracker (Text) | „Spoonful Wrapped": Monats-/Jahresrückblick als teilbare Karte (meistgekochtes Gericht, Küchen, Streak, gespart) |
| Artwork nicht überlagern, einheitlich gerundet | Bilder ohne Aspect-Lock | Feste 4:3-Crops, dunkles Overlay nur unten, Titel nie auf Bildmitte |

### 4.5 Strava (Fortschritt, Community)
| Strava macht | Spoonful hat | Übernehmen |
|---|---|---|
| Challenges mit messbarem Ziel und Leaderboard | Community-Feed ohne Ziele | Monats-Challenge („20 Gerichte im November"), Fortschrittsbalken, Haushalts-Leaderboard |
| Uploads/Community frei, Analyse bezahlt | Community frei | Analyse (Makro-Tiefe, Trends) ins Abo, Community bleibt frei |

### 4.6 Headspace (Typografie, Ruhe, Paywall)
| Headspace macht | Spoonful hat | Übernehmen |
|---|---|---|
| Eigene Schrift mit klaren Rollen, begrenzte Palette, sparsame Schatten | 26 Schriftgrößen, 20 Themes, ein Schatten | Siehe 2.3 |
| Gesperrte Kurse mit „Subscribe to Unlock" direkt am Inhalt | nichts | Gesperrte Karten zeigen Schloss + „Mit Plus freischalten", nicht erst im Paywall-Screen |

### 4.7 Rezept-Apps als direkter Wettbewerb
| App | Preis | Stärke | Schwäche (aus Reviews) | Lehre für Spoonful |
|---|---|---|---|---|
| **Crouton** (Apple Design Award) | 24,99 $ einmalig + Discover 1,99 $/Mon. | schönste Koch-UX, Timer aus Text, Bluetooth-Waage | KI-Import im Abo → Vorwurf „bait and switch" | Kochmodus ist Spoonfuls stärkstes Asset — inszenieren, nicht verstecken |
| **Paprika 4** | 14,99 $/Jahr | Import aus Web/Foto/Text, offline, Familie, Alexa | Suche nur Titel-Präfix, alte UI | Import-Tiefe ist Zahlungsbereitschaft; UI muss modern sein |
| **Samsung Food+ (Whisk)** | 6,99 $/Mon. / 59,99 $/Jahr, 7 Tage Test | 180.000 Rezepte, Drag-and-drop-Planer, 3 Foto-Scans frei | importiert Zutaten, aber oft nicht die Schritte | Foto-Import als Free-Hook (3/Monat), dann Abo |
| **Yazio PRO** | 3/6/12 Monate im Voraus | Tagesbilanz, Foto-Tracking, Meal-Prep | kein Monatsabo, Werbung im Free | Tracker ist Spoonfuls zweites Asset — Foto-Logging fehlt |
| **MyFitnessPal Premium** | 19,99 $/Mon., 79,99 $/Jahr | größte DB, Barcode | Barcode seit 2022 Premium, viel Werbung | Barcode **frei** lassen als Differenzierung |
| **Kitchen Stories Plus** | 7,99 €/Mon., 79,99 €/Jahr | Design-Preise, Schrittbilder | Web-Import hinter Paywall, widersprüchliche Preise | Schrittfotos sind da — als „Design-Highlight" zeigen |
| **Pestle Pro** | 2,99 $/Mon., 24,99 $/Jahr | Import aus TikTok/IG | Caption-basiert, Apple-only | Spoonful kann Video→Rezept (hat es!) und sollte es bewerben |
| **Mealime** | eingestellt 21.10.2026 | schnellster Plan→Liste-Flow | – | Der Plan→Liste-Flow ist frei geworden; Lücke nutzen |
| **Dish AI / Snapcipe** | 4,99 $/29,99 $ · 2,99 $/24,99 $ | Foto→Rezept, 50 bzw. 250 Scans/Monat | junge Apps, dünne Rezeptbasis | Spoonful hat die Rezeptbasis + Haushalt — nur der Foto-Eingang fehlt |

---

## 5. Zahlen, an denen „Premium" gemessen wird

- **Retention:** Adjust 2024 nennt 26 % D1 / 13 % D7 / 7 % D30 (iOS 27/14/8, Android 24/11/6); OneSignal 28,3/17,9/7,9 %. Alles unter D7 = 12 % ist ein Onboarding-/Aha-Problem, nicht ein Feature-Problem.
- **Abo-Retention (RevenueCat 2025):** nach 12 Monaten sind 44,1 % der Jahres-, 17,0 % der Monats- und 3,4 % der Wochenabos aktiv → **Jahresabo mit Trial** ist das Zielmodell, nicht Monat.
- **Paywall (RevenueCat 2026):** Hard-Paywall 10,7 % Download-to-paid (D35) vs. 2,1 % bei Freemium, bei praktisch gleicher 12-Monats-Retention (27 % vs. 28 %). Für Spoonful heißt das: **Freemium mit klarer Grenze**, nicht Hard-Paywall — die App lebt von Gewohnheit.
- **Paywall-Platzierung (Adapty):** Onboarding-Paywall konvertiert 0,85 % vs. 0,23 % bei späteren Platzierungen, aber 38 % des Umsatzes kommen von späteren Paywalls → früh testen **und** kontextuelle Paywalls behalten.
- **Push (Airship 2025):** +13 % Käufe bei Opt-in. Opt-in erst nach dem ersten gekochten Rezept fragen, nicht im Onboarding.
- **Aktivierung:** 69 % der Produkte mit starker Frühaktivierung sind auch bei D90 stark (Amplitude); Appcues-Fallstudie: 2,5× Aktivierung, wenn der Welcome-Flow in die Kernaktion führt statt in eine Tour.

Für Spoonful ist die Kernaktivierung eindeutig definierbar: **erstes Rezept gekocht (CookingScreen abgeschlossen)** — nicht „registriert", nicht „Rezept gespeichert".

---

## 6. Konkretes Premium-Modell für Spoonful

**Free (dauerhaft, ohne Konto nutzbar bis zum Speichern):**
Library + Suche + Filter, Rezeptdetail, Kochmodus mit Timern, Tracker-Basis (manuelles Log, Barcode), Einkaufsliste lokal, 1 Rezept-Import pro Tag, 5 AI-Generierungen pro Monat, Community lesen.

**Spoonful Plus – 4,99 €/Monat oder 39,99 €/Jahr (7 Tage Trial):**
unbegrenzte AI-Generierungen + **Foto→Rezept**, unbegrenzter Import (URL/Foto/PDF/Video), Wochenplan-Generator + Auto-Einkaufsliste, Haushalt in Echtzeit + gemeinsame Streaks, Health-Connect/Google-Health, Offline-Pakete (20 Rezepte + Bilder), Wochen-/Monatsrückblick „Wrapped", alle Themes, Foto-Logging im Tracker, Priorität bei KI-Warteschlange.

**Family (Haushalt) – 6,99 €/Monat oder 59,99 €/Jahr:** 6 Mitglieder, gemeinsame Pläne, Ausgaben-Tracking, Statistiken.

**Gating-Regeln (wichtig für Reviews):** Was einmal kostenlos war, bleibt kostenlos. Kein Feature nachträglich hinter die Paywall schieben — genau dieser Vorwurf (Crouton, MyFitnessPal-Barcode) ist der häufigste Beschwerdegrund in Rezept-/Fitness-Reviews. Preise, Trial-Ende und Kündigung müssen im Paywall-Screen im Klartext stehen.

---

## 7. Priorisierte Änderungsliste

### P0 – in 2–4 Wochen sichtbar „premium" (kein neues Feature nötig)
1. **IA umbauen:** 5 Tabs + Home/Dashboard als Start, Drawer nur als „More"-Menü. (`RootTabs.tsx`, `Shell.tsx`)
2. **Design-Tokens einführen:** `type.ts` (6 Rollen), `space.ts` (4/8), `radius.ts` (5 Werte), `elevation.ts` (3 Stufen); alle Inline-Werte darauf migrieren, Screen für Screen. (`theme.ts` erweitern, `ui.tsx` als einzige Quelle)
3. **Onboarding kürzen** auf 3 Schritte + sofortiges personalisiertes Ergebnis; Rating raus. (`LandingScreen.tsx`)
4. **Skeletons** einführen (`components/Skeleton.tsx`) und in Library, Saved, MyRecipes, Community, Household einsetzen; Fake-Progress in der Library entfernen.
5. **Offline-Banner** statt `OfflineTv` für Library/Assistant (Cache anzeigen, Banner oben).
6. **Haptik + Motion-Paket:** `react-native-haptic-feedback` + kuratierte Springs; Haptik bei Speichern, Abhaken, Timer, Schritt-Weiter, Streak-Meilenstein.
7. **i18n-Bugfixes** (Abschnitt 3, Punkte 1–3) und `AppNotice` überall statt lokalem Toast/`Alert`.
8. **Display-Schrift:** entweder lizenzierte Schrift (z. B. Fraunces, Bricolage Grotesque) einbetten oder konsequent Serif nur für Display + Title und Body auf Inter/Roboto — System-Serif im Body wirkt billig.
9. **Bilder:** Aspect-Ratio-Lock 4:3, Dominant-Color-Placeholder, `RecipeImage` mit `fadeDuration`.
10. **Paywall-Infrastruktur:** RevenueCat einbinden, 2 Paywall-Platzierungen (nach Onboarding-Wertmoment, kontextuell bei gesperrter Funktion), Quoten serverseitig.

### P1 – in 1–3 Monaten (Substanz)
11. **Foto → Rezept** im Assistant (Kamera + Galerie, KI-Extraktion, Review-Screen vor dem Speichern) — das ist das Feature, mit dem Dish AI und Snapcipe Geld verdienen und Spoonful hat die Rezeptbasis.
12. **Wochenplan-Generator** (Ziel + Vorlieben + Kochzeit) mit Drag-and-drop und Auto-Einkaufsliste — die Lücke, die Mealime hinterlassen hat.
13. **Streak/XP/Level/Quests** als System (nicht nur Zahl), inkl. Haushalts-Streak.
14. **Tracker ausbauen:** Foto-Logging, Wasser-UI, Gewichts-Chart, Mahlzeiten-Slots, Health-Sync, Widget.
15. **Community zu Creator-Layer:** Profile, Follower, „nachgekocht"-Remix, Bewertungen mit Foto, Trending.
16. **Einkaufsliste professionell:** Aisle-Sortierung, Mengen-Merge, Barcode-Abhaken, Preise, Widget.
17. **Haushalt in Echtzeit** (Convex-Subscriptions sind vorhanden — Polling prüfen) + Live-Aktivitätsfeed + Push.
18. **Dashboard als Home** mit „Heute kochen"-Karte, Kalorien-Ring, Wochenziel, Streak, Quick-Add.

### P2 – 3–6 Monate (Differenzierung)
19. „Spoonful Wrapped" (Monats-/Jahresrückblick, teilbar).
20. Video-/Reels-Feed in Discover (TikTok-Muster) mit Koch-Overlay.
21. Keep-awake + Handschuh-Modus + Sprachsteuerung im Kochmodus (Crouton-Niveau halten).
22. Watch-App + Live-Activity für Timer.
23. Kühlschrank/Pantry-Scan (Foto) → „was kann ich kochen".
24. Creator-Marketplace (Rezepte als Collections, Affiliate für Zutaten).

---

## 8. Messplan (sonst bleibt alles Vermutung)

| Event | Zweck |
|---|---|
| `onboarding_step_view/complete` (mit `step_id`) | Drop-off pro Schritt, Ziel: ≥ 80 % Abschluss |
| `first_recipe_cooked` | **Kernaktivierung**, Ziel: innerhalb 24 h nach Install |
| `ai_generate` (Modus, Dauer, Erfolg) | Quoten-Design + Paywall-Trigger |
| `recipe_save`, `shopping_add`, `tracker_log` | Habit-Signale |
| `paywall_view`, `trial_start`, `purchase`, `cancel` | Conversion + Gründe |
| `streak_day`, `badge_earned` | Retention-Mechanik |
| `offline_session` | Qualität der Offline-Erfahrung |

KPIs: D1/D7/D30, Time-to-first-cook, Kochvorgänge pro Woche, Paywall-Conversion pro Platzierung, Trial→Paid, 12-Monats-Abo-Retention.

---

## 9. Was noch live getestet werden muss (offen)

Diese Punkte kann nur ein laufendes Gerät beantworten — sie stehen deshalb ausdrücklich offen:

1. Auth-Flow mit `salemibrahim011275@gmail.com` (Login, Session-Persistenz, `VerifyGate`, Logout).
2. Jeder Screen einmal geöffnet: Library (Suche/Filter/Presets/Saison/Pantry/Zufall), Detail (Speichern, Collection, Übersetzen, Melden), Cooking (Timer, TTS, Fotos, Skalierung), Assistant (3 Modi, Reroll, Video-Link), Tracker (Log, Barcode per Long-Press, Profil), Community (Like, Kommentar, Melden, 2 Seiten), Shopping (Undo, Haushalt), Haushalt (Invite, QR, Tasks, Plan, Ausgaben), Dashboard, Settings (11 Sprachen, Export, Löschen), Themes (alle 20), Admin (dein Konto ist admin), Legal.
3. Alle 11 Sprachen einmal umschalten und auf abgeschnittene Labels prüfen (RTL: Arabisch).
4. Performance: Kaltstart, Library-Scroll mit 500 Rezepten, Bild-Laden, Timer-Genauigkeit im Hintergrund.
5. Fehlerfälle: Flugmodus, langsames Netz, abgelaufene Session, kaputtes Bild, 0 Rezepte.
6. Tastatur/Layout: kleine Geräte (360 dp), große (430 dp), Tablet, Schriftgröße 200 %.

Sobald ein Gerät verfügbar ist, arbeite ich diese Liste ab und ergänze den Audit um gemessene Befunde (Screenshots pro Screen, Ladezeiten, Fehlerlogs). Das APK liegt bereit.

---

### Quellen (Auswahl)
- Adjust, Retention-Benchmarks: https://www.adjust.com/blog/what-makes-a-good-retention-rate/
- OneSignal, Mobile App Benchmarks 2024: https://onesignal.com/mobile-app-benchmarks-2024
- RevenueCat, State of Subscription Apps 2025: https://www.revenuecat.com/state-of-subscription-apps-2025
- RevenueCat, Benchmarks 2026: https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- Adapty, State of Onboarding: https://adapty.io/state-of-onboarding/
- Adapty, State of Paywalls: https://adapty.io/state-of-paywalls/
- Airship, Push Notification Benchmarks 2025: https://growth.airship.com/rs/313-QPJ-195/images/Airship-2025-Push-Notification-Benchmarks-EN.pdf
- Duolingo, Friend Streaks: https://blog.duolingo.com/product-lessons-friend-streak/
- Duolingo, Streak-Meilensteine: https://blog.duolingo.com/how-duolingo-streak-builds-habit
- Headspace Markenrichtlinien (Typografie/Motion): https://live.standards.site/headspace/typography
- Spotify Design Principles: https://spotify.design/article/introducing-spotifys-new-design-principles
- Crouton Pläne: https://combustioninc.gorgias.help/en-US/crouton-plans-explained-free-plus-and-discover-(and-how-to-fix-purchase-problems)-7703356
- Paprika 4: https://www.paprikaapp.com/
- Samsung Food+: https://samsungfood.com/food-plus
- Yazio PRO: https://help.yazio.com/hc/de/articles/208847005-Was-sind-die-Vorteile-von-PRO-
- Kitchen Stories Plus: https://pages.kitchenstories.com/de/plus
- Mealime Einstellung: https://www.mealime.com/closing
- Dish AI: https://dishaiapp.com/ · Snapcipe: https://snapcipe.app/
