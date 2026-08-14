(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;
  const TRAIL_KEY = "chatchat.investigation.trail.v1";
  const TRAIL_UPDATED_EVENT = "chatchat:investigation-trail-updated";

  function check() {
    const root = document.documentElement;
    const trail = document.querySelector(".investigation-trail");
    const branch = trail?.querySelector(".trail-branch__reason");
    const nodes = trail?.querySelectorAll(".trail-node").length ?? 0;
    if (!trail || !branch || nodes < 2) return;
    root.dataset.chatchatInvestigationTrailShowcase = "complete";
    observer.disconnect();
  }

  async function checkStorage() {
    try {
      const value = await window.chrome?.storage?.local?.get(TRAIL_KEY);
      const edges = value?.[TRAIL_KEY];
      if (!Array.isArray(edges) || !edges.length) return;
      document.documentElement.dataset.chatchatInvestigationTrailStorageShowcase = "complete";
    } catch {
      // The visible Trail assertion remains the primary product gate.
    }
  }

  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  window.addEventListener(TRAIL_UPDATED_EVENT, () => void checkStorage());
  window.addEventListener("DOMContentLoaded", check, { once: true });
  check();
  void checkStorage();
})();
