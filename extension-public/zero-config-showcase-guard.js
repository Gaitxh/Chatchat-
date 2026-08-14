(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "zero-config") return;

  if (params.get("journey") === "assemble") void verifyAssemblyJourney();
  else void verifyStaticLobby();

  async function verifyStaticLobby() {
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
      await delay(50);
    }

    document.documentElement.dataset.chatchatZeroConfigShowcase = "failed";
  }

  async function verifyAssemblyJourney() {
    const expectedDraft = document.documentElement.dataset.chatchatZeroConfigJourneyDraft ?? "";
    let started = false;

    for (let attempt = 0; attempt < 360; attempt += 1) {
      const card = document.querySelector(".zero-touch-card");
      const button = card?.querySelector(".zero-touch-action button");
      const textarea = document.querySelector(".proposal-card textarea");

      if (!started && button instanceof HTMLButtonElement && !button.disabled && textarea instanceof HTMLTextAreaElement) {
        if (textarea.value !== expectedDraft) {
          await delay(50);
          continue;
        }
        started = true;
        document.documentElement.dataset.chatchatZeroConfigAssembly = "running";
        button.click();
      }

      if (started) {
        const onboardingRoot = document.getElementById("web-onboarding-root");
        const readyRows = [...document.querySelectorAll(".participant-row.connection-ready.is-ready")];
        const currentTextarea = document.querySelector(".proposal-card textarea");
        const startButton = document.querySelector(".start-button");
        const onboardingGone = !document.documentElement.dataset.chatchatOnboarding
          && Boolean(onboardingRoot?.hidden);
        const draftPreserved = currentTextarea instanceof HTMLTextAreaElement
          && currentTextarea.value === expectedDraft;
        const consultationReady = startButton instanceof HTMLButtonElement && !startButton.disabled;
        const legacyGuideAbsent = !document.querySelector(".first-run-guide");

        if (onboardingGone && readyRows.length >= 2 && draftPreserved && consultationReady && legacyGuideAbsent) {
          document.documentElement.dataset.chatchatZeroConfigAssembly = "complete";
          document.documentElement.dataset.chatchatZeroConfigDraftPreserved = "complete";
          document.documentElement.dataset.chatchatZeroConfigLegacyGuide = "suppressed";
          return;
        }
      }

      await delay(50);
    }

    document.documentElement.dataset.chatchatZeroConfigAssembly = "failed";
  }

  function isHiddenOrMissing(selector) {
    const element = document.querySelector(selector);
    return !element || getComputedStyle(element).display === "none";
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();