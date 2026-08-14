(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "room-keeper") return;

  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  void verify();

  async function verify() {
    const zh = params.get("lang") === "zh";
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const card = document.querySelector(".room-keeper-card");
      const button = card?.querySelector(".zero-touch-action button");
      const cardText = card?.textContent ?? "";
      const storage = await window.chrome?.storage?.session?.get(PARTICIPANTS_KEY);
      const participants = storage?.[PARTICIPANTS_KEY];
      const stalePruned = Array.isArray(participants)
        && participants.length === 1
        && participants[0]?.providerId === "openai-chatgpt";
      const recoveryCopy = zh
        ? cardText.includes("会议室管家") && cardText.includes("保留 1 位仍在线的参与者")
        : cardText.includes("ROOM KEEPER") && cardText.includes("1 live participant preserved");
      const buttonReady = button instanceof HTMLButtonElement
        && !button.disabled
        && button.textContent?.includes(zh ? "自动恢复会议室" : "Restore the room");
      const noiseHidden = isHiddenOrMissing(document.querySelector("#spectator-mode-root"))
        && isHiddenOrMissing(document.querySelector("#consultation-history-root"))
        && isHiddenOrMissing(document.querySelector(".setup-card"));

      if (
        document.documentElement.dataset.chatchatOnboarding === "room-recovery"
        && card
        && stalePruned
        && recoveryCopy
        && buttonReady
        && noiseHidden
      ) {
        document.documentElement.dataset.chatchatRoomKeeperShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatRoomKeeperShowcase = "failed";
  }

  function isHiddenOrMissing(element) {
    return !element || getComputedStyle(element).display === "none";
  }
})();