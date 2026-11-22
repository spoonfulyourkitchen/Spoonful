export type RootStackParamList = {
  Landing: undefined;
  Auth: { register?: boolean } | undefined;
  Legal: { page: 'impressum' | 'datenschutz' | 'cookies' | 'agb' };
  Main: { screen?: string } | undefined;
  Dashboard: undefined;
  Library: undefined;
  MyRecipes: undefined;
  Assistant: undefined;
  Saved: undefined;
  Tracker: undefined;
  Community: undefined;
  Shopping: undefined;
  Household: undefined;
  Theme: undefined;
  Settings: undefined;
  Admin: undefined;
  RecipeDetail: { recipeId: string; title?: string; source?: string; recipe?: any };
  RecipeForm: { recipe?: any } | undefined;
  Cooking: {
    title?: string;
    steps: string[];
    totalTime?: number;
    ingredients?: string[];
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    recipeKey?: string;
    translatedTitle?: string;
    translatedSteps?: string[];
    translatedIngredients?: string[];
  };
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
