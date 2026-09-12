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

Deploy (einmalig):

1. Supabase → **Edge Functions** → *New function* → Name `ai` → Inhalt von
   `supabase/functions/ai/index.ts` einfügen → *Deploy*.
2. Supabase → **Edge Functions → Secrets** → `OPENROUTER_API_KEY` = dein
   OpenRouter-Key (`sk-or-…`).
3. Fertig — die App nutzt die Funktion sofort, ohne neues APK.

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
