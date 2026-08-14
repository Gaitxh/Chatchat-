(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "real-provider-proof") return;

  void verify();

  async function verify() {
    const zh = params.get("lang") === "zh";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const proof = document.querySelector("#chatchat-real-provider-proof");
      const text = proof?.textContent ?? "";
      const providers = proof?.querySelectorAll(".real-proof-provider").length ?? 0;
      const verdict = proof?.getAttribute("data-gate-b-verdict");
      const expectedKicker = zh ? "真实 PROVIDER 验收" : "REAL PROVIDER PROOF";
      const expectedDemo = zh ? "仅演示" : "DEMO ONLY";
      const privacyOk = zh
        ? text.includes("不包含用户提案") && text.includes("Cookie") && text.includes("凭据")
        : text.includes("Excludes the user proposal") && text.includes("cookies") && text.includes("credentials");
      const noLegacy = !/ROYAL|御前验收|King'?s|Browser House|HOUSE VERDICT/i.test(text);

      if (
        proof &&
        getComputedStyle(proof).display !== "none" &&
        verdict === "demo-only" &&
        providers === 2 &&
        text.includes(expectedKicker) &&
        text.includes(expectedDemo) &&
        privacyOk &&
        noLegacy
      ) {
        document.documentElement.dataset.chatchatRealProviderProofShowcase = "complete";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    document.documentElement.dataset.chatchatRealProviderProofShowcase = "failed";
  }
})();
