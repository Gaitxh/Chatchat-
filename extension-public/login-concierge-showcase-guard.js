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
      const noteText = note?.textContent ?? "";
      const expectedAction = zh ? "去登录" : "Sign in";
      const hasResumePromise = zh
        ? noteText.includes("不用回来点重试") && noteText.includes("自动继续连接")
        : noteText.includes("No retry needed") && noteText.includes("continue automatically");

      if (
        row &&
        note &&
        action instanceof HTMLButtonElement &&
        action.textContent?.trim() === expectedAction &&
        hasResumePromise
      ) {
        document.documentElement.dataset.chatchatLoginConciergeShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatLoginConciergeShowcase = "failed";
  }
})();