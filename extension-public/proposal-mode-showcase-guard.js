(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function enforce() {
    const root = document.documentElement;
    const sidePanelDone = root.dataset.chatchatConsultationShowcase === "complete";
    const fullRoomDone = root.dataset.chatchatRoomShowcase === "complete";
    if (!sidePanelDone && !fullRoomDone) return;

    const selector = document.querySelector(".proposal-mode-selector");
    const buttons = selector ? [...selector.querySelectorAll('button[role="radio"]')] : [];
    const active = buttons.filter((button) => button.getAttribute("aria-checked") === "true");
    if (selector && buttons.length === 5 && active.length === 1) return;

    if (sidePanelDone) root.dataset.chatchatConsultationShowcase = "failed-proposal-modes";
    if (fullRoomDone) root.dataset.chatchatRoomShowcase = "failed-proposal-modes";
  }

  new MutationObserver(enforce).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      "data-chatchat-consultation-showcase",
      "data-chatchat-room-showcase",
    ],
  });
  window.addEventListener("DOMContentLoaded", enforce, { once: true });
})();
