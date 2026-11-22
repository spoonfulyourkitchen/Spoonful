## Spoonful 3.7.0

The personalisation update: your details get a short refresh, meals can be logged straight from your recipes, and library and AI Chef follow your experience level.

**Download:** `Spoonful-v3.7.0.apk` under Assets below. Android 7.0 or newer, arm64 and armv7. Install it as usual, existing installations are updated in place.

### What is new

**Profile refresh for existing users**
Anyone who has been around for a while gets a short prompt on start that explains why a few details matter now: allergies, diet, cooking experience, household size, cooking time and cuisines. Recipes, library and AI Chef can only fit if they know these. "Update now" opens a compact version of the onboarding with just those questions, your existing answers are kept. New accounts do not see the prompt, because the onboarding already asks for these details.

**Log a meal from your recipes**
"Log meal" starts with two tabs: one for a recipe from your collection with a portion stepper, one for manual entry. Nutrition values from the recipe go straight into the tracker instead of being typed in again.

**Barcode with a code field**
The card is called "Barcode" again, and the scanner has a field under the product search to type the number directly. Photo capture stays as the fallback.

**Library cleaned up**
Filters and the cuisine picker open as centered dialogs, the library stays visible behind them. The cuisine picker sits above the filter, its close button is back, and recipes are sorted by image and alphabet.

**Experience grows with you**
New accounts start with easy recipes. After about three weeks medium ones join in, after about eight weeks all of them. AI Chef works with the same level.

**AI Chef knows your target weight**
The prompt now uses current and target weight for portion size and energy density, together with goal, cuisines, allergies and experience.

**Leaner recipe form**
Photo, title, ingredients, steps. Everything else, meaning times, portions, tags and nutrition, sits collapsed under "Details".

**Smaller things**
Diet tags and difficulty levels are fully translated, portion display in recipe detail is correct again, household and tracker have their new cards, and the cooking mode texts are clearer.

### Technical

- Version 3.7.0, build 28, minSdk 24, targetSdk 36
- ABIs: arm64-v8a, armeabi-v7a
- Hermes bundle, no R8 or minify
- No database migration, existing accounts and data stay as they are

### Note

The app still talks to the same backend as 3.6.x. Updating from 3.6.1 keeps recipes, shopping list, tracker and household.
