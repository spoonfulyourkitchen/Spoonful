# Spoonful v3.4.2: share cooldown fixed, likes, offline photos, back-to-top

Spoonful 3.4.2 is a bug-fix release. It fixes a community share cooldown that blocked people for days too long, keeps likes correct across devices, stops offline photos from being lost, and adds a back-to-top button plus a way to report a community post.

## Highlights

### Sharing: the cooldown matches the server
The recipe screen waited 7 days before a rejected recipe could be sent again, while the server only waited 3. Both now use the same 3-day window and the server's review timestamp - no more "send again" that the server refuses.

### Community: likes stay correct
Liking a dish showed a local counter that never cleared, so a later like from someone else never appeared. The override is now dropped once the server confirms it.

### Photos: nothing is lost offline
A photo picked offline used to be stored as a local file path that other devices could not open. The recipe is saved first and the photo uploaded right after; if it fails it is queued and attached automatically once back online.

### Cooking mode: no stale language
Switching the app language mid-cook drops the old translation instead of showing steps in the previous language; reload it with one tap.

### Recipe detail: back to top
A back-to-top button appears on long recipes when you scroll down.

### Community: report a post
A small flag on every community card reports a wrong, offensive or spammy post into the same moderation table as image reports.

## Install
Download `Spoonful-v3.4.2.apk` and install it over your current version (sign-in and your data stay). Requires Android 7+ (arm64 or armeabi-v7a).

**Package:** `com.spoonful` - versionCode 21 - versionName 3.4.2 - 41.4 MB (arm64-v8a, armeabi-v7a)
**SHA-256:** `CB16BD24F1ADD8502FB0678C89682E8A0F3D19E1FCAD86B8A3A5AD3BFC7F5FBB`
