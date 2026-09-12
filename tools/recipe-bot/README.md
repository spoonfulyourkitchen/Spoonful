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
2. fragt die KI (OpenRouter) pro Land in 10er-Blöcken nach authentischen Gerichten,
3. **prüft jedes Rezept** (Zeichenlängen, Mengen+Einheiten, Nummerierung in
   Schritten, Einheiten der Filterwerte, kcal/Makro-Plausibilität, kein Fleisch
   bei vegetarisch …) — was nicht passt, wird verworfen und neu erzeugt,
4. sucht zu jedem Titel ein Bild über die Wikimedia-Commons-API, prüft die URL
   (HTTP 200 + `image/*`), nimmt nur thematisch passende und keine doppelten,
5. hängt die URL mit demselben `utm_*`-Anhang an wie die bestehenden Rezepte,
6. schreibt `out\<land>.json` und lädt in 50er-Batches hoch (Upsert auf `id`).

Bei Abbruch (Strg+C, Netzfehler) steht der Fortschritt in `state.json` —
einfach neu starten, er macht beim nächsten offenen Land weiter.

## 4) Dauer & Kosten

* ca. 1–3 Minuten pro Land (10 KI-Anfragen + 100 Bildprüfungen)
* ~90 offene Länder → grob 2–3 Stunden und wenige Euro OpenRouter-Guthaben
* Tipp: in Häppchen mit `--max-countries=5` arbeiten, `state.json` merkt sich alles

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
