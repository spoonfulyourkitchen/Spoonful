# Spoonful 3.3.0

**APK:** `Spoonful-v3.3.0.apk` · versionCode `15` · versionName `3.3.0`

This release fixes the problems that were reported most often: the keyboard
covering input fields, the cooking mode, the image crop, AI recipes, barcode
recognition and speed. In addition, every message is now shown in the app design
instead of a system dialog.

---

## Keyboard and input fields
* Input fields were hidden by the keyboard, so the user could not see what was
  being typed. The cause was edge-to-edge on Android 15+: `adjustResize` from the
  manifest no longer had an effect.
* The app now moves the content up itself (a KeyboardAvoidingView on app level,
  plus one inside every dialog that contains inputs, because dialogs live in
  their own window).
* Applies everywhere: household, shopping list, comments, profile, recipe form,
  tracker, settings, cooking-mode notes.

## Messages in the app design
* All system dialogs (`Alert`) were replaced. Notices, confirmations and errors
  appear as a card inside the app: theme colours, the language the user selected,
  no device-specific look.
* At the end of the cooking mode there is no abrupt system message any more; the
  mode simply switches to the finished state and the meal is logged in the
  background.

## Cooking mode
* Every step has a section with "Coach tip" and "Look for". This guidance belongs
  to the recipe (library content) and is stored per step. If a recipe does not
  have guidance yet, the app says so instead of inventing generic sentences.
* New read-aloud button next to each step: the app reads the step out loud so the
  cook does not have to look at the display. Tapping again stops it. Works in the
  classic and the advanced cooking mode; if the device has no speech output the
  button is not shown.
* Long-pressing the step box opens only that box as a pop-up: without the prep
  section above and without the timer list below. The pop-up does not scroll, so
  swiping between steps is simple, and the step timer can still be started there.
* The "added" sentences at the end were removed.

## Images
* The image crop always showed the centre of the photo instead of the selected
  area. The view could not reliably determine the image size (photos taken in the
  app are data URLs), and without the size the crop cannot be calculated.
* The image size is now stored together with the crop and used for display, so the
  selected area appears exactly, in every frame size.

## AI
* AI recipes now have at least 8 steps, each with one action including amounts and
  times in the text.
* Video recognition: descriptions almost always contain text that is not a recipe
  (subscribe requests, links, hashtags, ads, timestamps, "rate this video"). Those
  lines are detected and removed. Afterwards the AI orders the text completely:
  clean ingredients, complete steps. Missing obvious steps are added without
  inventing ingredients.
* Translator: the source language is detected automatically (it was always English
  before, which mistranslated German or Arabic recipes) and already translated
  lines are cached, so switching and reopening is instant.

## Tracker
* The weight box is closed by default, like water and food, and opens on demand.
* Barcode: significantly more products are recognised.
  * Many entries had no name, only a generic or foreign-language one, and the hit
    was discarded. All name variants are used now, falling back to brand + weight.
  * EAN-8, UPC-A and EAN-13 are queried as variants (with and without a leading
    zero) against two database endpoints.
  * Entries without nutrition values are no longer returned as hits.

## Other
* Shopping list: the empty state showed the technical key `shopping.empty` as
  text. It now shows the proper text.
* If a text is missing in a language, a readable replacement is shown instead of a
  technical key.
* Library/landing show the real recipe count (live from the library instead of a
  fixed marketing number).
* The shopping list stays local and instant; updates now redraw only the affected
  row instead of the whole list.
