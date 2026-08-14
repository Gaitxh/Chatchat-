(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "zero-config") return;

  void verify();

  async function verify() {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const card = document.querySelector(".zero-touch-card");
      const button = card?.querySelector(".zero-touch-action button");
      const text = card?.textContent ?? "";
      const teamVisible = /ChatGPT/.test(text) && /Claude/.test(text) && /Gemini/.test(text);
      const manualSelectors = [
        ".participants-card > .connect-all-button",
        ".participants-card > .participant-actions",
        ".participants-card > .url-opener",
        ".participants-card > .discovered-section",
        ".quick-open",
      ];
      const manualHidden = manualSelectors.every((selector) => {
        const element = document.querySelector(selector);
        return !element || getComputedStyle(element).display === "none";
      });

      if (
        card &&
        button instanceof HTMLButtonElement &&
        !button.disabled &&
        teamVisible &&
        manualHidden
      ) {
        document.documentElement.dataset.chatchatZeroConfigShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatZeroConfigShowcase = "failed";
  }
})();