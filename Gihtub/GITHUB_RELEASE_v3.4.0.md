# Spoonful v3.4.0: Offline-first update

**Everything reacts instantly now.** Spoonful 3.4.0 moves water, weight, saved recipes, community likes/comments, meal logging and deleting your own recipes from “wait for the server” to “local first, sync in the background”.

## Highlights

### Local first, everywhere
| Action | Before | Now |
| --- | --- | --- |
| Water `+250 ml` / `-` (tracker) | waited for the server | instant, uploads in the background |
| Logging a weight | waited for the server | instant, trend updates right away |
| Deleting your own recipe | slow, blocked offline | instant, queued when offline |
| Saving / unsaving a recipe | slow, blocked offline | instant |
| Community like | slow, button locked | instant, counter updates immediately |
| Community comment | slow, spinner in the send button | appears in the list instantly |
| Logging a meal (manual, search, barcode) | form waited for the server | form closes instantly |

Everything that could not be sent yet is queued on the phone and replayed automatically as soon as the connection is back: likes, comments, water, weight, saved recipes and recipe deletions.

### “Estimate with AI”
- Counts toward the daily AI limit (3 requests per day), same budget as the AI Chef.
- **No counter, no popup, no hints**: once the three requests are used, the estimate is simply unavailable.
- Admins and mods stay unlimited.

### Cooking mode: step view
- **One tap** opens the step view (before: long-press only, which felt broken).
- **Swipe anywhere** on the step card to go to the next/previous step, not just on the button.
- Shorter swipe distance needed, so it feels immediate.

### Login / landing screen
- The start screen shows the **real library count (15,700+ recipes)** instead of the old fixed “1,100+”, and it works before signing in.

## Fixes & maintenance
- Restored two source files that were missing from the working copy, so the app builds and starts cleanly again.
- Removed an invalid modal prop in the tracker’s meal popup (keyboard handling is already covered by the surrounding `KeyboardAvoidingView`).
- Type check: 119 files, 0 errors. Jest: 53 tests green. ESLint: 0 errors.

## Install
Download `Spoonful-v3.4.0.apk` and install it over your current version (sign-in and your data stay). Requires Android 7+ (arm64 or armeabi-v7a).

**Package:** `com.spoonful` · versionCode 19 · versionName 3.4.0 · 41.4 MB (arm64-v8a, armeabi-v7a)
**SHA-256:** `1BFBCFE874F5AB173E1850954C2C4B76B936FA756E99BA4335C673DB81D3F29E`
