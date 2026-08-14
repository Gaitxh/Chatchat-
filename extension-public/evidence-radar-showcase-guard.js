(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function enforce() {
    const root = document.documentElement;
    const sidePanelDone = root.dataset.chatchatConsultationShowcase === "complete";
    const fullRoomDone = root.dataset.chatchatRoomShowcase === "complete";
    if (!sidePanelDone && !fullRoomDone) return;
    if (document.querySelector(".evidence-gap-radar")) return;
    if (sidePanelDone) root.dataset.chatchatConsultationShowcase = "failed-evidence-radar";
    if (fullRoomDone) root.dataset.chatchatRoomShowcase = "failed-evidence-radar";
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
