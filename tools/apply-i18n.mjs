/**
 * Ersetzt die letzten festen Texte durch i18n-Tags.
 *
 * Aufruf:  node tools/apply-i18n.mjs [--write]
 * Ohne --write wird nur geprüft, was gefunden wurde (Trockenlauf).
 *
 * Jede Ersetzung steht hier ausdrücklich in der Liste — nichts wird geraten.
 * Wird ein Text nicht gefunden, meldet das Skript einen Fehler (dann hat sich
 * der Code geändert und die Liste muss nachgezogen werden).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = new URL('../mobile/src/', import.meta.url);
const WRITE = process.argv.includes('--write');

const MAP = {
  'screens/AssistantScreen.tsx': [
    ['placeholder="e.g. a quick spicy Turkish dinner with chickpeas for 4"', "placeholder={t('s.xPhDescribe')}"],
  ],
  'screens/AuthScreen.tsx': [
    ['placeholder="Your name"', "placeholder={t('s.xPhName')}"],
    ['placeholder="Password (min 8 characters)"', "placeholder={t('s.xPhPasswordMin')}"],
    ['placeholder="Repeat password"', "placeholder={t('s.xPhRepeatPassword')}"],
    ['placeholder="Password"', "placeholder={t('s.xPhPassword')}"],
    ['>Forgot password?<', ">{t('s.xForgotPassword')}<"],
  ],
  'screens/ResetPasswordScreen.tsx': [
    ['placeholder="New password (min 8 characters)"', "placeholder={t('s.xPhNewPasswordMin')}"],
    ['placeholder="Repeat new password"', "placeholder={t('s.xPhRepeatNewPassword')}"],
    ['Later - keep the current password', "{t('s.xLaterKeepPassword')}"],
  ],
  'screens/ThemeScreen.tsx': [
    ['title="Choose a theme"', "title={t('s.xChooseTheme')}"],
    ['subtitle="Pick a look that matches your mood. Your choice is saved and stays across sessions."', "subtitle={t('s.xChooseThemeSub')}"],
  ],
  'screens/LibraryScreen.tsx': [
    ['Surprise me', "{t('s.xSurpriseMe')}"],
    ['<FilterSection title="Total time">', "<FilterSection title={t('s.xTotalTime')}>"],
  ],
  'screens/CookingScreen.tsx': [
    ["Alert.alert('Nothing to add'", "Alert.alert(t('s.xNothingToAdd')"],
    ["Alert.alert('Saved offline'", "Alert.alert(t('s.xSavedOffline')"],
    ["Alert.alert('Added to shopping list'", "Alert.alert(t('s.xAddedShopping')"],
    ["Alert.alert('Could not add'", "Alert.alert(t('s.xCouldNotAdd')"],
    ["'You made it!'", "t('s.xYouMadeIt')"],
    ['>Back<', ">{t('s.xBack')}<"],
  ],
  'screens/RecipeDetailScreen.tsx': [
    ["Alert.alert('Could not update'", "Alert.alert(t('s.xCouldNotUpdate')"],
    ["Alert.alert('Nothing to add'", "Alert.alert(t('s.xNothingToAdd')"],
    ["Alert.alert('Could not add'", "Alert.alert(t('s.xCouldNotAdd')"],
    ["Alert.alert('Could not log'", "Alert.alert(t('s.xCouldNotLog')"],
    ["Alert.alert('Could not translate'", "Alert.alert(t('s.xCouldNotTranslate')"],
    ["Alert.alert('Could not share'", "Alert.alert(t('s.xCouldNotShare')"],
    ["Alert.alert('Please wait before trying again'", "Alert.alert(t('s.xPleaseWait')"],
    ["Alert.alert('Not approved yet'", "Alert.alert(t('s.xNotApproved')"],
    ["Alert.alert('Remove from Community?'", "Alert.alert(t('s.xRemoveFromCommunity')"],
    ["Alert.alert('Could not remove'", "Alert.alert(t('s.xCouldNotRemove')"],
    ['>Recipe not found<', ">{t('s.xRecipeNotFound')}<"],
    ['No ingredients listed.', "{t('s.xNoIngredients')}"],
    ['No steps listed.', "{t('s.xNoSteps')}"],
    ['accessibilityLabel="Log meal"', "accessibilityLabel={t('s.xLogMeal')}"],
  ],
  'screens/SettingsScreen.tsx': [
    ["Alert.alert('Export failed'", "Alert.alert(t('s.xExportFailed')"],
    ["Alert.alert('Could not delete the account'", "Alert.alert(t('s.xAccountDeleteFailed')"],
    ["Alert.alert('Sign out'", "Alert.alert(t('s.xSignOutTitle')"],
    ["Alert.alert('Add a message'", "Alert.alert(t('s.xAddMessage')"],
    ["Alert.alert('Could not send'", "Alert.alert(t('s.xCouldNotSend')"],
    ['Report a problem / Feedback', "{t('s.xFeedbackTitle')}"],
    ['Thank you!', "{t('s.xFeedbackThanks')}"],
    ['How was Spoonful?', "{t('s.xFeedbackAsk')}"],
    ['placeholder="Tell us what happened or what we should improve…"', "placeholder={t('s.xPhFeedback')}"],
  ],
};

let missing = 0;
let done = 0;

for (const [rel, pairs] of Object.entries(MAP)) {
  const url = new URL(rel, BASE);
  let text = readFileSync(url, 'utf8');
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      console.log(`FEHLT  ${rel}: ${from}`);
      missing += 1;
      continue;
    }
    text = text.split(from).join(to);
    done += 1;
  }
  if (WRITE) writeFileSync(url, text, 'utf8');
}

// App.tsx liegt außerhalb von src/
const appUrl = new URL('../mobile/App.tsx', import.meta.url);
let app = readFileSync(appUrl, 'utf8');
const appPairs = [
  ['>Something went wrong<', ">{translate('s.xCrashTitle')}<"],
  ['Der Fehler wurde gespeichert (Einstellungen → Letzte Fehler).', "{translate('s.xCrashSaved')}"],
  ['>Try again<', ">{translate('s.xCrashTryAgain')}<"],
  ['>Neu starten<', ">{translate('s.xCrashRestart')}<"],
  ['import { tryReloadApp }', "import { translate, tryReloadApp }"],
];
for (const [from, to] of appPairs) {
  if (!app.includes(from)) {
    console.log(`FEHLT  App.tsx: ${from}`);
    missing += 1;
    continue;
  }
  app = app.split(from).join(to);
  done += 1;
}
if (WRITE) writeFileSync(appUrl, app, 'utf8');

console.log(`\n${done} Ersetzungen ${WRITE ? 'geschrieben' : 'gefunden'}, ${missing} fehlend.`);
process.exit(missing > 0 ? 1 : 0);
