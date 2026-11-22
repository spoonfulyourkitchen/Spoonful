## Spoonful 3.7.0

The design update: every page opens with the same dark rounded header and its menu button, the tracker is split into water, barcode, weight and meals, and the shopping list is shared with your household on the server.

**Download:** `Spoonful-v3.7.0.apk` under Assets below. Android 7.0 or newer, arm64 and armv7. This build replaces the earlier 3.7.0, install it over your current version, account and data stay as they are.

### What is new

**One header on every page**
Every screen opens with the same dark header with the rounded lower edge, the page name and the menu button in the top right corner. The old bar with the logo and the wordmark is gone. Buttons are pills, section titles use the accent colour, and the active tab sits in its own pill. Recipe detail, household and the admin screen carry the menu button too.

**Household hub**
Household is a tab hub now: today, tasks, shopping list, weekly plan and members. Leaving removes your own entries, the last member closes the household, and joining again with the code works. Household data lives on the server, not on the device.

**Shopping list that actually syncs**
The shopping list is stored on the server and shared with the household. Items added by one member show up for everyone, checkoffs land instantly, and entries from older local versions are migrated once. Leaving the household turns shared entries back into private ones.

**Tracker with its own tabs**
Water, barcode, weight and meals each have their own tab that fills the page: a large water counter with quick amounts, the scanner with its code field, the weight chart with recent entries, and the meal list with calories and macros. Remaining calories and macros sit in the header.

**Profile update on start**
Existing accounts get one prompt at start about the details the app now uses. A single tap accepts it and opens the short flow, the close button appears after 12 seconds so the prompt is seen. It comes back on the next start until the profile is complete, then it stays away. The prompt is switched from the server, the questions are goal, body data, activity, allergies, diet, cooking experience, household size, cooking time and cuisines.

**Smaller things**
The back arrow in the recipe form sits inside the header, leftover duplicate section headers in the tracker are gone, and page changes are instant again, without a white frame in between.

### Also in 3.7.0

- Profile refresh for existing users: a short prompt for allergies, diet, experience, household size, cooking time and cuisines.
- Log a meal straight from your recipes with a portion stepper.
- Library filters and the cuisine picker open as dialogs with the library visible behind them.
- Beginner accounts start with easy recipes and unlock more over time, the AI Chef follows the same level.
- Leaner recipe form with times, portions, tags and nutrition under Details.

### Technical

- Version 3.7.0.1, build 29, minSdk 24, targetSdk 36
- ABIs: arm64-v8a, armeabi-v7a
- Hermes bundle, no R8 or minify
- No database migration, existing accounts and data stay as they are

### Note

The local-only test button stays limited to localhost development builds.
