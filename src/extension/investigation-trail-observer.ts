import type { CouncilReport } from "../core/types.js";
import { createInvestigationTrailEdge } from "../history/investigation-trail.js";
import { BrowserInvestigationTrailStore } from "./investigation-trail-store.js";
import {
  announceInvestigationFollowUpChanged,
  announceInvestigationTrailUpdated,
  INVESTIGATION_FOLLOW_UP_CLEAR_EVENT,
  INVESTIGATION_FOLLOW_UP_STAGED_EVENT,
} from "./investigation-trail-wire.js";
import type { PendingInvestigationFollowUp } from "../history/investigation-trail.js";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const MARKER = "__chatchatInvestigationTrailObserverV1";
const store = new BrowserInvestigationTrailStore();

interface CompletionDetail {
  report: CouncilReport;
}

type MarkedWindow = Window & { [MARKER]?: true };

install();

function install(): void {
  const marked = window as MarkedWindow;
  if (marked[MARKER]) return;
  marked[MARKER] = true;

  void store.getPending()
    .then((pending) => announceInvestigationFollowUpChanged(pending))
    .catch(() => announceInvestigationFollowUpChanged(null));

  window.addEventListener(INVESTIGATION_FOLLOW_UP_STAGED_EVENT, (event: Event) => {
    const pending = (event as CustomEvent<PendingInvestigationFollowUp>).detail;
    if (!pending?.parentSessionId || !pending?.moveId) return;
    void store.setPending(pending)
      .then(() => announceInvestigationFollowUpChanged(pending))
      .catch(() => undefined);
  });

  window.addEventListener(INVESTIGATION_FOLLOW_UP_CLEAR_EVENT, () => {
    void store.clearPending()
      .then(() => announceInvestigationFollowUpChanged(null))
      .catch(() => undefined);
  });

  window.addEventListener(COMPLETE_EVENT, (event: Event) => {
    const report = (event as CustomEvent<CompletionDetail>).detail?.report;
    if (!report?.sessionId) return;
    void linkCompletedFollowUp(report);
  });
}

async function linkCompletedFollowUp(report: CouncilReport): Promise<void> {
  const pending = await store.getPending();
  if (!pending) return;
  const edge = createInvestigationTrailEdge(pending, report);
  if (!edge) {
    await store.clearPending();
    announceInvestigationFollowUpChanged(null);
    return;
  }

  await store.save(edge);
  await store.clearPending();
  announceInvestigationFollowUpChanged(null);
  announceInvestigationTrailUpdated();
}
