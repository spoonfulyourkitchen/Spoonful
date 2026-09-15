# Spoonful – Migration Convex → Supabase

Status (aktualisiert nach dem Umbau der React-Native-App):

- [x] Supabase-Projekt-Zugang hinterlegt (`.env.local` / `mobile/src/config-secrets.ts`)
- [x] SQL-Schema + RLS erstellt (Tabellen in Supabase vorhanden)
- [x] Auth auf Supabase umgestellt (`supabase.auth`, Trigger `handle_new_user`)
- [x] App-Datenlayer umgeschrieben (Convex → `@supabase/supabase-js`)
  - `mobile/src/lib/supabase.ts` – Supabase-Client + Row-Mapper
  - `mobile/src/lib/api.ts` – Convex-kompatible API-Refs + Operations
  - `mobile/src/lib/convex-auth.tsx` – Auth-Provider + `useQuery/useMutation/useAction`
  - `mobile/src/lib/ai.ts` – AI Chef / Nutrition (über die Edge Function `ai`)
  - `mobile/src/lib/photo.ts` – Uploads nach Supabase Storage
- [x] Admin-Helfer-Funktionen in Supabase angelegt (`supabase/migrations/999_admin_helpers.sql`)
- [x] Storage-Bucket `recipe-images` angelegt
- [x] Neue Release-APK gebaut und signiert (Debug-Key)

## Keine Geheimnisse im App-Bundle (2.1.4)

Die APK ist dekompilierbar — deshalb darf **kein Server-Key** darin stehen.

| Wert | Wo er jetzt liegt | Im APK? |
|---|---|---|
| Supabase URL + Publishable Key | `mobile/src/config-secrets.ts` (git-ignoriert) | ja, **absichtlich**: dieser Key ist der öffentliche Zugang zum Projekt, geschützt durch RLS |
| `OPENROUTER_API_KEY` | Secret der Edge Function `ai` (Supabase → Edge Functions → Secrets) | **nein** |
| `service_role` / JWT-Secrets | nur Supabase-Dashboard | **nein** |

Die Edge Function liegt unter `supabase/functions/ai/index.ts` und beantwortet
nur Anfragen von angemeldeten Nutzern (JWT-Rolle muss `authenticated` sein, der
öffentliche Anon-Key allein wird abgelehnt).

## KI-Modelle: Reihenfolge und Kosten (Stand September 2026)

**Zuerst laufen genau drei Gratis-Modelle** (fest gewählt, kein Live-Abruf mehr —
das hat jeden Aufruf ausgebremst), je **ein** Versuch:

| # | Gratis-Modell | Warum |
|---|---|---|
| 1 | `inclusionai/ling-3.0-flash-vl:free` | sehr schnell, gutes Deutsch |
| 2 | `google/gemma-4-31b-it:free` | starke Anweisungstreue (JSON) |
| 3 | `nvidia/nemotron-3-super-120b-a12b:free` | stärkstes Modell der Gratis-Gruppe |

Erst wenn alle drei nicht antworten, kommt die billige Kette — **nur außerhalb
der DeepSeek-Stoßzeit** und **nur innerhalb des Tageslimits**:

| # | Modell | Preis (in/out je 1M Tokens) | Hinweis |
|---|---|---|---|
| 1 | `meta-llama/llama-3.1-8b-instruct` | 0,05 $ / 0,08 $ | billigstes Modell der Kette |
| 2 | `microsoft/phi-4` | 0,07 $ / 0,14 $ | |
| 3 | `deepseek/deepseek-v4.1-flash` | 0,15 $ / 0,60 $ | **nur Off-Peak** (dann halber Preis) |
| 4 | `openai/gpt-4o-mini` | 0,15 $ / 0,60 $ | letzter Ausweg |

Zeitbudget: 20 Sekunden für die Gratis-Runde, danach 30 Sekunden für die Kette —
ein Aufruf kann also nie mehr minutenlang laufen.

