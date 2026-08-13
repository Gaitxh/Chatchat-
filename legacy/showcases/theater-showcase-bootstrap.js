(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "theater") return;

  document.documentElement.dataset.chatchatBrowserTheaterShowcase = "booted";

  // Reuse the canonical deterministic ten-seat Browser House transport.
  history.replaceState(null, "", `${location.pathname}?showcase=1&theater=1`);

  let jumped = false;
  const jumpToChangedMind = () => {
    if (jumped) return;
    const strong = document.querySelector(
      '#chatchat-browser-council-theater .strong-link[data-theater-event]',
    );
    if (!(strong instanceof HTMLButtonElement)) return;
    jumped = true;
    strong.click();
    document.documentElement.dataset.chatchatBrowserTheaterJumped = "revision";
  };

  const observer = new MutationObserver(jumpToChangedMind);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(jumpToChangedMind, 0);
})();
