import { IS_WEB } from '../lib/platform';

const globalAny = globalThis as any;
const origin = IS_WEB && globalAny?.location?.origin ? String(globalAny.location.origin) : '';
const pathname = IS_WEB && globalAny?.location?.pathname ? String(globalAny.location.pathname) : '/';
const hostedUnderApp = pathname === '/app' || pathname.startsWith('/app/');
const base = hostedUnderApp ? 'app/' : '';

const path = (value: string) => `${base}${value}`;

const config = {
  screens: {
    Landing: hostedUnderApp ? 'app' : '',
    Auth: path('auth'),
    Legal: path('legal/:page'),
    Main: {
      screens: {
        Library: path('library'),
        MyRecipes: path('my-recipes'),
        Assistant: path('assistant'),
        Tracker: path('tracker'),
        Shopping: path('shopping-tab'),
        Household: path('household'),
      },
    },
    Dashboard: path('dashboard'),
    Shopping: path('shopping'),
    Theme: path('theme'),
    Settings: path('settings'),
    Admin: path('admin'),
    RecipeDetail: path('recipe/:recipeId'),
    RecipeForm: path('recipe-form'),
    Cooking: path('cooking'),
  },
};

export const webLinking = IS_WEB
  ? {
      prefixes: origin ? [origin] : ['/'],
      config,
    }
  : undefined;
