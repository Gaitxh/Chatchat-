(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "onboarding") return;

  function check() {
    const cards = [...document.querySelectorAll(".zero-touch-provider")];
    const selected = cards.filter((card) => card.getAttribute("aria-pressed") === "true");
    const action = document.querySelector(".zero-touch-action > button");
    const copy = document.querySelector(".zero-touch-copy");
    const extensionRoot = document.getElementById("extension-root");
    const spectatorRoot = document.getElementById("spectator-mode-root");
    const noviceText = `${copy?.textContent ?? ""} ${action?.textContent ?? ""}`.toLowerCase();
    const leaksDeveloperJargon = /\bselector\b|\badapter\b|\brecipe\b/.test(noviceText);
    const consultationHidden = extensionRoot ? getComputedStyle(extensionRoot).display === "none" : false;
    const spectatorHidden = spectatorRoot ? getComputedStyle(spectatorRoot).display === "none" : false;
    if (
      cards.length < 8 ||
      selected.length < 2 ||
      !(action instanceof HTMLButtonElement) ||
      action.disabled ||
      !copy ||
      leaksDeveloperJargon ||
      !consultationHidden ||
      !spectatorHidden
    ) return;
    document.documentElement.dataset.chatchatZeroTouchOnboardingShowcase = "complete";
    observer.disconnect();
  }

  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.addEventListener("DOMContentLoaded", check, { once: true });
  check();
})();
