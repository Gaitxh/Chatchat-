(() => {
  if (document.documentElement.dataset.surface !== "web-app") return;
  if (new URLSearchParams(location.search).get("showcase") !== "consultation") return;

  async function waitForRoom() {
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const outcome = document.querySelector(".outcome-card");
      const integrity = document.querySelector(
        '.meeting-integrity-card[data-meeting-integrity-mode="synthetic-showcase"][data-meeting-integrity-state="verified"]',
      );
      const theater = document.querySelector(".consultation-theater");
      const history = document.querySelector(".history-entry");
      const evidence = document.querySelector(".evidence-card");
      const sourceObservation = document.querySelector(".source-observation-board");
      const spectator = document.querySelector("#spectator-mode-root .spectator-buttons");
      const spectatorMode = document.documentElement.dataset.spectatorMode;
      if (outcome && integrity && theater && history && evidence && sourceObservation && spectator && spectatorMode === "live") {
        document.documentElement.dataset.chatchatMeetingIntegrityShowcase = "complete";
        document.documentElement.dataset.chatchatRoomShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    document.documentElement.dataset.chatchatMeetingIntegrityShowcase = "failed";
    document.documentElement.dataset.chatchatRoomShowcase = "failed";
  }

  window.addEventListener("DOMContentLoaded", () => void waitForRoom(), { once: true });
})();
