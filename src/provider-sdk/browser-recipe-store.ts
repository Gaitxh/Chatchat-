import type { AdapterRecipe, AdapterRecipeStore } from "./recipe.js";

const STORAGE_KEY = "chatchat.adapter-recipes.v1";

export class BrowserAdapterRecipeStore implements AdapterRecipeStore {
  readonly backend = "browser-local" as const;

  async list(): Promise<AdapterRecipe[]> {
    return this.#read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(profileId: string): Promise<AdapterRecipe | null> {
    return this.#read().find((recipe) => recipe.profileId === profileId) ?? null;
  }

  async save(recipe: AdapterRecipe): Promise<void> {
    const recipes = this.#read();
    const index = recipes.findIndex((item) => item.profileId === recipe.profileId);
    if (index >= 0) recipes[index] = recipe;
    else recipes.push(recipe);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }

  async remove(profileId: string): Promise<void> {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.#read().filter((recipe) => recipe.profileId !== profileId)),
    );
  }

  #read(): AdapterRecipe[] {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AdapterRecipe[]) : [];
    } catch {
      return [];
    }
  }
}
