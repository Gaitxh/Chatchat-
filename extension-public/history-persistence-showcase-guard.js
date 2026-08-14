(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const HISTORY_UPDATED_EVENT = "chatchat:consultation-history-updated";
  const DB_NAME = "chatchat-consultation-history-v1";
  const ARCHIVES = "archives";
  const EXECUTION_DB_NAME = "chatchat-provider-execution-history-v1";
  const EXECUTION_STORE = "receipts";
  let checking = false;

  window.addEventListener(HISTORY_UPDATED_EVENT, (event) => {
    const sessionId = event.detail?.sessionId ?? "";
    if (!sessionId || checking) return;
    checking = true;
    void verifyArchive(sessionId);
  });

  async function verifyArchive(sessionId) {
    try {
      const db = await openExistingDatabase(DB_NAME, "Consultation history database does not exist.");
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

      const executionDb = await openExistingDatabase(
        EXECUTION_DB_NAME,
        "Provider execution history database does not exist.",
      );
      if (!executionDb.objectStoreNames.contains(EXECUTION_STORE)) {
        throw new Error("Provider execution receipt store is missing.");
      }
      const execution = await requestValue(
        executionDb.transaction(EXECUTION_STORE, "readonly").objectStore(EXECUTION_STORE).get(sessionId),
      );
      executionDb.close();
      if (!execution || execution.sessionId !== sessionId) {
        throw new Error("Completed consultation execution receipt was not persisted.");
      }
      if (!Array.isArray(execution.transports) || !execution.transports.length) {
        throw new Error("Execution receipt has no transport records.");
      }
      if (!Array.isArray(execution.execution) || !execution.execution.length) {
        throw new Error("Execution receipt has no parse/repair audit events.");
      }
      if (!execution.transports.some((record) => Array.isArray(record.snapshotEventIds) && record.snapshotEventIds.length > 0)) {
        throw new Error("Execution receipt never preserved a peer-visible prompt snapshot.");
      }
      if (!execution.execution.some((record) => record.stage === "structured_parsed")) {
        throw new Error("Execution receipt never preserved a structured parse event.");
      }

      document.documentElement.dataset.chatchatExecutionHistoryPersistenceShowcase = "complete";

      const historyButton = await waitForElement(() => document.querySelector(".history-entry-main"));
      historyButton.click();
      const audit = await waitForElement(() => {
        const candidate = document.querySelector('[data-history-execution-audit="loaded"]');
        return candidate?.getAttribute("data-history-execution-session") === sessionId ? candidate : null;
      });
      const historicalTurn = audit.querySelector(
        '[data-history-execution-snapshot-count]:not([data-history-execution-snapshot-count="0"])[data-history-execution-published-count]:not([data-history-execution-published-count="0"])',
      );
      if (!historicalTurn) {
        throw new Error("Historical execution receipt did not replay a peer-visible published turn.");
      }
      document.documentElement.dataset.chatchatExecutionHistoryReplayShowcase = "complete";
      document.documentElement.dataset.chatchatHistoryPersistenceShowcase = "complete";
    } catch {
      document.documentElement.dataset.chatchatExecutionHistoryPersistenceShowcase = "failed";
      document.documentElement.dataset.chatchatExecutionHistoryReplayShowcase = "failed";
      document.documentElement.dataset.chatchatHistoryPersistenceShowcase = "failed";
    } finally {
      checking = false;
    }
  }

  async function openExistingDatabase(name, missingMessage) {
    if (typeof indexedDB?.databases === "function") {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === name)) {
        throw new Error(missingMessage);
      }
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`Could not open ${name}.`));
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Consultation history read failed."));
    });
  }

  function waitForElement(find) {
    const current = find();
    if (current) return Promise.resolve(current);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const next = find();
        if (!next) return;
        observer.disconnect();
        resolve(next);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    });
  }
})();
