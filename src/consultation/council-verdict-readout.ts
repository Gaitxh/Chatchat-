import type { CouncilEvent, CouncilEventKind, CouncilReport } from "../core/types.js";
import { deriveResponseObligationSummary } from "./response-obligation-summary.js";

export type CouncilVerdictAttentionState =
  | "pending-response"
  | "minority-survives"
  | "no-leading-stance"
  | "stable-alignment";

export interface CouncilVerdictRevision {
  revisionEventId: string;
  actor: string;
  round: number;
  previousStance: string;
  newStance: string;
  causeEventIds: string[];
  causeKinds: CouncilEventKind[];
}

export interface CouncilVerdictReadout {
  leadingStance: string | null;
  alignmentRatio: number;
  minorityCount: number;
  minorityStances: string[];
  responseTotal: number;
  responseAnswered: number;
  responsePending: number;
  unansweredRequestEventIds: string[];
  responseReportMatchesCanonical: boolean | null;
  stopReason?: CouncilReport["stopReason"];
  lastRevision?: CouncilVerdictRevision;
  attentionState: CouncilVerdictAttentionState;
}

/**
 * First-layer meeting readout for the Web Council Stage.
 *
 * This is intentionally descriptive. Alignment is copied from CouncilReport and
 * is never promoted to correctness. Named-response status delegates to the
 * canonical response-obligation ledger. Minority positions remain visible even
 * when one stance leads. Revision provenance comes only from explicit revision
 * events and their structured causedBy edges.
 */
export function deriveCouncilVerdictReadout(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): CouncilVerdictReadout {
  const response = deriveResponseObligationSummary(report, events);
  const nameById = new Map(
    report.positions.map((position) => [position.participant.id, position.participant.name] as const),
  );
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const lastRevisionEvent = [...events].reverse().find((event) => event.kind === "revision");
  const lastRevision = lastRevisionEvent?.kind === "revision"
    ? deriveRevision(lastRevisionEvent, eventById, nameById)
    : undefined;
  const minorityStances = [...new Set(report.disagreements.map((position) => position.stance))];

  return {
    leadingStance: report.consensusStance,
    alignmentRatio: report.consensusRatio,
    minorityCount: report.disagreements.length,
    minorityStances,
    responseTotal: response.total,
    responseAnswered: response.answered,
    responsePending: response.pending,
    unansweredRequestEventIds: [...response.unansweredEventIds],
    responseReportMatchesCanonical: response.reportMatchesCanonical,
    ...(report.stopReason ? { stopReason: report.stopReason } : {}),
    ...(lastRevision ? { lastRevision } : {}),
    attentionState: response.pending > 0
      ? "pending-response"
      : report.disagreements.length > 0
        ? "minority-survives"
        : report.consensusStance === null
          ? "no-leading-stance"
          : "stable-alignment",
  };
}

function deriveRevision(
  revision: Extract<CouncilEvent, { kind: "revision" }>,
  eventById: ReadonlyMap<string, CouncilEvent>,
  nameById: ReadonlyMap<string, string>,
): CouncilVerdictRevision | undefined {
  const previous = eventById.get(revision.previousEventId);
  if (!previous || !hasStance(previous)) return undefined;
  const causes = (revision.causedBy ?? [])
    .map((id) => eventById.get(id))
    .filter((event): event is CouncilEvent => Boolean(event));

  return {
    revisionEventId: revision.id,
    actor: nameById.get(revision.actorId) ?? revision.actorId,
    round: revision.round,
    previousStance: previous.stance,
    newStance: revision.stance,
    causeEventIds: causes.map((event) => event.id),
    causeKinds: causes.map((event) => event.kind),
  };
}

function hasStance(event: CouncilEvent): event is Extract<CouncilEvent, { kind: "argument" | "revision" | "final_position" }> {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position";
}
