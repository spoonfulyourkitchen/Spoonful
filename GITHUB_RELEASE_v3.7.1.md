## Spoonful 3.7.1

A bigger product database and a faster way to log what you eat.

**Download:** `Spoonful-v3.7.1.apk` under Assets below. Android 7.0 or newer, arm64 and armv7. Install it over your current version, account, recipes, tracker and lists stay as they are.

### What is new

**1.5 million products**

Barcode scans and product searches now run against a database of about 1.5 million products, kept on the server. Private labels are in there too: Edeka and Gut & Guenstig, Lidl and Milbona, Rewe and Ja, Aldi, Kaufland, Penny, Netto, Norma, tegut, Alnatura, denn's, dm, Rossmann, Globus, Marktkauf, Hit and Aro.

Spoonful asks the database first and only falls back to the live product service when a code is still unknown. A product found that way is stored, so the next scan of the same code is instant.

**Search answers in milliseconds**

Product search is prefix first: matches that start with what you type come first, brands are checked as a second pass. Common searches answer in 6 to 15 ms, and the database plan is pinned so Postgres does not switch to a slow scan for larger result sets.

**Recent foods when logging a meal**

"Log meal" has a third page now: the eight foods you logged most often in the last 14 days, one tap adds them with the usual portion. The form opens on recipes, on recent foods when there are any, and otherwise on manual entry.

### Technical

- Version 3.7.1, build 30, minSdk 24, targetSdk 36
- ABIs: arm64-v8a, armeabi-v7a
- Hermes bundle, no R8 or minify
- Product catalog migration already applied on the server, no action needed on the device

### Note

The local-only test button stays limited to localhost development builds.
