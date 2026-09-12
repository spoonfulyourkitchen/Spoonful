# Spoonful – Migration Convex → Supabase

Status (aktualisiert nach dem Umbau der React-Native-App):

- [x] Supabase-Projekt-Zugang hinterlegt (`.env.local` / `mobile/src/config.ts`)
- [x] SQL-Schema + RLS erstellt (Tabellen in Supabase vorhanden)
- [x] Auth auf Supabase umgestellt (`supabase.auth`, Trigger `handle_new_user`)
- [x] App-Datenlayer umgeschrieben (Convex → `@supabase/supabase-js`)
  - `mobile/src/lib/supabase.ts` – Supabase-Client + Row-Mapper
  - `mobile/src/lib/api.ts` – Convex-kompatible API-Refs + Operations
  - `mobile/src/lib/convex-auth.tsx` – Auth-Provider + `useQuery/useMutation/useAction`
  - `mobile/src/lib/ai.ts` – AI Chef / Nutrition (OpenRouter)
  - `mobile/src/lib/photo.ts` – Uploads nach Supabase Storage
- [x] Admin-Helfer-Funktionen in Supabase angelegt (`supabase/migrations/999_admin_helpers.sql`)
- [x] Storage-Bucket `recipe-images` angelegt
- [x] Neue Release-APK gebaut und signiert (Debug-Key)

## Noch offen / bewusst so gelassen

- [ ] **Bibliotheks-Katalog**: In Supabase ist noch keine öffentliche Rezept-
  Katalog-Tabelle mit Daten vorhanden → `recipes.libraryMeta/libraryPage`
  liefern aktuell eine leere Liste. Sobald die Katalogdaten importiert sind,
  müssen nur die zwei Funktionen in `mobile/src/lib/api.ts` angepasst werden.
- [ ] **AI-Key sicherer ablegen**: `OPENROUTER_API_KEY` liegt aktuell in
  `mobile/src/config.ts` (wird mitgebaut). Für einen öffentlichen Release
  sollte der AI-Aufruf in eine Supabase Edge Function wandern.
- [ ] **Community-Moderation**: `shared_recipes` hat keine Status-Spalte →
  Shares sind sofort öffentlich; „Pending review“ ist im Admin deaktiviert.
