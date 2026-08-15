(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const COMPLETE_ATTR = "data-chatchat-live-deliberation-showcase";
  const EXCHANGE_ATTR = "data-chatchat-peer-exchange-showcase";
  const PERSUASION_ATTR = "data-chatchat-live-persuasion-showcase";
  const AGENDA_ATTR = "data-chatchat-agenda-showcase";
  const OPEN_ISSUES_ATTR = "data-chatchat-open-issues-showcase";
  const SECRETARIAT_ATTR = "data-chatchat-meeting-secretariat-showcase";
  const EXECUTION_BOUNDARY_ATTR = "data-chatchat-execution-boundary-showcase";
  const ATTENDANCE_ATTR = "data-chatchat-provider-attendance-showcase";
  const CONFLICT_ATTR = "data-chatchat-conflict-board-showcase";
  const CONFLICT_RESOLUTION_ATTR = "data-chatchat-conflict-resolution-showcase";
  const STANCE_FRONTS_ATTR = "data-chatchat-stance-fronts-showcase";
  let sawFreshSignalAgenda = false;
  let sawOpenIssue = false;
  let sawStrongPersuasion = false;
  let sawHonestSyntheticBoundary = false;
  let sawVerifiedAttendance = false;
  let sawConflictChange = false;
  let sawOpenConflict = false;
  let sawResolvedConflictObligation = false;
  let sawOpenConflictObligation = false;
  let sawConflictTrajectory = false;
  let sawStanceMovement = false;

  function markComplete(attribute) {
    if (document.documentElement.getAttribute(attribute) === "complete") return;
    document.documentElement.setAttribute(attribute, "complete");
  }

  function inspect() {
    // Agenda, Open Issues, persuasion, attendance and conflict threads can be
    // transient live UI. Retain genuine observations across React commits.
    const agenda = document.querySelector('[data-phase-reason="fresh_signal_follow_up"]');
    const agendaTrigger = agenda?.querySelector("[data-agenda-trigger-event]");
    if (agenda && agendaTrigger) {
      sawFreshSignalAgenda = true;
      markComplete(AGENDA_ATTR);
    }

    const openIssues = document.querySelector(".open-issues-radar.has-open-issues");
    const openIssue = openIssues?.querySelector("[data-open-issue-event]");
    if (openIssues && openIssue) {
      sawOpenIssue = true;
      markComplete(OPEN_ISSUES_ATTR);
    }

    const conflict = document.querySelector('[data-conflict-board="event-provenance"]');
    // A thread may remain OPEN even after an explicit revision. Movement and
    // unresolved obligations are independent facts; do not force them into one
    // mutually exclusive status just to make the showcase green.
    const changedThread = conflict?.querySelector('[data-conflict-movement="revision"][data-conflict-anchor-event]');
    const changedChallenge = changedThread?.querySelector('[data-conflict-count-kind="challenge"]');
    const changedEvidence = changedThread?.querySelector('[data-conflict-count-kind="evidence"]');
    const changedRevision = changedThread?.querySelector('[data-conflict-count-kind="revision"]');
    const changedTrace = changedThread?.querySelector('[data-conflict-trace-anchor]');
    if (changedThread && changedChallenge && changedEvidence && changedRevision && changedTrace) {
      sawConflictChange = true;
    }
    const openConflict = conflict?.querySelector('[data-conflict-status="open"]');
    const openConflictEvent = openConflict?.querySelector('[data-conflict-open-event]');
    if (openConflict && openConflictEvent) {
      sawOpenConflict = true;
    }
    if (sawConflictChange && sawOpenConflict) markComplete(CONFLICT_ATTR);

    const stanceFronts = changedThread?.querySelector('[data-conflict-stance-fronts]');
    const currentFront = stanceFronts?.querySelector('[data-stance-front-state="current"]');
    const vacatedFront = stanceFronts?.querySelector('[data-stance-front-state="vacated"]');
    const stanceMovement = stanceFronts?.querySelector('[data-stance-movement-event][data-stance-movement-from][data-stance-movement-to]');
    const stanceMovementCause = stanceMovement?.querySelector('[data-stance-movement-cause]');
    const uncommitted = stanceFronts?.querySelector('[data-stance-uncommitted="explicit-none"]');
    if (stanceFronts && currentFront && vacatedFront && stanceMovement && stanceMovementCause && uncommitted) {
      sawStanceMovement = true;
      markComplete(STANCE_FRONTS_ATTR);
    }

    const resolutionLedger = conflict?.querySelector('[data-conflict-resolution-ledger="exact-provenance"]');
    const resolvedObligation = resolutionLedger?.querySelector(
      '[data-conflict-obligation-state="resolved"][data-conflict-resolved-by-event]',
    );
    const openObligation = resolutionLedger?.querySelector('[data-conflict-obligation-state="open"]');
    const trajectoryRound = resolutionLedger?.querySelector(
      '[data-conflict-trajectory-round][data-conflict-trajectory-open-at-end]',
    );
    if (resolvedObligation) sawResolvedConflictObligation = true;
    if (openObligation) sawOpenConflictObligation = true;
    if (trajectoryRound) sawConflictTrajectory = true;
    if (sawResolvedConflictObligation && sawOpenConflictObligation && sawConflictTrajectory) {
      markComplete(CONFLICT_RESOLUTION_ATTR);
    }

    const persuasion = document.querySelector(
      '[data-persuasion-strength="strong"][data-persuasion-cause-event][data-persuasion-action-event]',
    );
    if (persuasion) {
      sawStrongPersuasion = true;
      markComplete(PERSUASION_ATTR);
    }

    const execution = document.querySelector('[data-execution-mode="synthetic-showcase"]');
    const warning = execution?.querySelector('[data-synthetic-showcase-warning="visible"]');
    const lockedProposal = document.querySelector('textarea[data-synthetic-proposal-locked="true"]');
    const syntheticReceipt = execution?.querySelector('[data-provider-receipt="received"]');
    if (execution && warning && lockedProposal && syntheticReceipt) {
      sawHonestSyntheticBoundary = true;
      markComplete(EXECUTION_BOUNDARY_ATTR);
    }

    const attendance = document.querySelector('[data-provider-attendance-audit="active"]');
    const verifiedTurn = attendance?.querySelector(
      '[data-attendance-turn-state="published"], [data-attendance-turn-state="repaired"]',
    );
    const peerSnapshotTurn = attendance?.querySelector(
      '[data-attendance-snapshot-count]:not([data-attendance-snapshot-count="0"])[data-attendance-published-count]:not([data-attendance-published-count="0"])',
    );
    if (attendance && verifiedTurn && peerSnapshotTurn) {
      sawVerifiedAttendance = true;
      markComplete(ATTENDANCE_ATTR);
    }

    const secretariatComplete = sawFreshSignalAgenda && sawOpenIssue;
    if (secretariatComplete) markComplete(SECRETARIAT_ATTR);

    const stream = document.querySelector(".live-discussion-stream");
    if (!(stream instanceof HTMLElement)) return false;

    const answeredExchange = document.querySelector('[data-peer-response-state="answered"][data-peer-response-event]');
    const queuedStage = answeredExchange?.querySelector('[data-peer-stage="queued"]');
    const targetTurnStage = answeredExchange?.querySelector('[data-peer-stage="responding"]');
    const answeredStage = answeredExchange?.querySelector('[data-peer-stage="answered"]');
    const peerLifecycleComplete = Boolean(answeredExchange && queuedStage && targetTurnStage && answeredStage);
    if (peerLifecycleComplete) markComplete(EXCHANGE_ATTR);

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
      && sawConflictChange
      && sawOpenConflict
      && sawResolvedConflictObligation
      && sawOpenConflictObligation
      && sawConflictTrajectory
      && sawStanceMovement
      && sawStrongPersuasion
      && sawHonestSyntheticBoundary
      && sawVerifiedAttendance
      && researchDesk
      && researchLane
      && researchEvidenceCount
      && researchEvidence
      && relationMap
      && relationEdge
      && replyEdge
      && traceButton
    ) {
      markComplete(COMPLETE_ATTR);
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
