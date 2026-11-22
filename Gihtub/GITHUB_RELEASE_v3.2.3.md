# Spoonful 3.2.3 — stability polish, faster lists, fair AI limits

**APK:** `Spoonful-v3.2.3.apk` · versionCode `14` · versionName `3.2.3`

This release removes what did not work, makes the slow parts fast and gives the
AI a fair, shared daily limit.

---

## 🗑️ MONSTR removed
The deal-scanning page never behaved the way it was supposed to, so it is gone
completely — tab, drawer entry, tour steps and all of its code and tests.

## 🤖 AI Chef: 3 requests per day, counter in the header
* **All three** chef modes (ingredients · describe · video link) share **3 uses
  per day** for every regular user. Mods and admins are unlimited.
* Counting happens **server-side in the database** (`ai_usage`), so it is
  device-independent and cannot be reset by reinstalling the app.
* A small **counter sits top-right next to "Spoonful · AI Chef"** (`2/3`). When
  it hits zero it turns red and the AI answers with a clear "used up for today"
  message.

## 📹 Video → recipe: the AI fills in missing steps
* Before, a video description was copied **1:1** into a recipe — including
  everything that is not a recipe.
* Now ingredients are detected from the video, and if there are **too few
  steps** (typical for Reels/Shorts) the AI writes them and cleans up the text.
  Ingredients found in the video are kept — the AI only fills gaps.
* The swipe hints in the chef card are unambiguous now:
  "← describe · again ← video link" and "→ back". The video page is no longer
  skipped by accident.

## 🛒 Shopping list: local, instant, offline
* Every action used to go to the server first → laggy, and unusable offline.
* The **local store is now the source of truth for the UI**: add, tick off and
  delete happen instantly and work offline. When a connection exists, changes
  are synced in the background.
* Offline, the **"To household" button is hidden** (that needs the server) while
  the list itself stays fully usable.

## ⌨️ Text fields follow the keyboard
Every dialog with inputs (household, comments, portions, profile, recipe form,
tracker, settings …) is wrapped in a `KeyboardAvoidingView`, so the field moves
up with the keyboard and you always see what you type.

## 🌗 Dark-theme household inputs
The household input fields looked white in dark themes. They now use solid
theme surfaces with a border — correct in every theme.

## ✂️ Image crop shows the right area
When cropping a photo, the app always showed the **centre** of the image instead
of the selected area (it calculated with the frame size instead of the real
image size). The real dimensions are now taken into account and the chosen
region is shown exactly.

## 🎨 Look & feel
* **Main theme without glassmorphism**: no colour washes in the background, just
  the clean theme surface; cards are solid with a border.
* **Theme-aware logo**: the logo sits on a theme-coloured surface, so it no
  longer looks like a bright box on dark themes.

## 🧰 Tracker · Library · Community · Legal
* Tracker: the food box starts **closed**, and the "Macro Split" card is gone
  (macros are still shown in the plan card).
* Library loads **50** recipes per page instead of 24.
* Community: the "shared table" box is removed and **all old shared recipes were
  deleted** — the feed starts empty and clean.
* Legal pages (imprint, privacy, cookies, terms) now show the **installed app
  version and the current date automatically**.
* Landing/dashboard show **real numbers**: recipe count from the live library,
  language count from the language list, version from the app config.

## 📱 Android: cleaner screen
The **system navigation bar** (gestures/3 buttons) hides while the app is open —
like in other apps. A swipe from the bottom brings it back temporarily.

---

### Notes
* No AI app update needed for AI changes: the `ai` edge function (version 9,
  ACTIVE) enforces the limit server-side.
* Release APK is still signed with the debug keystore.
