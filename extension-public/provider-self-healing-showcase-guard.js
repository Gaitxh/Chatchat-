(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "provider-self-healing") return;

  const journey = params.get("journey") === "static" ? "static" : "resume";
  let sawHealing = false;
  let sawConnecting = false;

  void verify();

  async function verify() {
    for (let attempt = 0; attempt < (journey === "resume" ? 360 : 200); attempt += 1) {
      const row = document.querySelector(".participant-row");
      const note = row?.querySelector(".self-healing-note");
      const text = note?.textContent ?? "";
      const zh = params.get("lang") === "zh";
      const healingCopy = zh
        ? text.includes("正在自动修复连接") && text.includes("你不需要操作")
        : text.includes("is self-healing") && text.includes("No action needed");

      if (row?.classList.contains("connection-self-healing") && note && healingCopy) {
        sawHealing = true;
        document.documentElement.dataset.chatchatProviderSelfHealingVisible = "complete";
        if (journey === "static" && document.documentElement.dataset.chatchatSelfHealingNavigationCount === "1") {
          document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
          return;
        }
      }

      if (journey === "resume" && sawHealing && row?.classList.contains("connection-connecting")) {
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
        !document.querySelector(".self-healing-note") &&
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

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "failed";
    document.documentElement.dataset.chatchatProviderSelfHealingDebug = [
      sawHealing ? "healing" : "no-healing",
      sawConnecting ? "connecting" : "no-connecting",
      document.querySelector(".participant-row")?.className ?? "no-row",
      `nav=${document.documentElement.dataset.chatchatSelfHealingNavigationCount ?? "0"}`,
    ].join(":");
  }
})();
