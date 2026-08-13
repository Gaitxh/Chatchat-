(() => {
  if (document.documentElement.dataset.surface !== "web-app") return;
  if (new URLSearchParams(location.search).get("showcase") !== "consultation") return;

  async function waitForRoom() {
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const outcome = document.querySelector(".outcome-card");
      const theater = document.querySelector(".consultation-theater");
      const history = document.querySelector(".history-entry");
      const evidence = document.querySelector(".evidence-ledger") || document.getElementById("evidence-root");
      const spectator = document.querySelector("#spectator-mode-root .spectator-buttons");
      const spectatorMode = document.documentElement.dataset.spectatorMode;
      if (outcome && theater && history && evidence && spectator && spectatorMode === "live") {
        document.documentElement.dataset.chatchatRoomShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    document.documentElement.dataset.chatchatRoomShowcase = "failed";
  }

  window.addEventListener("DOMContentLoaded", () => void waitForRoom(), { once: true });
})();
