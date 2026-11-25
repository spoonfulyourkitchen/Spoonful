const memory = new Map<string, any>();

export function rememberRecipe(recipe: any): void {
  const id = recipe?.id ?? recipe?.recipeKey ?? recipe?._id;
  if (!id) return;
  memory.set(String(id), recipe);
  if (memory.size > 60) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

export function getRememberedRecipe(id?: string | null): any | null {
  if (!id) return null;
  return memory.get(String(id)) ?? null;
}
