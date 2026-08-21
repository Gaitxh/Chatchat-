(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("fairness-proof") !== "overfull") return;

  function inspect() {
    const fairness = document.querySelector('[data-provider-memory-fairness="verified"][data-provider-memory-fairness-view="live"]');
    const memory = document.querySelector('[data-provider-memory-coverage="audited"]');
    if (!fairness || !memory) return false;
    if (memory.getAttribute("data-provider-memory-evidence") !== "actual_prompt") return false;
    if (memory.getAttribute("data-provider-memory-consistent") !== "true") return false;
    if (memory.getAttribute("data-provider-memory-selector-consistent") !== "true") return false;
    if (numberAttr(fairness, "data-memory-fairness-metadata-mismatch-turns") !== 0) return false;

    const fairnessRound = fairness.querySelector('[data-memory-fairness-round="3"][data-memory-fairness-phase="debate"]');
    const memoryRound = memory.querySelector('[data-provider-memory-round="3"][data-provider-memory-phase="debate"]');
    if (!fairnessRound || !memoryRound) return false;

    const actorTotal = numberAttr(fairnessRound, "data-memory-fairness-actor-total");
    const actorRepresented = numberAttr(fairnessRound, "data-memory-fairness-actor-represented");
    const actorOmitted = numberAttr(fairnessRound, "data-memory-fairness-actor-omitted");
    const actualSeats = numberAttr(fairnessRound, "data-memory-fairness-actual-prompt-seats");
    const seatCount = numberAttr(fairnessRound, "data-memory-fairness-seat-count");
    if (!(actorTotal === 3 && actorRepresented === 3 && actorOmitted === 0)) return false;
    if (!(seatCount === 3 && actualSeats === 3)) return false;
    if (fairnessRound.getAttribute("data-memory-fairness-payload-consistent") !== "true") return false;
    if (numberAttr(fairnessRound, "data-memory-fairness-metadata-mismatch-seats") !== 0) return false;
    if (numberAttr(fairnessRound, "data-memory-fairness-selector-actor-mismatch-seats") !== 0) return false;
    if (numberAttr(fairnessRound, "data-memory-fairness-repair-mismatch-seats") !== 0) return false;

    const snapshot = numberAttr(memoryRound, "data-provider-memory-snapshot-count");
    const latest = numberAttr(memoryRound, "data-provider-memory-latest-count");
    const promptSeats = numberAttr(memoryRound, "data-provider-memory-actual-prompt-seats");
    const memorySeats = numberAttr(memoryRound, "data-provider-memory-seat-count");
    if (!(snapshot === 12 && latest === 12 && promptSeats === memorySeats && memorySeats === 3)) return false;
    if (memoryRound.getAttribute("data-provider-memory-shared") !== "true") return false;

    document.documentElement.dataset.chatchatProviderMemoryFairnessShowcase = "complete";
    document.documentElement.dataset.chatchatProviderMemoryFairnessActors = `${actorRepresented}/${actorTotal}`;
    document.documentElement.dataset.chatchatProviderMemoryFairnessLatestEvents = String(latest);
    document.documentElement.dataset.chatchatProviderMemoryFairnessMetadataParity = "complete";
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
