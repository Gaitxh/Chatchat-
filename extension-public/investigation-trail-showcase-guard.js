(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  let checking = false;

  function trigger() {
    const root = document.documentElement;
    const sidePanelDone = root.dataset.chatchatConsultationShowcase === "complete";
    const fullRoomDone = root.dataset.chatchatRoomShowcase === "complete";
    if ((!sidePanelDone && !fullRoomDone) || checking) return;
    checking = true;
    void waitForTrail(sidePanelDone, fullRoomDone);
  }

  async function waitForTrail(sidePanelDone, fullRoomDone) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const trail = document.querySelector(".investigation-trail");
      const branch = trail?.querySelector(".trail-branch__reason");
      const child = trail?.querySelectorAll(".trail-node").length ?? 0;
      if (trail && branch && child >= 2) {
        document.documentElement.dataset.chatchatInvestigationTrailShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (sidePanelDone) document.documentElement.dataset.chatchatConsultationShowcase = "failed-investigation-trail";
    if (fullRoomDone) document.documentElement.dataset.chatchatRoomShowcase = "failed-investigation-trail";
    document.documentElement.dataset.chatchatInvestigationTrailShowcase = "failed";
  }

  new MutationObserver(trigger).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      "data-chatchat-consultation-showcase",
      "data-chatchat-room-showcase",
    ],
  });
  window.addEventListener("DOMContentLoaded", trigger, { once: true });
})();
