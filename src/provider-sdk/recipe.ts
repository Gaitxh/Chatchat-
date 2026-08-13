export type TeachRole = "composer" | "send" | "response";

export interface TeachSelection {
  role: TeachRole;
  selector: string;
  tag: string;
  id: string | null;
  ariaLabel: string | null;
  dataTestId: string | null;
  dataMessageAuthorRole: string | null;
  inputType: string | null;
  contentEditable: boolean;
  selectedAt: string;
  error?: string;
}

export interface AdapterRecipe {
  profileId: string;
  composerSelector: string | null;
  sendSelector: string | null;
  responseSelector: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteAdapterRecipe extends AdapterRecipe {
  composerSelector: string;
  sendSelector: string;
  responseSelector: string;
}

export type AdapterRecipeBackend = "sqlite" | "browser-local";

export interface AdapterRecipeStore {
  readonly backend: AdapterRecipeBackend;
  list(): Promise<AdapterRecipe[]>;
  get(profileId: string): Promise<AdapterRecipe | null>;
  save(recipe: AdapterRecipe): Promise<void>;
  remove(profileId: string): Promise<void>;
}

export function createEmptyAdapterRecipe(profileId: string): AdapterRecipe {
  const now = new Date().toISOString();
  return {
    profileId,
    composerSelector: null,
    sendSelector: null,
    responseSelector: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function applyTeachSelection(
  current: AdapterRecipe | null | undefined,
  profileId: string,
  selection: TeachSelection,
): AdapterRecipe {
  validateTeachSelection(selection);
  const recipe = current ?? createEmptyAdapterRecipe(profileId);
  const selector = selection.selector.trim();
  const next: AdapterRecipe = {
    ...recipe,
    updatedAt: new Date().toISOString(),
  };

  if (selection.role === "composer") next.composerSelector = selector;
  else if (selection.role === "send") next.sendSelector = selector;
  else next.responseSelector = selector;

  return next;
}

export function adapterRecipeComplete(
  recipe: AdapterRecipe | null | undefined,
): recipe is CompleteAdapterRecipe {
  return Boolean(
    recipe?.composerSelector && recipe.sendSelector && recipe.responseSelector,
  );
}

export function recipeProgress(recipe: AdapterRecipe | null | undefined): number {
  if (!recipe) return 0;
  return [recipe.composerSelector, recipe.sendSelector, recipe.responseSelector].filter(Boolean).length;
}

export function validateTeachSelection(selection: TeachSelection): void {
  if (selection.error) throw new Error(selection.error);
  const selector = selection.selector.trim();
  if (!selector || selector.length > 512) {
    throw new Error("Teach selection returned an invalid selector.");
  }
  if (selection.inputType?.toLocaleLowerCase() === "password") {
    throw new Error("ChatChat refuses to teach against password fields.");
  }
  if (
    selection.role === "composer" &&
    !selection.contentEditable &&
    !["textarea", "input"].includes(selection.tag.toLocaleLowerCase())
  ) {
    throw new Error("Composer selection must be an input, textarea, or contenteditable element.");
  }
}
