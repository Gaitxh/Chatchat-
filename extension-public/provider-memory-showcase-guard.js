(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("memory-proof") !== "coverage") return;

  function inspect() {
    const coverage = document.querySelector('[data-provider-memory-coverage="audited"]');
    if (!coverage) return false;
    if (coverage.getAttribute("data-provider-memory-consistent") !== "true") return false;

    const r3 = coverage.querySelector('[data-provider-memory-round="3"][data-provider-memory-phase="debate"]');
    const r4 = coverage.querySelector('[data-provider-memory-round="4"]');
    if (!r3 || !r4) return false;

    const r3Snapshot = numberAttr(r3, "data-provider-memory-snapshot-count");
    const r3Available = numberAttr(r3, "data-provider-memory-available-count");
    const r3Pinned = numberAttr(r3, "data-provider-memory-pinned-count");
    const r3PinnedSources = numberAttr(r3, "data-provider-memory-pinned-source-count");
    const r3Omitted = numberAttr(r3, "data-provider-memory-omitted-count");
    const r3PromptSeats = numberAttr(r3, "data-provider-memory-actual-prompt-seats");
    const r3Seats = numberAttr(r3, "data-provider-memory-seat-count");
    if (!(r3Snapshot === 12 && r3Available > 12 && r3Pinned > 0 && r3PinnedSources > 0 && r3Omitted > 0)) return false;
    if (!(r3Seats > 0 && r3PromptSeats === r3Seats && r3.getAttribute("data-provider-memory-shared") === "true")) return false;

    const pinned = r3.querySelector(
      '[data-provider-memory-pinned-source][data-provider-memory-resolver-event][data-provider-memory-resolved-round="3"]',
    );
    if (!pinned) return false;
    const sourceEventId = pinned.getAttribute("data-provider-memory-pinned-source");
    const resolverEventId = pinned.getAttribute("data-provider-memory-resolver-event");
    if (!sourceEventId || !resolverEventId || sourceEventId === resolverEventId) return false;

    const r4Available = numberAttr(r4, "data-provider-memory-available-count");
    const r4Snapshot = numberAttr(r4, "data-provider-memory-snapshot-count");
    const r4Omitted = numberAttr(r4, "data-provider-memory-omitted-count");
    const r4PromptSeats = numberAttr(r4, "data-provider-memory-actual-prompt-seats");
    const r4Seats = numberAttr(r4, "data-provider-memory-seat-count");
    if (!(r4Available > 12 && r4Snapshot === 12 && r4Omitted > 0)) return false;
    if (!(r4Seats > 0 && r4PromptSeats === r4Seats && r4.getAttribute("data-provider-memory-shared") === "true")) return false;

    const sameSourceStillPinned = [...r4.querySelectorAll("[data-provider-memory-pinned-source]")]
      .some((item) => item.getAttribute("data-provider-memory-pinned-source") === sourceEventId);
    if (sameSourceStillPinned) return false;

    document.documentElement.dataset.chatchatProviderMemoryShowcase = "complete";
    document.documentElement.dataset.chatchatProviderMemoryPinnedSource = sourceEventId;
    document.documentElement.dataset.chatchatProviderMemoryResolverEvent = resolverEventId;
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
