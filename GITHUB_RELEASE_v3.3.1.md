# Spoonful 3.3.1

**APK:** `Spoonful-v3.3.1.apk` · versionCode `16` · versionName `3.3.1`

Fix release on top of 3.3.0. App changes only.

---

## Image crop: now it really matches

The bug had two causes:

1. For **older crops** the image size was not stored, and `Image.getSize`
   returns nothing for photos taken inside the app. Without the size the crop
   cannot be calculated, so the view fell back to "centred, no zoom" — exactly
   what was visible.
2. The size is now read from the image **load event** itself and also stored
   when cropping, so the selection is correct for old photos too, in every frame
   size.

Automatic tests were added for this (`__tests__/crop.test.ts`): landscape,
portrait, square and extreme aspect ratios are checked to ensure the selected
point ends up in the centre of the visible area.

## Dashboard / landing

* "New in …" now always shows **the installed version** (placeholder instead of
  a hard-coded number).
* The recipe count comes **live from the library** instead of a fixed number —
  also before signing in (a small database function provides the count).
* Language count and version were already correct.

## Cooking mode

* Step guidance (coach tip and "look for") is now **translated** when the app
  runs in another language (cached, so it stays fast).
* Clearer layout: label in bold and bright, the text below it. "Look for" is
  shown in its own light yellow, so statement and hint are easy to tell apart.
* **Read aloud** uses the language **of the text**, so an English coach tip is
  spoken in English instead of with a German accent.
* "Cook a second dish in parallel" has been **removed completely** (button,
  pop-up and the related storage).

## Recipe form: equal field heights

With long labels (German "Vorbereitungszeit (min)") the label wrapped, which
made side-by-side fields different heights. The label now has a fixed line
height and shrinks automatically when needed, and the inputs have a uniform
minimum height — rows line up exactly in every language.

## "Estimate with AI": stable nutrition

Estimating five times produced five different values (1000 / 800 / 400 kcal).
Fixed now:

* a fixed nutrition table calculates from the ingredient amounts,
* the AI is called with temperature 0 (same question, same answer),
* if both differ a lot they are averaged instead of jumping,
* the result is remembered: the same recipe always returns the same numbers.

## Tracker: weight is collapsible

The weight card had no header row to open and close it (a bug in previous
versions: the toggle was in the wrong place in the code, so the card was always
visible). It is now a collapsible section like food and water, closed by
default.

## Messages

All notices (saved, not found, confirmations) are still shown as a themed card
inside the app — no system dialogs.

## AI recipe titles

Recipes created from a video link get a **crafted title** instead of the video
title: clickbait, channel names, emojis, hashtags, "shorts" and shouting are
stripped. If the video title already is a proper dish name, it is kept.
