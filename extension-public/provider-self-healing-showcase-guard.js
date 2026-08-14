(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "provider-self-healing") return;

  const requestedJourney = params.get("journey");
  const journey = requestedJourney === "static"
    || requestedJourney === "exhausted"
    || requestedJourney === "owned"
    ? requestedJourney
    : "resume";
  let sawHealing = false;
  let sawConnecting = false;

  void verify();

  async function verify() {
    const longJourney = journey === "resume" || journey === "exhausted";
    for (let attempt = 0; attempt < (longJourney ? 400 : 220); attempt += 1) {
      const row = document.querySelector(".participant-row");
      const note = row?.querySelector(".self-healing-note");
      const chip = row?.querySelector(".connection-chip");
      const text = note?.textContent ?? "";
      const rowText = row?.textContent ?? "";
      const zh = params.get("lang") === "zh";
      const healingCopy = zh
        ? text.includes("正在自动修复连接") && text.includes("你不需要操作")
        : text.includes("is self-healing") && text.includes("No action needed");
      const expectedHealingChip = zh ? "自动修复中" : "SELF-HEALING";
      const expectedFailedChip = zh ? "需要帮助" : "NEEDS HELP";
      const expectedFailedDetail = zh ? "自动识别没有完全成功" : "Automatic setup needs help";
      const failedCopyHidden = !rowText.includes(expectedFailedChip) && !rowText.includes(expectedFailedDetail);
      const healingStateVisible = Boolean(
        row?.classList.contains("connection-self-healing") &&
        row?.getAttribute("aria-busy") === "true" &&
        note &&
        healingCopy &&
        chip?.textContent?.trim() === expectedHealingChip &&
        chip?.getAttribute("data-chatchat-self-healing") === "true" &&
        failedCopyHidden
      );

      if (healingStateVisible) {
        sawHealing = true;
        document.documentElement.dataset.chatchatProviderSelfHealingVisible = "complete";
        if (journey === "static" && document.documentElement.dataset.chatchatSelfHealingNavigationCount === "1") {
          document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
          return;
        }
      }

      if ((journey === "resume" || journey === "exhausted") && sawHealing && row?.classList.contains("connection-connecting")) {
        sawConnecting = true;
        document.documentElement.dataset.chatchatProviderSelfHealingConnecting = "complete";
      }

      if (
        journey === "resume" &&
        sawHealing &&
        sawConnecting &&
        row?.classList.contains("connection-ready") &&
        row.classList.contains("is-ready") &&
        !row.classList.contains("connection-self-healing") &&
        row.getAttribute("aria-busy") !== "true" &&
        !document.querySelector(".self-healing-note") &&
        !document.querySelector('[data-chatchat-self-healing="true"]') &&
        document.documentElement.dataset.chatchatSelfHealingNavigationCount === "1"
      ) {
        const store = window.chrome?.storage?.local;
        const recipeState = await store?.get("chatchat.extension.recipes.v1");
        const recipes = recipeState?.["chatchat.extension.recipes.v1"];
        if (recipes?.["https://claude.ai"]?.sendSelector) {
          document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
          return;
        }
      }

      if (
        journey === "exhausted" &&
        sawHealing &&
        sawConnecting &&
        row?.classList.contains("connection-failed") &&
        !row.classList.contains("connection-self-healing") &&
        row.getAttribute("aria-busy") !== "true" &&
        !document.querySelector(".self-healing-note") &&
        !document.querySelector('[data-chatchat-self-healing="true"]') &&
        chip?.textContent?.trim() === expectedFailedChip &&
        rowText.includes(expectedFailedDetail) &&
        document.documentElement.dataset.chatchatSelfHealingNavigationCount === "1"
      ) {
        const store = window.chrome?.storage?.session ?? window.chrome?.storage?.local;
        const recoveryState = await store?.get("chatchat.provider-self-healing.v1");
        const records = recoveryState?.["chatchat.provider-self-healing.v1"];
        const record = records?.["extension:anthropic-claude:801"];
        if (record?.phase === "exhausted") {
          document.documentElement.dataset.chatchatProviderSelfHealingExhausted = "complete";
          document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
          return;
        }
      }

      if (
        journey === "owned" &&
        row?.classList.contains("connection-failed") &&
        !row.classList.contains("connection-self-healing") &&
        !document.querySelector(".self-healing-note") &&
        chip?.textContent?.trim() === expectedFailedChip &&
        document.documentElement.dataset.chatchatSelfHealingNavigationCount === "0"
      ) {
        const store = window.chrome?.storage?.session ?? window.chrome?.storage?.local;
        const recoveryState = await store?.get("chatchat.provider-self-healing.v1");
        const records = recoveryState?.["chatchat.provider-self-healing.v1"];
        if (!records || !records["extension:anthropic-claude:801"]) {
          document.documentElement.dataset.chatchatProviderSelfHealingOwnedTabSafe = "complete";
          document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "failed";
    document.documentElement.dataset.chatchatProviderSelfHealingDebug = [
      journey,
      sawHealing ? "healing" : "no-healing",
      sawConnecting ? "connecting" : "no-connecting",
      document.querySelector(".participant-row")?.className ?? "no-row",
      `nav=${document.documentElement.dataset.chatchatSelfHealingNavigationCount ?? "0"}`,
    ].join(":");
  }
})();
