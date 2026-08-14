(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function check() {
    const root = document.documentElement;
    if (!document.querySelector(".evidence-gap-radar")) return;
    root.dataset.chatchatEvidenceRadarShowcase = "complete";
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
