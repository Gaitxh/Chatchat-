(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const COMPLETE_ATTR = "data-chatchat-live-deliberation-showcase";

  function inspect() {
    const stream = document.querySelector(".live-discussion-stream");
    if (!(stream instanceof HTMLElement)) return false;

    const sealedRound = stream.querySelector(".discussion-round--sealed");
    const debateRound = stream.querySelector(".discussion-round--debate");
    const challenge = stream.querySelector('.discussion-entry[data-event-kind="challenge"]');
    const evidence = stream.querySelector('.discussion-entry[data-event-kind="evidence"]');
    const revision = stream.querySelector('.discussion-entry[data-event-kind="revision"]');
    const relationMap = document.querySelector(".relationship-map");
    const relationEdge = relationMap?.querySelector(".relationship-edge");
    const traceButton = stream.querySelector(".discussion-entry__footer > button");

    if (
      sealedRound
      && debateRound
      && challenge
      && evidence
      && revision
      && relationMap
      && relationEdge
      && traceButton
    ) {
      document.documentElement.setAttribute(COMPLETE_ATTR, "complete");
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
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
