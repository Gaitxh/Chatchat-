(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  function enforce() {
    const root = document.documentElement;
    const sidePanelDone = root.dataset.chatchatConsultationShowcase === "complete";
    const fullRoomDone = root.dataset.chatchatRoomShowcase === "complete";
    if (!sidePanelDone && !fullRoomDone) return;

    const receipt = document.querySelector(".consultation-receipt");
    const preview = receipt?.querySelector(".receipt-card-preview");
    const actions = receipt ? [...receipt.querySelectorAll(".receipt-actions button")] : [];
    if (receipt && preview && actions.length >= 2) return;

    if (sidePanelDone) root.dataset.chatchatConsultationShowcase = "failed-consultation-receipt";
    if (fullRoomDone) root.dataset.chatchatRoomShowcase = "failed-consultation-receipt";
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
