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
      const invite = document.querySelector('.participants-card > .url-opener[data-chatchat-invite-ai="true"]');
      const text = card?.textContent ?? "";
      const teamVisible = /ChatGPT/.test(text) && /Claude/.test(text) && /Gemini/.test(text);
      const buttonEnabled = button instanceof HTMLButtonElement && !button.disabled;
      const inviteVisible = invite instanceof HTMLElement && !isVisuallyAbsentElement(invite);
      const proposalVisible = proposal instanceof HTMLElement && !isVisuallyAbsentElement(proposal);
      const noParticipants = document.querySelectorAll(".participant-row").length === 0;
      const layout = proposal instanceof HTMLElement ? proposal.getBoundingClientRect() : null;
      recordStaticDiagnostics({
        card: Boolean(card), buttonEnabled, teamVisible, inviteVisible,
        proposalVisible, noParticipants,
        proposalTop: Math.round(layout?.top ?? -1), proposalWidth: Math.round(layout?.width ?? -1),
      });

      // Current product entry is user choice first: Invite AI must be visible,
      // and a suggested starter team must remain strictly opt-in. Do NOT hide
      // the user's manual choices just to satisfy a legacy fullscreen proof.
      if (card && buttonEnabled && teamVisible && inviteVisible
        && proposalVisible && noParticipants) {
        const providerTabs = await window.chrome.tabs.query({});
        if (providerTabs.length !== 0) throw new Error(
          "Zero-config showcase contacted or created Provider tabs before consent."
        );
        document.documentElement.dataset.chatchatZeroConfigManualInvite = "visible";
        document.documentElement.dataset.chatchatZeroConfigNoAutoCreate = "complete";
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
    let teamControlsVerified = false;

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
          if (!teamControlsVerified) teamControlsVerified = await verifyTeamControls();
          if (!teamControlsVerified) {
            await delay(50);
            continue;
          }

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

  async function verifyTeamControls() {
    const disclosure = document.querySelector(".team-settings-disclosure");
    const invite = document.querySelector('.participants-card > .url-opener[data-chatchat-invite-ai="true"]');
    if (!(disclosure instanceof HTMLDetailsElement) || !(invite instanceof HTMLElement)) return false;

    // Inviting a new thinker is now a normal round-table action. It must become
    // available as soon as the starter room has assembled, while actual repair /
    // team-management plumbing remains behind the explicit disclosure.
    const advancedSelectors = [
      ".participants-card > .participant-actions",
      ".participant-row-actions button:nth-child(2)",
    ];
    const inviteVisibleByDefault = !isVisuallyAbsentElement(invite);
    const advancedHiddenByDefault = advancedSelectors.every(isVisuallyAbsent);
    if (!inviteVisibleByDefault || !advancedHiddenByDefault || disclosure.open || document.documentElement.dataset.chatchatTeamEdit) {
      return false;
    }
    document.documentElement.dataset.chatchatInviteAiAfterAssembly = "visible";
    document.documentElement.dataset.chatchatTeamControlsDefault = "hidden";

    disclosure.open = true;
    await delay(100);
    const advancedVisibleOnDemand = advancedSelectors.every(isVisuallyPresent);
    const inviteStillVisible = !isVisuallyAbsentElement(invite);
    if (!advancedVisibleOnDemand || !inviteStillVisible || document.documentElement.dataset.chatchatTeamEdit !== "open") {
      disclosure.open = false;
      return false;
    }
    document.documentElement.dataset.chatchatTeamControlsReveal = "complete";

    disclosure.open = false;
    await delay(100);
    const advancedHiddenAgain = advancedSelectors.every(isVisuallyAbsent)
      && !document.documentElement.dataset.chatchatTeamEdit;
    const inviteRestored = !isVisuallyAbsentElement(invite);
    if (!advancedHiddenAgain || !inviteRestored) return false;
    document.documentElement.dataset.chatchatTeamControlsRestore = "complete";
    return true;
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

  function isVisuallyPresent(selector) {
    const element = document.querySelector(selector);
    return element instanceof HTMLElement && !isVisuallyAbsentElement(element);
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
