(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "provider-self-healing") return;

  const requestedJourney = params.get("journey");
  const journey = ["static", "resume", "exhausted", "owned"].includes(requestedJourney)
    ? requestedJourney
    : "resume";
  const zh = params.get("lang") === "zh";
  const seatId = "extension:anthropic-claude:801";
  let sawHealing = false;
  let sawConnecting = false;

  void verify();

  async function verify() {
    for (let attempt = 0; attempt < 420; attempt += 1) {
      const row = [...document.querySelectorAll(".participant-row")]
        .find((candidate) => candidate.dataset.seatId === seatId);
      const note = row?.querySelector(".provider-self-healing-note");
      const noteText = note?.textContent ?? "";
      const navigationCount = document.documentElement.dataset.chatchatSelfHealingNavigationCount ?? "0";
      const claimCount = document.documentElement.dataset.chatchatSelfHealingClaimCount ?? "0";
      const healingCopy = zh
        ? noteText.includes("正在自动修复连接") && noteText.includes("你不需要操作")
        : noteText.includes("Self-healing connection") && noteText.includes("No action needed");
      const healingVisible = Boolean(
        row?.classList.contains("connection-self-healing")
        && row?.getAttribute("aria-busy") === "true"
        && note
        && healingCopy,
      );

      if (healingVisible) {
        sawHealing = true;
        document.documentElement.dataset.chatchatProviderSelfHealingVisible = "complete";
      }
      if (sawHealing && row?.classList.contains("connection-connecting")) {
        sawConnecting = true;
        document.documentElement.dataset.chatchatProviderSelfHealingConnecting = "observed";
      }

      if (journey === "static" && sawHealing && navigationCount === "1" && claimCount === "1") {
        document.documentElement.dataset.chatchatProviderSelfHealingStatic = "complete";
        document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
        return;
      }

      if (
        journey === "resume"
        && sawHealing
        && row?.classList.contains("connection-ready")
        && row.classList.contains("is-ready")
        && !row.classList.contains("connection-self-healing")
        && !row.querySelector(".provider-self-healing-note")
        && navigationCount === "1"
        && claimCount === "1"
      ) {
        document.documentElement.dataset.chatchatProviderSelfHealingResume = "complete";
        document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
        return;
      }

      if (
        journey === "exhausted"
        && sawHealing
        && row?.classList.contains("connection-failed")
        && !row.classList.contains("connection-self-healing")
        && !row.querySelector(".provider-self-healing-note")
        && navigationCount === "1"
        && claimCount === "1"
      ) {
        document.documentElement.dataset.chatchatProviderSelfHealingExhausted = "complete";
        document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
        return;
      }

      if (
        journey === "owned"
        && attempt >= 20
        && row?.classList.contains("connection-failed")
        && !row.classList.contains("connection-self-healing")
        && !row.querySelector(".provider-self-healing-note")
        && navigationCount === "0"
        && claimCount === "0"
      ) {
        document.documentElement.dataset.chatchatProviderSelfHealingOwnedTabSafe = "complete";
        document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "complete";
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatProviderSelfHealingShowcase = "failed";
    document.documentElement.dataset.chatchatProviderSelfHealingDebug = [
      journey,
      sawHealing ? "healing" : "no-healing",
      sawConnecting ? "connecting-observed" : "connecting-too-fast-or-unobserved",
      document.querySelector(".participant-row")?.className ?? "no-row",
      `nav=${document.documentElement.dataset.chatchatSelfHealingNavigationCount ?? "0"}`,
      `claims=${document.documentElement.dataset.chatchatSelfHealingClaimCount ?? "0"}`,
    ].join(":");
  }
})();
