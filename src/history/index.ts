import { BrowserCouncilHistoryStore } from "./browser-store.js";
import type { CouncilHistoryStore } from "./types.js";

export * from "./types.js";

export async function createCouncilHistoryStore(): Promise<CouncilHistoryStore> {
  return new BrowserCouncilHistoryStore();
}
