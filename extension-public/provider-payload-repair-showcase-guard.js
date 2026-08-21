(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("payload-proof") !== "repair") return;

  function inspect() {
    const payload = document.querySelector('[data-provider-payload-integrity="verified"]');
    if (!payload) return false;
    if (numberAttr(payload, "data-provider-payload-unverified-turns") !== 0) return false;
    if (numberAttr(payload, "data-provider-payload-repair-payload-drift") !== 0) return false;
    if (numberAttr(payload, "data-provider-payload-repair-selection-drift") !== 0) return false;

    const r2 = payload.querySelector('[data-provider-payload-round="2"][data-provider-payload-phase="debate"]');
    if (!r2) return false;
    const seatCount = numberAttr(r2, "data-provider-payload-seat-count");
    const fingerprinted = numberAttr(r2, "data-provider-payload-fingerprinted-seats");
    const unverified = numberAttr(r2, "data-provider-payload-unverified-seats");
    const receiptCount = numberAttr(r2, "data-provider-payload-receipt-count");
    const repairUsed = numberAttr(r2, "data-provider-repair-used-seats");
    const repairMatched = numberAttr(r2, "data-provider-repair-matched-seats");
    const repairDrift = numberAttr(r2, "data-provider-repair-drift-seats");
    const repairPayloadDrift = numberAttr(r2, "data-provider-repair-payload-drift-seats");
    const repairSelectionDrift = numberAttr(r2, "data-provider-repair-selection-drift-seats");
    const repairUnverified = numberAttr(r2, "data-provider-repair-unverified-seats");
    if (!(seatCount > 0 && fingerprinted === seatCount && unverified === 0 && receiptCount === 1)) return false;
    if (r2.getAttribute("data-provider-payload-consistent") !== "true") return false;
    if (!(
      repairUsed === 1
      && repairMatched === 1
      && repairDrift === 0
      && repairPayloadDrift === 0
      && repairSelectionDrift === 0
      && repairUnverified === 0
    )) return false;

    const attendance = document.querySelector('[data-provider-attendance-audit="active"]');
    const repairedTurn = attendance?.querySelector('[data-attendance-turn-state="repaired"][data-attendance-round="2"]');
    if (!repairedTurn) return false;

    document.documentElement.dataset.chatchatProviderPayloadRepairShowcase = "complete";
    return true;
  }

  function start() {
    if (inspect()) return;
    const observer = new MutationObserver(() => {
      if (!inspect()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  function numberAttr(node, name) {
    const value = Number(node.getAttribute(name) ?? "NaN");
    return Number.isFinite(value) ? value : -1;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
