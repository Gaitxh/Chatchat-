(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;
  function inspect() {
    const receipt = document.querySelector(".consultation-receipt");
    if (!receipt) return false;
    const integrity = receipt.querySelector(
      '.receipt-integrity[data-receipt-execution-mode="synthetic-showcase"][data-receipt-execution-integrity="verified"]',
    );
    const preview = receipt.querySelector(".receipt-card-preview");
    const primary = receipt.querySelector(".receipt-primary");
    const svgButton = [...receipt.querySelectorAll("button")].find((button) => /SVG/i.test(button.textContent || ""));
    if (!integrity || !preview || !primary || !svgButton) return false;
    document.documentElement.dataset.chatchatReceiptIntegrityShowcase = "complete";
    document.documentElement.dataset.chatchatConsultationReceiptShowcase = "complete";
    return true;
  }
  if (inspect()) return;
  const observer = new MutationObserver(() => {
    if (!inspect()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
})();
