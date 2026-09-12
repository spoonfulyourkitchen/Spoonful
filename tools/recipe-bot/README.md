# Spoonful Recipe-Bot

Erzeugt für **alle Länder aus der App** (`mobile/src/lib/countries.ts`, englische
Namen A→Z) je **100 Rezepte** — im exakt gleichen Format und mit denselben
Filterwerten wie die bestehenden 1300 Rezepte:

| Feld | Regel |
|---|---|
| `id` | `slug-0000`, fortlaufend ab der höchsten vorhandenen Nummer (aktuell 1301) |
| `title`, `description` | Englisch; Beschreibung 60–320 Zeichen |
| `ingredients` | JSON-Array, 4–20 Strings, je „Menge + Einheit + Zutat" (`200 g flour`) |
| `steps` | JSON-Array, 3–12 Sätze, ohne Nummerierung |
| `prep_time`, `cook_time` | ganze Minuten |
| `cuisine` | englischer Ländername = Filterwert der Library |
| `dietary_restrictions` | nur `vegan, vegetarian, gluten_free, dairy_free, nut_free, halal, pescatarian, low_carb, high_protein` |
| `difficulty` | `easy`, `medium`, `hard` |
| `meal_type` | `breakfast`, `main`, `side`, `snack`, `dessert`, `drink` |
| `calories`, `protein`, `carbs`, `fat` | ganze Zahlen pro Portion |
| `image_url` | **echtes** Bild von Wikimedia Commons (wie im Bestand), sonst `null` |

Länder, die schon genug Rezepte haben (z. B. deine 12 fertigen), werden
**automatisch übersprungen**. Der Bot fügt nur **neue** Zeilen ein, löscht und
ändert nie etwas (Upsert nur auf die eigenen neuen IDs).

## 1) Einrichten (einmal)

```powershell
cd tools\recipe-bot
copy .env.example .env
notepad .env        # SUPABASE_SERVICE_ROLE_KEY und OPENROUTER_API_KEY eintragen
```

`.env` ist in `.gitignore` — Keys landen nie im Repo. Wenn `OPENROUTER_API_KEY`
nicht in `.env` steht, nimmt der Bot automatisch den Wert aus
`C:\Users\salem\Desktop\Spoonful\.env.local`.

Voraussetzung: **Node 18+** (fetch ist eingebaut), keine npm-Pakete nötig.

## 2) Erst schauen, dann füllen

```powershell
node bot.mjs --verify                      # welche Länder sind fertig, welche offen
node bot.mjs --dry-run --countries=Italy   # 100 Rezepte bauen, nur in out\italy.json
node bot.mjs --countries=Italy             # 100 Rezepte wirklich hochladen
node bot.mjs --max-countries=3             # die nächsten 3 offenen Länder
node bot.mjs                               # alles Offene (dauert Stunden)
```

Nützliche Schalter: `--per-country=100`, `--batch=10` (Rezepte pro KI-Anfrage),
`--model=openai/gpt-4o-mini`, `--no-images`, `--overwrite`, `--quiet`.
`node bot.mjs --help` zeigt alles.

## 3) Was der Bot macht

