(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-concierge") return;

  const journey = params.get("journey") === "resume" ? "resume" : "static";
  let sawPrompt = false;
  let sawConnectingAfterPrompt = false;

  void verify();

  async function verify() {
    const zh = params.get("lang") === "zh";
    for (let attempt = 0; attempt < (journey === "resume" ? 360 : 180); attempt += 1) {
      const row = document.querySelector(".participant-row");
      const note = row?.querySelector(".login-concierge-note");
      const action = row?.querySelector(".participant-row-actions button:first-child");
      const setup = document.querySelector(".setup-card");
      const history = document.querySelector("#consultation-history-root");
      const spectator = document.querySelector("#spectator-mode-root");
      const noteText = note?.textContent ?? "";
      const expectedAction = zh ? "去登录" : "Sign in";
      const expectedHeading = zh ? "去 Claude 完成登录" : "Sign in to Claude";
      const hasResumePromise = zh
        ? noteText.includes("不用回来点重试") && noteText.includes("自动继续连接")
        : noteText.includes("No retry needed") && noteText.includes("continue automatically");
      const recoveryFocused = document.documentElement.dataset.chatchatLoginPending === "true"
        && isHiddenOrMissing(setup)
        && isHiddenOrMissing(history)
        && isHiddenOrMissing(spectator);

      const loginPromptVisible = Boolean(
        row?.classList.contains("connection-needs-login") &&
        note &&
        action instanceof HTMLButtonElement &&
        action.textContent?.trim() === expectedAction &&
        noteText.includes(expectedHeading) &&
        hasResumePromise &&
        recoveryFocused
      );

      if (loginPromptVisible) {
        sawPrompt = true;
        document.documentElement.dataset.chatchatLoginConciergeShowcase = "complete";
        document.documentElement.dataset.chatchatLoginJourneyPrompt = "complete";
        if (journey === "static") return;
      }

      if (journey === "resume" && sawPrompt && row?.classList.contains("connection-connecting")) {
        sawConnectingAfterPrompt = true;
        document.documentElement.dataset.chatchatLoginJourneyConnecting = "complete";
      }

      if (
        journey === "resume" &&
        sawPrompt &&
        sawConnectingAfterPrompt &&
        row?.classList.contains("connection-ready") &&
        !row.classList.contains("connection-needs-login") &&
        !document.querySelector(".login-concierge-note") &&
        document.documentElement.dataset.chatchatLoginPending !== "true"
      ) {
        document.documentElement.dataset.chatchatLoginResumeShowcase = "complete";
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (journey === "resume") {
      document.documentElement.dataset.chatchatLoginResumeShowcase = "failed";
      document.documentElement.dataset.chatchatLoginJourneyDebug = [
        sawPrompt ? "prompt" : "no-prompt",
        sawConnectingAfterPrompt ? "connecting" : "no-connecting",
        document.querySelector(".participant-row")?.className ?? "no-row",
      ].join(":");
      return;
    }
    document.documentElement.dataset.chatchatLoginConciergeShowcase = "failed";
  }

  function isHiddenOrMissing(element) {
    return !element || getComputedStyle(element).display === "none";
  }
})();
