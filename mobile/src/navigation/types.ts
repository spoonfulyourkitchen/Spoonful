/**
 * Shared root navigator param list + navigation ref.
 * Kept in its own module so the shell/drawer can navigate without circular
 * imports from App.tsx.
 */

export type RootStackParamList = {
  // public
  Landing: undefined;
  Auth: undefined;
  Legal: { page: 'impressum' | 'datenschutz' | 'cookies' | 'agb' };
  // signed-in shell
  Main: { screen?: string } | undefined;
  Dashboard: undefined;
  Library: undefined;
  MyRecipes: undefined;
  Assistant: undefined;
  Saved: undefined;
  Tracker: undefined;
  Community: undefined;
  Shopping: undefined;
  Theme: undefined;
  Settings: undefined;
  Admin: undefined;
  RecipeDetail: { recipeId: string; title?: string; source?: string; recipe?: any };
  RecipeForm: { recipe?: any } | undefined;
  Cooking: { title?: string; steps: string[]; totalTime?: number; ingredients?: string[]; calories?: number; protein?: number; carbs?: number; fat?: number };
  SignOut: undefined;
};

export type RootTabParamList = {
  Library: undefined;
  MyRecipes: undefined;
  Assistant: undefined;
  Saved: undefined;
  Tracker: undefined;
};

export const TAB_ROUTES: { name: keyof RootTabParamList; label: string }[] = [
  { name: 'Library', label: 'Library' },
  { name: 'MyRecipes', label: 'My Recipes' },
  { name: 'Assistant', label: 'AI Chef' },
  { name: 'Saved', label: 'Saved' },
  { name: 'Tracker', label: 'Tracker' },
];
