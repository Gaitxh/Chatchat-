import { BrowserCouncilHistoryStore } from "./browser-store.js";
import { TauriSqliteCouncilHistoryStore } from "./tauri-sql-store.js";
import type { CouncilHistoryStore } from "./types.js";

export * from "./types.js";

export async function createCouncilHistoryStore(): Promise<CouncilHistoryStore> {
  if (isTauriRuntime()) {
    try {
      return await TauriSqliteCouncilHistoryStore.open();
    } catch (error) {
      console.warn(
        "ChatChat could not open SQLite history; falling back to browser-local storage.",
        error,
      );
    }
  }

  return new BrowserCouncilHistoryStore();
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}
