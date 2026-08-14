(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const COMPLETE_ATTR = "data-chatchat-live-deliberation-showcase";
  const EXCHANGE_ATTR = "data-chatchat-peer-exchange-showcase";
  const SECRETARIAT_ATTR = "data-chatchat-meeting-secretariat-showcase";
  let sawFreshSignalAgenda = false;
  let sawOpenIssue = false;

  function inspect() {
    const stream = document.querySelector(".live-discussion-stream");
    if (!(stream instanceof HTMLElement)) return false;

    const agenda = document.querySelector('[data-phase-reason="fresh_signal_follow_up"]');
    const agendaTrigger = agenda?.querySelector("[data-agenda-trigger-event]");
    if (agenda && agendaTrigger) sawFreshSignalAgenda = true;

    const openIssues = document.querySelector(".open-issues-radar.has-open-issues");
    const openIssue = openIssues?.querySelector("[data-open-issue-event]");
    if (openIssues && openIssue) sawOpenIssue = true;

    const secretariatComplete = sawFreshSignalAgenda && sawOpenIssue;
    if (secretariatComplete) document.documentElement.setAttribute(SECRETARIAT_ATTR, "complete");

    const answeredExchange = document.querySelector('[data-peer-response-state="answered"][data-peer-response-event]');
    const queuedStage = answeredExchange?.querySelector('[data-peer-stage="queued"]');
    const targetTurnStage = answeredExchange?.querySelector('[data-peer-stage="responding"]');
    const answeredStage = answeredExchange?.querySelector('[data-peer-stage="answered"]');
    const peerLifecycleComplete = Boolean(answeredExchange && queuedStage && targetTurnStage && answeredStage);
    if (peerLifecycleComplete) document.documentElement.setAttribute(EXCHANGE_ATTR, "complete");

    const sealedRound = stream.querySelector(".discussion-round--sealed");
    const debateRound = stream.querySelector(".discussion-round--debate");
    const challenge = stream.querySelector('.discussion-entry[data-event-kind="challenge"]');
    const evidence = stream.querySelector('.discussion-entry[data-event-kind="evidence"]');
    const revision = stream.querySelector('.discussion-entry[data-event-kind="revision"]');
    const directReply = stream.querySelector("[data-reply-to-event]");
    const researchDesk = document.querySelector(".live-research-desk");
    const researchLane = researchDesk?.querySelector("[data-research-lane]");
    const researchEvidenceCount = researchDesk?.querySelector("[data-research-evidence-count]");
    const researchEvidence = researchDesk?.querySelector("[data-research-evidence-event]");
    const relationMap = document.querySelector(".relationship-map");
    const relationEdge = relationMap?.querySelector(".relationship-edge");
    const replyEdge = relationMap?.querySelector(".relationship-edge.edge-reply");
    const traceButton = stream.querySelector(".discussion-entry__footer > button");

    if (
      sealedRound
      && debateRound
      && challenge
      && evidence
      && revision
      && directReply
      && peerLifecycleComplete
      && secretariatComplete
      && researchDesk
      && researchLane
      && researchEvidenceCount
      && researchEvidence
      && relationMap
      && relationEdge
      && replyEdge
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
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
