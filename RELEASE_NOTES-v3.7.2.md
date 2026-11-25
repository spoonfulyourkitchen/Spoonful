# Spoonful v3.7.2

## Highlights

- **Translations are ready when you open a recipe.** Full recipe translations are kept on the device, a language switch translates every visible recipe title in one request, and the first library recipes are prepared in the background. Opening a recipe no longer waits for the translator when it was seen before.
- **Descriptions stay.** An incomplete translation used to replace the real description with an empty text. The original now stays whenever a translated field is missing, and older incomplete server translations are rebuilt automatically.
- **Photos work in one flow.** After choosing from the gallery or taking a photo, the picker closes before the crop screen opens. The crop screen offers a section or the whole image, and step photos in cooking mode use the same flow.
- **Timers are clear.** The timer bar shows the running countdown and how many timers are active. A tap opens the timer overview with pause, resume, stop and another timer for the current step. Minute values in step texts are now recognised in every language the app ships.
- **Step tips for AI recipes.** Generated recipes include a short coach tip and a look-for hint for every step.
- **The web app has real pages.** Every screen has its own address under `/app`, and the browser back button closes an open dialog instead of leaving the app.

## Changed

- The translation suggestion button and its form are removed. Translations are automatic.
- The Community tab is no longer part of the tab bar.

## Notes

- Version 3.7.2, build 31, Android 7.0 or newer.
- No database migration is required on the device.
- Installing over 3.7.1 keeps account, recipes, tracker, lists and settings.
