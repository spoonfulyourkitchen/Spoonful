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

## 4) Modelle: Gratis-Kette mit automatischem Wechsel

Standardmäßig läuft der Bot über die **kostenlosen Modelle** von OpenRouter, der
Reihe nach (Stand 12.09.2026):

```
google/gemma-4-31b-it:free                       (262K Kontext)
nvidia/nemotron-3-ultra-550b-a55b:free           (1M)
nex-agi/nex-n2.5-pro:free                        (262K)
inclusionai/ling-3.0-flash-vl:free               (262K)
nvidia/nemotron-3-super-120b-a12b:free           (262K)
google/gemma-4-26b-a4b-it:free                   (262K)
thinkingmachines/inkling:free                    (1M)
nex-agi/nex-n2.5-mini:free                       (262K)
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free (256K)
liquid/lfm-2.5-2.6b:free                         (65K)
```

* Antwortet ein Modell mit **429 (Rate-Limit)**, wandert es für 30–900 s in den
  Cooldown und das **nächste Modell übernimmt** — so teilen sich die
  Gratis-Kontingente mehrerer Modelle.
* Es wird bewusst **kein** `response_format: json_object` benutzt: viele
  Gratis-Modelle unterstützen es nicht. Der Bot liest das JSON selbst aus der
  Antwort (auch aus `reasoning`, falls `content` leer ist).
* Eigene Kette: `--models=google/gemma-4-31b-it:free,nvidia/nemotron-3-ultra-550b-a55b:free`
  oder nur eines: `--model=…`. Der Bot protokolliert je Land, welches Modell
  geliefert hat.
* Tempo: `--pause-ms=1200` (Standard) zwischen zwei Anfragen, `--batch=10`
  Rezepte pro Anfrage.

## 5) Dauer & Kosten

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
