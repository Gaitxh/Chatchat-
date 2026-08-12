import type { ProviderProfile, ProviderProfileStore } from "./types.js";

const STORAGE_KEY = "chatchat.provider-profiles.v1";

export class BrowserProviderProfileStore implements ProviderProfileStore {
  readonly backend = "browser-local" as const;

  async list(): Promise<ProviderProfile[]> {
    return this.#read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(profile: ProviderProfile): Promise<void> {
    const profiles = this.#read();
    const index = profiles.findIndex((item) => item.profileId === profile.profileId);
    if (index >= 0) profiles[index] = profile;
    else profiles.push(profile);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }

  async remove(profileId: string): Promise<void> {
    const profiles = this.#read().filter((item) => item.profileId !== profileId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }

  #read(): ProviderProfile[] {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ProviderProfile[]) : [];
    } catch {
      return [];
    }
  }
}
