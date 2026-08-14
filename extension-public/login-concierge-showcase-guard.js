(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-concierge") return;

  void verify();

  async function verify() {
    const zh = params.get("lang") === "zh";
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const row = document.querySelector(".participant-row.connection-needs-login");
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

      if (
        row &&
        note &&
        action instanceof HTMLButtonElement &&
        action.textContent?.trim() === expectedAction &&
        noteText.includes(expectedHeading) &&
        hasResumePromise &&
        recoveryFocused
      ) {
        document.documentElement.dataset.chatchatLoginConciergeShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatLoginConciergeShowcase = "failed";
  }

  function isHiddenOrMissing(element) {
    return !element || getComputedStyle(element).display === "none";
  }
})();