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
        ".consultation-header",
        ".participants-card",
        "#consultation-history-root",
        ".setup-card",
      ];
      const manualHidden = manualSelectors.every(isVisuallyAbsent);
      const firstRunNoiseHidden = focusSelectors.every(isVisuallyAbsent);
      const proposalRect = proposal instanceof HTMLElement ? proposal.getBoundingClientRect() : null;
      const proposalIsWide = Boolean(proposalRect && proposalRect.width >= window.innerWidth * 0.75);
      const proposalIsHigh = Boolean(proposalRect && proposalRect.top <= window.innerHeight * 0.42);
      const buttonEnabled = button instanceof HTMLButtonElement && !button.disabled;
      recordStaticDiagnostics({
        card: Boolean(card),
        buttonEnabled,
        teamVisible,
        manualHidden,
        firstRunNoiseHidden,
        proposalIsWide,
        proposalIsHigh,
        proposalTop: Math.round(proposalRect?.top ?? -1),
        proposalWidth: Math.round(proposalRect?.width ?? -1),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });

      if (
        card &&
        buttonEnabled &&
        teamVisible &&
        manualHidden &&
        firstRunNoiseHidden &&
        proposalIsWide &&
        proposalIsHigh
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
        const fullRoomHeader = document.querySelector(".consultation-header");
        const onboardingGone = !document.documentElement.dataset.chatchatOnboarding
          && Boolean(onboardingRoot?.hidden);
        const draftPreserved = currentTextarea instanceof HTMLTextAreaElement
          && currentTextarea.value === expectedDraft;
        const consultationReady = startButton instanceof HTMLButtonElement && !startButton.disabled;
        const legacyGuideAbsent = !document.querySelector(".first-run-guide");
        const fullRoomHeaderVisible = fullRoomHeader instanceof HTMLElement
          && !isVisuallyAbsentElement(fullRoomHeader);

        if (
          onboardingGone &&
          readyRows.length >= 2 &&
          draftPreserved &&
          consultationReady &&
          legacyGuideAbsent &&
          fullRoomHeaderVisible
        ) {
          document.documentElement.dataset.chatchatZeroConfigAssembly = "complete";
          document.documentElement.dataset.chatchatZeroConfigDraftPreserved = "complete";
          document.documentElement.dataset.chatchatZeroConfigLegacyGuide = "suppressed";
          document.documentElement.dataset.chatchatZeroConfigFullRoomRestored = "complete";
          return;
        }
      }

      await delay(50);
    }

    document.documentElement.dataset.chatchatZeroConfigAssembly = "failed";
  }

  function recordStaticDiagnostics(values) {
    document.documentElement.dataset.chatchatZeroConfigDiagnostics = Object.entries(values)
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
  }

  function isVisuallyAbsent(selector) {
    const element = document.querySelector(selector);
    return !(element instanceof HTMLElement) || isVisuallyAbsentElement(element);
  }

  function isVisuallyAbsentElement(element) {
    if (element.hidden) return true;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return true;
    const rect = element.getBoundingClientRect();
    return rect.width <= 1 || rect.height <= 1;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();