Steuerung über Function-Secrets:

| Secret | Standard | Wirkung |
|---|---|---|
| `OPENROUTER_FREE_MODELS` | die drei oben | eigene Kommaliste (max. 3) statt der Standard-Gratis-Modelle |
| `OPENROUTER_ALLOW_PAID` | `1` | `0` = **nur Gratis-Modelle** (keine Kosten) |
| `OPENROUTER_PAID_DAILY_LIMIT` | `100` | max. bezahlte Anfragen pro Tag (0 = kein Limit) |
| `OPENROUTER_PAID_MODEL` | `openai/gpt-4o-mini` | letzter Notfall, falls nicht in der Kette |

Bei 100 bezahlten Anfragen am Tag kostet die Kette höchstens wenige Cent
(llama-3.1-8b ≈ 0,0002 $ pro Rezept). Die Antwort der Funktion nennt
`model`, `paid`, `paidCallsToday`, `peakInfo` und `skipped` — damit ist
nachvollziehbar, was benutzt wurde.

### DeepSeek-Stoßzeiten (Peak)

* Peak nur **Montag–Freitag**, Fenster in **UTC**: `01:00–04:00` und `06:00–10:00`.
* Samstag/Sonntag ist **rund um die Uhr Off-Peak** (halber Preis).
* In deutscher Zeit (`Europe/Berlin`, automatisch mit Sommer-/Winterzeit):
  * Sommerzeit (MESZ, UTC+2): `03:00–06:00` und `08:00–12:00`
  * Winterzeit (MEZ, UTC+1): `02:00–05:00` und `07:00–11:00`

Die Logik liegt in `supabase/functions/ai/peak.ts` und ist mit Tests abgesichert
(`mobile/__tests__/peak.test.ts`).

## Deploy der Funktion

Zwei Wege — beide brauchen **kein** neues APK:

**A) Dashboard (ohne Token)**
1. Supabase → **Edge Functions** → Funktion `ai` öffnen.
2. Inhalt von `supabase/functions/ai/index.ts` und `peak.ts` einfügen → *Deploy*.
3. Supabase → **Edge Functions → Secrets**: `OPENROUTER_API_KEY`,
   `OPENROUTER_API_KEY_2` … (bis `_24`), optional `OPENROUTER_ALLOW_PAID` und
   `OPENROUTER_PAID_DAILY_LIMIT`.

**B) Ein Befehl mit Personal Access Token (empfohlen)**
```powershell
# Token holen: Supabase → Account → Access Tokens (sbp_…)
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node tools/deploy-ai.mjs --secrets --deploy
```
Das Skript liest die OpenRouter-Keys aus `.env.local` und `tools/recipe-bot/.env`,
setzt sie als Secrets und lädt `index.ts` + `peak.ts` hoch.

> Der `service_role`-Key reicht für Deploys **nicht** (nur für Datenzugriff).
> Prüfen, was gerade läuft: `node tools/ai-live-check.mjs`
> (legt einen Testnutzer an, fragt die Funktion, löscht den Nutzer wieder).


> Der Key war in den APKs bis **2.1.4 (alt)** mitgebaut. Wenn so ein APK
> weitergegeben wurde, den Key bei OpenRouter einmal **neu erzeugen und den
> alten löschen** (https://openrouter.ai → Keys).

## Noch offen / bewusst so gelassen

- [ ] **Bibliotheks-Katalog**: In Supabase ist noch keine öffentliche Rezept-
  Katalog-Tabelle mit Daten vorhanden → `recipes.libraryMeta/libraryPage`
  liefern aktuell eine leere Liste. Sobald die Katalogdaten importiert sind,
  müssen nur die zwei Funktionen in `mobile/src/lib/api.ts` angepasst werden.
- [ ] **Community-Moderation**: `shared_recipes` hat keine Status-Spalte →
  Shares sind sofort öffentlich; „Pending review“ ist im Admin deaktiviert.