1. liest die Länderliste aus `mobile/src/lib/countries.ts`,
2. **Phase 1 — Gerichtsnamen**: fragt die KI nach Gerichten, deren Herkunft
   wirklich das Land ist (verhindert z. B. „Shepherd's Pie“ unter Italien),
3. **Phase 2 — Rezepte**: schreibt pro Gericht ein vollständiges Rezept,
4. **prüft jedes Rezept** (Qualitäts-Gate):
   * Beschreibung 50–340 Zeichen, Titel passt zum vorgegebenen Gericht
   * Zutaten 5–20, jede mit Menge (metrisch) — höchstens eine ohne Menge
   * **Schritte 6–14, jeder 40–420 Zeichen**, ohne Nummerierung
   * Filterwerte exakt (`difficulty`, `meal_type`, `dietary_restrictions`)
   * kcal 20–1200 und Makros plausibel (±Verhältnis zu kcal)
   * kein Fleisch/Fisch bei `vegetarian`/`vegan`, `halal` nur wenn passend
   → Was nicht passt, wird verworfen und mit demselben Gericht neu erzeugt,
5. sucht zu jedem Titel ein Bild über die Wikimedia-Commons-API, prüft die URL
   (HTTP 200 + `image/*`), nimmt nur thematisch passende und keine doppelten,
6. hängt die URL mit demselben `utm_*`-Anhang an wie die bestehenden Rezepte,
7. schreibt `out\<land>.json` und lädt in 50er-Batches hoch (Upsert auf `id`).

Bei Abbruch (Strg+C, Netzfehler) steht der Fortschritt in `state.json` —
einfach neu starten, er macht beim nächsten offenen Land weiter.

## 4) Modelle & Keys: paralleles Rennen mit Rotation

**Keys:** mehrere OpenRouter-Keys = mehrere Kontingente. Der Bot liest
`OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2 … _12` und `OPENROUTER_API_KEYS`
(Komma-Liste) aus der `.env` und rotiert sie automatisch:

```
K4 ✓  ling-3.0-flash-vl  (Key 4 hatte noch Kontingent, Key 1 war im Limit)
```

Ein **429** legt nur das Paar *Modell + Key* 10–30 Min auf Eis — alle anderen
Kombinationen laufen weiter.

**Rennen (`--inflight=6`):** es sind **immer bis zu 6 Anfragen gleichzeitig**
unterwegs — verschiedene Modelle auf verschiedenen Keys. Der **erste brauchbare**
JSON-Antwort gewinnt, alles andere wird sofort abgebrochen; alle `--wave-ms`
(Standard 25 s) werden weitere Modelle nachgelegt. Dadurch gibt es **keine
Wartezeit** auf langsame Modelle mehr, und ein 403/429/Abschneiden kostet nur
eine Anfrage statt einer ganzen Welle.

**Automatische Bremse bei Abschneiden:** wird eine Antwort zu lang
(`finish_reason: length`), verkleinert der Bot die Blockgröße selbst
(`--batch`, Standard 8, minimal 3) — so passen Reasoning + Rezepte immer ins
Token-Budget (`--max-tokens`, Standard 16384).

**Nicht nutzbare Modelle fliegen raus:** HTTP 403 („only available on …“) oder
drei durchgefallene Rezepte (`--max-rejects`) und das Modell wird übersprungen.

**Modell-Reihenfolge** (nach Messungen aus der Praxis):

```
inclusionai/ling-3.0-flash-vl:free      schnell, gute Rezepte
google/gemma-4-31b-it:free              stark
nex-agi/nex-n2.5-mini:free
google/gemma-4-26b-a4b-it:free
nex-agi/nex-n2.5-pro:free
nvidia/nemotron-3-super-120b-a12b:free
nvidia/nemotron-3-ultra-550b-a55b:free  stark, aber langsam
thinkingmachines/inkling:free
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
liquid/lfm-2.5-2.6b:free                zu klein → fällt durch die Prüfung
```

Der Bot **lernt während des Laufs**: Modelle, deren Rezepte die Qualitätsprüfung
nicht bestehen, sammeln einen Malus und rutschen nach hinten; ab
`--max-rejects=3` werden sie ganz übersprungen. So gewinnt nicht dauerhaft das
schnellste, sondern das brauchbarste Modell.

## 5) Über Nacht laufen lassen

Der Bot darf beliebig lange laufen — er speichert nach **jedem 10er-Block**
einen Zwischenstand (`out\<land>.partial.json`) und nach jedem Land in
`state.json`. Ein Absturz oder Standby kostet also höchstens ein paar Minuten,
nie ein ganzes Land.

* **Starten mit Logdatei (empfohlen für lange Läufe):**

  ```powershell
  .\run.bat                      # Standard: --max-countries=10, Log in logs\run-<Datum>.log
  .\run.bat --countries=Italy    # eigene Argumente werden durchgereicht
  ```

* **Laptop-Einstellungen:** Netzteil angesteckt lassen; Standby im Netzbetrieb
  aus (`powercfg /change standby-timeout-ac 0`). Der Bildschirm darf ausgehen,
  das System muss aber weiterlaufen. WLAN an lassen.
* **Fenster nicht schließen**, wenn du den Bot direkt mit `node bot.mjs` gestartet
  hast — das beendet ihn.
* **Fortschritt ansehen (jederzeit, ohne den Bot zu stören):**

  ```powershell
  node bot.mjs --verify                                   # DB-Stand je Land
  Get-Content (\"logs\\bot-\" + (Get-Date -Format 'yyyy-MM-dd') + \".log\") -Tail 30 -Wait   # live mitlesen
  ```

* Läuft ein Land schief (alle Modelle im Limit), meldet der Bot
  „kein Modell hat geantwortet“ und macht mit dem nächsten Land weiter — das
  offene Land später einfach erneut aufrufen.

## 6) Dauer & Kosten

* **0 $** — alle Standard-Modelle sind gratis.
* Dafür langsamer: ca. 2–6 Minuten pro Land (1–2 Anfragen für die Namen,
  10 Anfragen für 100 Rezepte, 100 Bildprüfungen), plus Wartezeiten bei 429.
* Die Gratis-Kontingente sind pro Tag begrenzt → in Häppchen arbeiten
  (`--max-countries=5`); `state.json` merkt sich alles, einfach neu starten.
* Tipp: `--batch=10` beibehalten; größere Blöcke liefern bei kleinen Modellen
  schnell unvollständige Rezepte.

## 5) Kontrolle

```powershell
node bot.mjs --verify
```

Am Ende jedes Landes zeigt der Bot eine Zusammenfassung (neu / ohne Bild /
verworfen / Sekunden) und schreibt alles nach `logs\bot-YYYY-MM-DD.log`.
Rezepte ohne Bild stehen in `state.json` unter `noImage` — betroffenes Land mit
`--countries=<Land> --overwrite` erneut laufen lassen.

## 6) Sicherheit

* Service-Key nur in `tools/recipe-bot/.env` (git-ignoriert), niemals in der App
  und niemals in `mobile/src/…`.
* Der Bot besitzt bewusst **keinen** Lösch- oder Update-Befehl.
* Nach dem Rotieren der Keys die neuen Werte in `.env` eintragen.
