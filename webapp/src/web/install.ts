import { installWebGlue } from './glue';
import { installAppPrompt } from './install-prompt';

// Runs before App is evaluated so the connectivity probe and auth helpers are
// already in place when the app modules start. The install walkthrough is
// inserted before React's first paint, so the app is never visible without it.
installWebGlue();
installAppPrompt();
