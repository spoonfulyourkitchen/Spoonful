

import {
  SUPABASE_URL as SECRET_SUPABASE_URL,
  SUPABASE_ANON_KEY as SECRET_SUPABASE_ANON_KEY,
} from './config-secrets';

export const SUPABASE_URL = SECRET_SUPABASE_URL;
export const SUPABASE_ANON_KEY = SECRET_SUPABASE_ANON_KEY;

export const SUPABASE_STORAGE_BUCKET = 'recipe-images';

export const APP_NAME = 'Spoonful';

export const APP_VERSION = '3.7.0';
