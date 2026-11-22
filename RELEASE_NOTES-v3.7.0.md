# Spoonful v3.7.0

## Highlights

- **Profile refresh for existing users.** Everyone who finished the first onboarding gets a short, friendly prompt explaining why a few new details matter (allergies, diet, cooking experience, household size, cooking time, cuisines). Accepting opens a compact version of the onboarding with only those questions; answers are merged into the existing profile.
- **Meal logging is easier.** "Log meal" now opens with two tabs: pick a saved or own recipe with a portion stepper, or enter values manually. The recipe picker is no longer buried in the barcode card.
- **Barcode card** is titled "Barcode" again, and the scanner has a direct field for entering a product code under the product search.
- **Library filters** open as a centered dialog with the library still visible behind it. The cuisine picker sits above it and has its close button back.
- **Skill level grows with time.** Beginners start with simpler recipes, then see medium and later all difficulties. The AI Chef follows the same level.
- **Target weight in AI Chef.** The prompt now uses current and target weight for portion size and calorie density.
- **Simpler recipe form.** Photo, title, ingredients, steps - everything else lives in a collapsed "Details" section.
- Diet tags and difficulty labels are fully localized.

## Notes

- No database migration is required.
- The local-only test button remains limited to localhost development builds.
