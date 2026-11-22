# Google sign-in setup (Spoonful)

> **Status:** Die **Supabase-Seite ist bereits eingerichtet** (Google-Provider
> aktiviert, Client-ID + Secret gesetzt, Redirect-URLs `spoonful://auth/callback`
> und `spoonful://reset` erlaubt). Ein Test gegen
> `https://gmfkleugoxafmvprqatk.supabase.co/auth/v1/authorize?provider=google`
> liefert korrekt `302 -> accounts.google.com`. Offen ist nur noch Schritt 1
> (Redirect-URI im Google-Client + Testnutzer).

The app side is done (3.4.1). The button "Continue with Google" calls Supabase
`signInWithOAuth` with `redirectTo = spoonful://auth/callback` and opens the
URL in the system browser. For it to work, the Google provider has to be
enabled once in Supabase and a Google Cloud OAuth client has to exist.

No secret ever goes into the app: the Google client secret lives only in the
Supabase dashboard.

## 1. Create a Google Cloud OAuth client
1. Open https://console.cloud.google.com → create/select a project.
2. APIs & Services → OAuth consent screen:
   - User type: External.
   - App name: Spoonful, support email: spoonfulsupport@gmail.com.
   - Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
   - Publish the app (or add your own Google account under "Test users" while
     testing).
3. APIs & Services → Credentials → Create credentials → OAuth client ID:
   - Application type: **Web application**.
   - Name: Spoonful Supabase.
   - **Authorized redirect URIs** (exact):
     `https://gmfkleugoxafmvprqatk.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

## 2. Enable the provider in Supabase
Dashboard → Authentication → Providers → Google:
- Enable Google.
- Paste the Client ID and Client secret from step 1.
- Save.

(Dashboard: https://supabase.com/dashboard/project/gmfkleugoxafmvprqatk/auth/providers)

## 3. Redirect URLs
Dashboard → Authentication → URL Configuration:
- **Redirect URLs** must include:
  - `spoonful://auth/callback`
  - `spoonful://reset`
- Site URL can stay the default.

The app already declares `spoonful://` in `mobile/android/app/src/main/AndroidManifest.xml`
and `src/lib/auth-link.ts` exchanges the returned code for a session.

## 4. Test
1. Build/install the new APK.
2. On the sign-in screen tap "Continue with Google".
3. The Google consent screen opens in the browser; after allowing, the app
   reopens and you are signed in.

If nothing happens, check Dashboard → Authentication → Logs. A common cause is
a typo in the authorized redirect URI in Google Cloud.
