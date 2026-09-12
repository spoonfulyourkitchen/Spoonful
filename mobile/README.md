# Spoonful — Native Android app (React Native)

> **Before your first build (after cloning):**
> the backend credentials are *not* part of this repository. Create the local
> secrets file once and fill in your own values:
>
> ```bash
> cp mobile/src/config-secrets.example.ts mobile/src/config-secrets.ts
> ```
>
> `mobile/src/config-secrets.ts` is listed in `.gitignore` and must never be
> committed: it holds the Supabase URL, the Supabase publishable key and the
> OpenRouter key. Everything else in the app builds without it.

This folder is the **native Android app for the Google Play Store**. It is the
same Spoonful as the web app — same Convex backend, same user accounts, same
recipe library, AI Chef, shopping list, tracker and community — built as a real
React Native Android app (package `com.spoonful`).

All features included:

- Account: sign up, sign in, email verification code, resend code, sign out
- **Library**: 1,000+ recipes with real photos, search, filters (cuisine, diet,
  time 0–15/15–30/30+, calories 0–400/400–700/700+, difficulty)
- Recipe details with photo, nutrition, ingredients and steps
- **Cooking mode** (step-by-step), **Save / unsave** recipes
- Add a recipe's ingredients straight to the **shopping list**; log a recipe as
  a meal in the **tracker**
- **My Recipes**: create, edit, delete and share your own recipes; save
  AI Chef results into My Recipes
- **AI Chef**: generate a recipe from the ingredients you have
- **Tracker**: log meals (with delete), see today's calories and protein
- **Community**: browse shared recipes with photos and open them
- Warm-cream light glassmorphism theme (same design language as the web app)

---

## 1) Get your OWN backend & APIs (do this once)

The app talks to **Convex** (backend + database + accounts + email codes).
You should use your own Convex project, not the Freebuff test deployment.

### a) Create your Convex project — get your API URL

1. Go to **https://convex.dev** → sign in (GitHub or email).
2. Click **Create project** → name it `Spoonful` → choose a region.
3. Open the project. On the deployment page copy these two values:

   ```text
   Cloud URL       https://<something>.convex.cloud
   HTTP Actions    https://<something>.convex.site
   ```

4. Open **`mobile/src/config.ts`** and paste them in:

   ```ts
   export const CONVEX_URL = 'https://<something>.convex.cloud';
   export const CONVEX_SITE_URL = 'https://<something>.convex.site';
   ```

   That single file is the only place the app's backend address lives.

### b) Deploy the server code to your project

From the **repository root** (the folder that contains `src/convex/`), open a
terminal once:

```bash
npx convex login
npx convex deploy        # pushes auth, library, AI, shopping, tracker, community
```

If asked for a deploy key, generate one in Convex →
Deployment → **Deploy Keys** → Generate, and set it as the `CONVEX_DEPLOY_KEY`
environment variable (it belongs to the Convex project only — never in the app).

### c) Add secret keys on the Convex dashboard

Convex dashboard → your project → **Settings / Environment Variables**:

| Variable | Where to get it | Needed for |
|---|---|---|
| `RESEND_API_KEY` | https://resend.com → **API Keys** (`re_…`) | Verification-code emails |
| `OPENROUTER_API_KEY` | https://openrouter.ai → **Keys** (`sk-or-…`) | AI Chef (optional) |
| `SITE_URL` | `https://<something>.convex.site` | AI request referer |

> These are server secrets — they live on the Convex dashboard, never inside
> the Android app.

---

## 2) Build & run on your phone (debug)

Requirements: **Android Studio** (latest), **Node.js 22+**, JDK 17 (bundled
with Android Studio). The Android SDK components install themselves on first
sync.

```bash
# 1. Repository root — install web/backend tooling once
npm install

# 2. Mobile app — install React Native dependencies once
cd mobile
npm install

# 3. Start Metro (keep this window open)
npm start

# 4. New terminal — install & launch on a connected phone (USB debugging on)
npm run android
```

Or in **Android Studio**: open the folder **`mobile/android`**, wait for Gradle
sync, then press the green **Run ▶** button (phone or emulator).

To install a **debug APK** without Android Studio:

```bash
cd mobile/android
gradlew.bat assembleDebug      # output: app/build/outputs/apk/debug/app-debug.apk
```

---

## 3) Upload to the Google Play Store

Google Play needs an **App Bundle (.aab)**, not an APK.

### a) Create your signing key (once, keep it safe!)

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore spoonful-upload-key.keystore -alias spoonful -keyalg RSA -keysize 2048 -validity 10000
```

Move `spoonful-upload-key.keystore` into `mobile/android/app/`.

### b) Configure signing

Add to `mobile/android/gradle.properties` (never commit/share real passwords):

```properties
MYAPP_UPLOAD_STORE_FILE=spoonful-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=spoonful
MYAPP_UPLOAD_STORE_PASSWORD=YOUR_STORE_PASSWORD
MYAPP_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

`app/build.gradle` already switches to this key automatically when those
properties exist.

### c) Build the release bundle

```bash
cd mobile/android
gradlew.bat bundleRelease
```

Result (upload this to Play Console):

```text
mobile/android/app/build/outputs/bundle/release/app-release.aab
```

### d) Play Console setup (once)

1. https://play.google.com/console → create app → **Spoonful**
2. App signing: Play App Signing → upload the key you created (Google
   recommends it), or let Google manage the key
3. Fill in: store listing, screenshots, privacy policy, data-safety form,
   content rating
4. **Testers:** Publish to **Internal testing** first, install via the invite
   link on your phone, then promote to Production

---

## 4) App icon & name

- App name: **Spoonful** (set in `mobile/app.json` and
  `mobile/android/app/src/main/res/values/strings.xml`).
- Launcher icon: Android Studio → right-click `mobile/android/app` →
  **New → Image Asset** → choose the 512×512+ PNG of the Spoonful logo →
  **Next → Finish** → rebuild. (Start from the SVG in `public/logo.svg`.)

## 5) Version bumps

Before every release raise the version in `mobile/android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.1"
```

## 6) Recipes & content updates

Recipes live on the **server**, not inside the APK. To add/change recipes for
everyone, update the catalog in `src/convex/` and run `npx convex deploy` from
the repository root — no new APK needed for users to see them.

## Troubleshooting

- **Blank screen / "Connecting" at startup** → `mobile/src/config.ts` still has
  the placeholder URL or points to a deleted deployment. Put your own Convex
  Cloud URL there and rebuild.
- **401 / Invalid Convex deploy key (CLI)** → the key was created for a
  different Convex deployment. Generate it on exactly the deployment you deploy
  to.
- **Verification email never arrives** → add `RESEND_API_KEY` on the Convex
  dashboard; until Resend is configured the fallback sender (Freebuff) is only
  available while running on Freebuff hosting.
- **Metro port in use** → close old `npm start` windows, or `npx react-native
  start --reset-cache`.
