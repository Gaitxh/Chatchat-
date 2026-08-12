import Database from "@tauri-apps/plugin-sql";
import type { ProviderProfile, ProviderProfileStore } from "./types.js";

const DATABASE_URL = "sqlite:chatchat.db";

interface ProviderProfileRow {
  profile_id: string;
  provider_id: string;
  adapter_id: string;
  display_name: string;
  url: string;
  origin: string;
  profile_key: string;
  auth_state: ProviderProfile["authState"];
  seat_state: ProviderProfile["seatState"];
  created_at: string;
  updated_at: string;
}

export class TauriSqliteProviderProfileStore implements ProviderProfileStore {
  readonly backend = "sqlite" as const;
  readonly #database: Database;

  private constructor(database: Database) {
    this.#database = database;
  }

  static async open(): Promise<TauriSqliteProviderProfileStore> {
    return new TauriSqliteProviderProfileStore(await Database.load(DATABASE_URL));
  }

  async list(): Promise<ProviderProfile[]> {
    const rows = await this.#database.select<ProviderProfileRow[]>(
      `SELECT profile_id, provider_id, adapter_id, display_name, url, origin,
        profile_key, auth_state, seat_state, created_at, updated_at
       FROM provider_profiles
       ORDER BY updated_at DESC`,
    );
    return rows.map(profileFromRow);
  }

  async save(profile: ProviderProfile): Promise<void> {
    await this.#database.execute(
      `INSERT OR REPLACE INTO provider_profiles (
        profile_id, provider_id, adapter_id, display_name, url, origin,
        profile_key, auth_state, seat_state, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        profile.profileId,
        profile.providerId,
        profile.adapterId,
        profile.displayName,
        profile.url,
        profile.origin,
        profile.profileKey,
        profile.authState,
        profile.seatState,
        profile.createdAt,
        profile.updatedAt,
      ],
    );
  }

  async remove(profileId: string): Promise<void> {
    await this.#database.execute(
      "DELETE FROM provider_profiles WHERE profile_id = $1",
      [profileId],
    );
  }
}

function profileFromRow(row: ProviderProfileRow): ProviderProfile {
  return {
    profileId: row.profile_id,
    providerId: row.provider_id,
    adapterId: row.adapter_id,
    displayName: row.display_name,
    url: row.url,
    origin: row.origin,
    profileKey: row.profile_key,
    authState: row.auth_state,
    seatState: row.seat_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
