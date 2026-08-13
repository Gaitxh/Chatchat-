import Database from "@tauri-apps/plugin-sql";
import type { AdapterRecipe, AdapterRecipeStore } from "./recipe.js";

const DATABASE_URL = "sqlite:chatchat.db";

interface AdapterRecipeRow {
  profile_id: string;
  composer_selector: string | null;
  send_selector: string | null;
  response_selector: string | null;
  created_at: string;
  updated_at: string;
}

export class TauriSqliteAdapterRecipeStore implements AdapterRecipeStore {
  readonly backend = "sqlite" as const;
  readonly #database: Database;

  private constructor(database: Database) {
    this.#database = database;
  }

  static async open(): Promise<TauriSqliteAdapterRecipeStore> {
    return new TauriSqliteAdapterRecipeStore(await Database.load(DATABASE_URL));
  }

  async list(): Promise<AdapterRecipe[]> {
    const rows = await this.#database.select<AdapterRecipeRow[]>(
      `SELECT profile_id, composer_selector, send_selector, response_selector,
        created_at, updated_at FROM adapter_recipes ORDER BY updated_at DESC`,
    );
    return rows.map(fromRow);
  }

  async get(profileId: string): Promise<AdapterRecipe | null> {
    const rows = await this.#database.select<AdapterRecipeRow[]>(
      `SELECT profile_id, composer_selector, send_selector, response_selector,
        created_at, updated_at FROM adapter_recipes WHERE profile_id = $1 LIMIT 1`,
      [profileId],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async save(recipe: AdapterRecipe): Promise<void> {
    await this.#database.execute(
      `INSERT OR REPLACE INTO adapter_recipes (
        profile_id, composer_selector, send_selector, response_selector,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        recipe.profileId,
        recipe.composerSelector,
        recipe.sendSelector,
        recipe.responseSelector,
        recipe.createdAt,
        recipe.updatedAt,
      ],
    );
  }

  async remove(profileId: string): Promise<void> {
    await this.#database.execute(
      "DELETE FROM adapter_recipes WHERE profile_id = $1",
      [profileId],
    );
  }
}

function fromRow(row: AdapterRecipeRow): AdapterRecipe {
  return {
    profileId: row.profile_id,
    composerSelector: row.composer_selector,
    sendSelector: row.send_selector,
    responseSelector: row.response_selector,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
