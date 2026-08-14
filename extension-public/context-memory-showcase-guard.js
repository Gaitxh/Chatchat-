(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const isFullRoom = document.documentElement.dataset.surface === "web-app";
  let sawLivePinned = false;
  let sawArchivePinned = false;

  function inspect() {
    const audit = document.querySelector('[data-context-memory-audit="visible"]');
    if (!(audit instanceof HTMLElement)) return false;

    const pinnedTurn = audit.querySelector(
      '[data-context-memory-pinned-count]:not([data-context-memory-pinned-count="0"])[data-context-memory-latest-count]:not([data-context-memory-latest-count="0"])',
    );
    const pinnedIds = pinnedTurn?.querySelector('[data-context-memory-pinned-ids="visible"] code');
    if (pinnedTurn && pinnedIds) {
      if (audit.classList.contains("is-archive")) sawArchivePinned = true;
      else sawLivePinned = true;
    }

    if (sawLivePinned) {
      document.documentElement.dataset.chatchatContextMemoryLiveShowcase = "complete";
    }

    if (!isFullRoom) {
      document.documentElement.dataset.chatchatContextMemoryHistoryShowcase = "not-applicable";
      if (sawLivePinned) {
        document.documentElement.dataset.chatchatContextMemoryShowcase = "complete";
        return true;
      }
      return false;
    }

    if (sawArchivePinned) {
      document.documentElement.dataset.chatchatContextMemoryHistoryShowcase = "complete";
    }
    if (sawLivePinned && sawArchivePinned) {
      document.documentElement.dataset.chatchatContextMemoryShowcase = "complete";
      return true;
    }
    return false;
  }

  function start() {
    if (inspect()) return;
    const observer = new MutationObserver(() => {
      if (!inspect()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
