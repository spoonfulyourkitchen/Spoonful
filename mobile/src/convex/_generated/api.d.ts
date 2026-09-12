/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as auth_email from "../auth/email.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as calorieEntries from "../calorieEntries.js";
import type * as catalogTypes from "../catalogTypes.js";
import type * as collections from "../collections.js";
import type * as http from "../http.js";
import type * as rateLimit from "../rateLimit.js";
import type * as realCatalog from "../realCatalog.js";
import type * as realCatalog10 from "../realCatalog10.js";
import type * as realCatalog11 from "../realCatalog11.js";
import type * as realCatalog2 from "../realCatalog2.js";
import type * as realCatalog3 from "../realCatalog3.js";
import type * as realCatalog4 from "../realCatalog4.js";
import type * as realCatalog5 from "../realCatalog5.js";
import type * as realCatalog6 from "../realCatalog6.js";
import type * as realCatalog7 from "../realCatalog7.js";
import type * as realCatalog8 from "../realCatalog8.js";
import type * as realCatalog9 from "../realCatalog9.js";
import type * as realImages from "../realImages.js";
import type * as recipes from "../recipes.js";
import type * as savedRecipes from "../savedRecipes.js";
import type * as sharing from "../sharing.js";
import type * as shoppingList from "../shoppingList.js";
import type * as translate from "../translate.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  "auth/email": typeof auth_email;
  "auth/emailOtp": typeof auth_emailOtp;
  calorieEntries: typeof calorieEntries;
  catalogTypes: typeof catalogTypes;
  collections: typeof collections;
  http: typeof http;
  rateLimit: typeof rateLimit;
  realCatalog: typeof realCatalog;
  realCatalog10: typeof realCatalog10;
  realCatalog11: typeof realCatalog11;
  realCatalog2: typeof realCatalog2;
  realCatalog3: typeof realCatalog3;
  realCatalog4: typeof realCatalog4;
  realCatalog5: typeof realCatalog5;
  realCatalog6: typeof realCatalog6;
  realCatalog7: typeof realCatalog7;
  realCatalog8: typeof realCatalog8;
  realCatalog9: typeof realCatalog9;
  realImages: typeof realImages;
  recipes: typeof recipes;
  savedRecipes: typeof savedRecipes;
  sharing: typeof sharing;
  shoppingList: typeof shoppingList;
  translate: typeof translate;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
