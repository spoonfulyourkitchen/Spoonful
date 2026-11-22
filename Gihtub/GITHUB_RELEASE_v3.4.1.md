# Spoonful v3.4.1: clean themes, Google sign-in, loading progress

Spoonful 3.4.1 removes the last of the old glass look, adds Google sign-in, shows how much of the library has loaded and makes sure new passwords are strong enough.

## Highlights

### A clean look on every theme
The translucent "glass" panels and the coloured background wash are gone. Until now only the default theme was flat; all the other, mostly light, themes still looked glassy. Every theme now uses opaque card surfaces in its own colour.

### Sign in with Google
A new **Continue with Google** button on the sign-in screen opens Google in the browser and returns straight into the app. (Requires a one-time setup in the Supabase dashboard and a Google Cloud OAuth client.)

### Library: loading with a percentage
The book loader in the library now shows a **percentage bar** under the "Cooking..." label while recipes load. Its colour follows the theme, and it starts over on each new search or filter.

### Signup: password strength
Under the password field there is a strength meter (dark red - light red - yellow - light yellow - green - light green). **You can only create the account once it reaches green** - the button stays disabled until then. The meter appears on the password field only, not on the confirmation field.

### Text without em dashes
All em dashes were removed from the app text, so the copy no longer reads as machine-generated.

## Install
Download `Spoonful-v3.4.1.apk` and install it over your current version (sign-in and your data stay). Requires Android 7+ (arm64 or armeabi-v7a).

**Package:** `com.spoonful` - versionCode 20 - versionName 3.4.1 - 41.4 MB (arm64-v8a, armeabi-v7a)
**SHA-256:** `0182546C8B7B8A85B9C3CB8CB075A88E010F63C373F0CE4958BEB1E6A27F446C`
