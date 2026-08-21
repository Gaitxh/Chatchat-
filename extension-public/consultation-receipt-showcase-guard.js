(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;
  const focusedReceiptProof = params.get("receipt-proof") === "focus";
  let layoutChecks = 0;
  let layoutScheduled = false;
  let previousGeometry = null;

  function inspect() {
    const receipt = document.querySelector(".consultation-receipt");
    if (!receipt) return false;
    const receiptRoot = document.getElementById("consultation-receipt-root");
    const nextMoveRoot = document.getElementById("next-move-root");
    const app = document.querySelector(".consultation-app");
    if (!(receiptRoot instanceof HTMLElement) || !(nextMoveRoot instanceof HTMLElement) || !(app instanceof HTMLElement)) return false;
    if (receiptRoot.parentElement !== app || nextMoveRoot.parentElement !== app) return false;
    if (receiptRoot.closest("#chatchat-audit-vault") || nextMoveRoot.closest("#chatchat-audit-vault")) return false;

    const integrity = receipt.querySelector(
      '.receipt-integrity[data-receipt-execution-mode="synthetic-showcase"][data-receipt-execution-integrity="verified"]',
    );
    const preview = receipt.querySelector(".receipt-card-preview");
    const primary = receipt.querySelector(".receipt-primary");
    const svgButton = [...receipt.querySelectorAll("button")].find((button) => /SVG/i.test(button.textContent || ""));
    const obligations = receipt.querySelector('[data-response-obligations="present"]');
    const answered = obligations?.querySelector('[data-response-obligation-status="answered"]');
    const pending = obligations?.querySelector('[data-response-obligation-status="pending"]');
    const totalCount = Number(obligations?.getAttribute("data-response-obligations-total") || "0");
    const answeredCount = Number(obligations?.getAttribute("data-response-obligations-answered") || "0");
    const pendingCount = Number(obligations?.getAttribute("data-response-obligations-pending") || "0");
    const reportMatch = obligations?.getAttribute("data-response-obligations-report-match");
    if (!integrity || !preview || !primary || !svgButton || !obligations || !answered || !pending) return false;
    if (totalCount < 2 || answeredCount < 1 || pendingCount < 1 || reportMatch !== "true") return false;
    if (!answered.getAttribute("data-request-event-id") || !answered.getAttribute("data-response-event-id")) return false;
    if (!pending.getAttribute("data-request-event-id") || pending.hasAttribute("data-response-event-id")) return false;

    setMarker("chatchatResponseObligationStageParent", "complete");
    setMarker("chatchatResponseObligationsShowcase", "complete");
    setMarker("chatchatResponseObligationsAnswered", String(answeredCount));
    setMarker("chatchatResponseObligationsPending", String(pendingCount));
    setMarker("chatchatReceiptIntegrityShowcase", "complete");
    setMarker("chatchatConsultationReceiptShowcase", "complete");

    if (!focusedReceiptProof) return true;
    if (!finalLayoutReady()) return false;
    if (document.documentElement.dataset.chatchatResponseObligationLayoutReady === "complete") return true;
    scheduleLayoutCheck(obligations);
    return false;
  }

  function finalLayoutReady() {
    const dataset = document.documentElement.dataset;
    return dataset.chatchatLiveDeliberationShowcase === "complete"
      && dataset.chatchatFinalPositionFloorShowcase === "complete"
      && dataset.chatchatHistoryPersistenceShowcase === "complete"
      && dataset.chatchatRoomShowcase === "complete";
  }

  function scheduleLayoutCheck(element) {
    if (layoutScheduled || layoutChecks >= 6) return;
    layoutScheduled = true;
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        layoutScheduled = false;
        layoutChecks += 1;
        const geometry = geometryOf(element);
        if (previousGeometry && geometryStable(previousGeometry, geometry)) {
          setMarker("chatchatResponseObligationLayoutReady", "complete");
          return;
        }
        previousGeometry = geometry;
        if (layoutChecks < 6) scheduleLayoutCheck(element);
        else setMarker("chatchatResponseObligationLayoutReady", "failed");
      });
    }, 120);
  }

  function geometryOf(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
  }

  function geometryStable(a, b) {
    return Math.abs(a.top - b.top) <= 1
      && Math.abs(a.left - b.left) <= 1
      && Math.abs(a.width - b.width) <= 1
      && Math.abs(a.height - b.height) <= 1;
  }

  function setMarker(key, value) {
    if (document.documentElement.dataset[key] === value) return;
    document.documentElement.dataset[key] = value;
  }

  if (inspect()) return;
  const observer = new MutationObserver(() => {
    if (!inspect()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-chatchat-live-deliberation-showcase",
      "data-chatchat-final-position-floor-showcase",
      "data-chatchat-history-persistence-showcase",
      "data-chatchat-room-showcase",
    ],
  });
})();
