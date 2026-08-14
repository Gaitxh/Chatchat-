(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function check() {
    const root = document.documentElement;
    const selector = document.querySelector(".proposal-mode-selector");
    const buttons = selector ? [...selector.querySelectorAll('button[role="radio"]')] : [];
    const active = buttons.filter((button) => button.getAttribute("aria-checked") === "true");
    if (!selector || buttons.length !== 5 || active.length !== 1) return;
    root.dataset.chatchatProposalModeShowcase = "complete";
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
