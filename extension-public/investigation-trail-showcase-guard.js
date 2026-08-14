(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function check() {
    const root = document.documentElement;
    const trail = document.querySelector(".investigation-trail");
    const branch = trail?.querySelector(".trail-branch__reason");
    const nodes = trail?.querySelectorAll(".trail-node").length ?? 0;
    if (!trail || !branch || nodes < 2) return;
    root.dataset.chatchatInvestigationTrailShowcase = "complete";
    observer.disconnect();
  }

  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  window.addEventListener("DOMContentLoaded", check, { once: true });
  check();
})();
