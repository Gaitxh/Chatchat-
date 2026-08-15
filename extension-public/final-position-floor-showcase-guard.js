(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const ATTR = "data-chatchat-final-position-floor-showcase";

  function inspect() {
    const floor = document.querySelector('[data-final-position-floor="explicit-final-submissions"]');
    if (!floor) return false;
    const synthetic = floor.querySelector('[data-final-position-synthetic="true"]');
    const leading = floor.querySelector('[data-final-position-group-leading="true"]');
    const other = floor.querySelector('[data-final-position-group-leading="false"]');
    const verifiedSeat = floor.querySelector('[data-final-seat-source="provider_final"][data-final-seat-execution="verified"], [data-final-seat-source="provider_final"][data-final-seat-execution="repaired"]');
    const changedSeat = floor.querySelector('[data-final-seat-source="provider_final"][data-final-seat-changed="true"]');
    const lineage = changedSeat?.querySelector('[data-final-seat-lineage="explicit-revision"]');
    const revision = lineage?.querySelector('[data-final-seat-revision-event]');
    const traceableFinal = floor.querySelector('[data-final-seat-event], [data-final-seat-shift-warning="unexplained"]');
    const alignmentMatches = floor.getAttribute("data-final-position-alignment-match") === "true";
    if (synthetic && leading && other && verifiedSeat && changedSeat && lineage && revision && traceableFinal && alignmentMatches) {
      document.documentElement.setAttribute(ATTR, "complete");
      return true;
    }
    return false;
  }

  function start() {
    if (inspect()) return;
    const observer = new MutationObserver(() => {
      if (!inspect()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
