(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "zero-config") return;

  void verify();

  async function verify() {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const card = document.querySelector(".zero-touch-card");
      const button = card?.querySelector(".zero-touch-action button");
      const proposal = document.querySelector(".proposal-card");
      const text = card?.textContent ?? "";
      const teamVisible = /ChatGPT/.test(text) && /Claude/.test(text) && /Gemini/.test(text);
      const manualSelectors = [
        ".participants-card > .connect-all-button",
        ".participants-card > .participant-actions",
        ".participants-card > .url-opener",
        ".participants-card > .discovered-section",
        ".quick-open",
      ];
      const focusSelectors = [
        "#spectator-mode-root",
        ".participants-card",
        "#consultation-history-root",
        ".setup-card",
      ];
      const manualHidden = manualSelectors.every(isHiddenOrMissing);
      const firstRunNoiseHidden = focusSelectors.every(isHiddenOrMissing);
      const proposalIsWide = proposal instanceof HTMLElement
        && proposal.getBoundingClientRect().width >= window.innerWidth * 0.75;

      if (
        card &&
        button instanceof HTMLButtonElement &&
        !button.disabled &&
        teamVisible &&
        manualHidden &&
        firstRunNoiseHidden &&
        proposalIsWide
      ) {
        document.documentElement.dataset.chatchatZeroConfigShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatZeroConfigShowcase = "failed";
  }

  function isHiddenOrMissing(selector) {
    const element = document.querySelector(selector);
    return !element || getComputedStyle(element).display === "none";
  }
})();