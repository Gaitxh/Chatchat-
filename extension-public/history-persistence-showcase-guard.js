(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const HISTORY_UPDATED_EVENT = "chatchat:consultation-history-updated";
  const DB_NAME = "chatchat-consultation-history-v1";
  const ARCHIVES = "archives";
  let checking = false;

  window.addEventListener(HISTORY_UPDATED_EVENT, (event) => {
    const sessionId = event.detail?.sessionId ?? "";
    if (!sessionId || checking) return;
    checking = true;
    void verifyArchive(sessionId);
  });

  async function verifyArchive(sessionId) {
    try {
      const db = await openExistingDatabase();
      if (!db.objectStoreNames.contains(ARCHIVES)) {
        throw new Error("Consultation archive store is missing.");
      }
      const archive = await requestValue(
        db.transaction(ARCHIVES, "readonly").objectStore(ARCHIVES).get(sessionId),
      );
      db.close();
      if (!archive?.report || archive.sessionId !== sessionId) {
        throw new Error("Completed consultation was not persisted.");
      }
      document.documentElement.dataset.chatchatHistoryPersistenceShowcase = "complete";
    } catch {
      document.documentElement.dataset.chatchatHistoryPersistenceShowcase = "failed";
    } finally {
      checking = false;
    }
  }

  async function openExistingDatabase() {
    if (typeof indexedDB?.databases === "function") {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === DB_NAME)) {
        throw new Error("Consultation history database does not exist.");
      }
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open consultation history."));
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Consultation history read failed."));
    });
  }
})();
