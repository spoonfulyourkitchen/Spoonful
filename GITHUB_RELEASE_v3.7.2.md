## Spoonful 3.7.2

**Important: delete the old Spoonful app and install this build again.**

We lost the signing key of the previous versions. Android only installs updates that are signed with the same key, so this APK cannot be installed over 3.6 or 3.7. Delete Spoonful on your phone, then install `Spoonful-v3.7.2.apk` from this page.

Your account, saved recipes, tracker entries and lists stay on the server. Local drafts and step photos stored only on the phone are removed with the app.

Faster translations, a cleaner photo flow and timers that explain themselves.

**Download:** `Spoonful-v3.7.2.apk` under Assets below. Android 7.0 or newer, arm64 and armv7. Install it over your current version, account, recipes, tracker and lists stay as they are.

### What is new

**Translations without the wait**

A recipe that was translated once opens with its translation already in place. Switching the language translates every visible recipe title together, and the first recipes of the library are prepared in the background, so the first tap is fast too.

Translated descriptions no longer disappear. When a translation is incomplete, the app keeps the original text for that field instead of showing nothing, and translations saved without a description are rebuilt the next time the recipe opens.

**Photos in one flow**

Choosing a photo from the gallery or taking one with the camera now closes the picker before the crop screen appears. The crop screen keeps both options: a section of the photo or the whole image. The same flow is used for step photos in cooking mode.

**Timers you can read**

The timer bar in cooking mode shows the running countdown and the number of active timers. Tapping it opens an overview with every timer, its step and its remaining time. Each timer can be paused, continued or stopped, and another timer for the current step starts from the same screen. Minute values in step texts are now understood in all app languages, not only in English and German.

**AI recipes with step tips**

Recipes from AI Chef include a short coach tip and a look-for hint for every step: what matters right now and how to tell that the step is done.

**Web app with real pages**

Every screen in the web app has its own address under `/app`, for example `/app/library` or `/app/settings`. The browser back button closes an open dialog or switches the tab and no longer leaves the app.

### Changed

- The translation suggestion button is removed. Translations are automatic.
- The Community tab is no longer part of the tab bar.

### Technical

- Version 3.7.2, build 31, minSdk 24, targetSdk 36
- ABIs: arm64-v8a, armeabi-v7a
- Hermes bundle, no R8 or minify
- No database migration required on the device
