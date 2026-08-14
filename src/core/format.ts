import type { CouncilEvent, CouncilReport, CouncilStopReason } from "./types.js";

const icons: Record<CouncilEvent["kind"], string> = {
  argument: "💬",
  challenge: "⚔️",
  evidence: "📎",
  support: "🤝",
  defense: "🛡️",
  revision: "🔄",
  concede: "🏳️",
  question: "❓",
  uncertain: "⚠️",
  final_position: "📜",
};

export function formatEvent(event: CouncilEvent, actorName: string): string {
  const headline = `${icons[event.kind]} ${actorName} · ${event.kind} · R${event.round}`;
  const provenance = eventProvenance(event);

  switch (event.kind) {
    case "argument":
      return join([
        headline,
        `   event: ${event.id}`,
        `   stance: ${event.stance} (${Math.round(event.confidence * 100)}%)`,
        `   ${event.content}`,
        ...provenance,
      ]);
    case "revision":
      return join([
        headline,
        `   event: ${event.id}`,
        `   stance: ${event.stance} (${Math.round(event.confidence * 100)}%)`,
        `   ${event.content}`,
        `   previousEventId: ${event.previousEventId}`,
        ...(event.causedBy?.length ? [`   causedBy: ${event.causedBy.join(", ")}`] : []),
      ]);
    case "final_position":
      return join([
        headline,
        `   event: ${event.id}`,
        `   stance: ${event.stance} (${Math.round(event.confidence * 100)}%)`,
        `   ${event.content}`,
        ...(event.caveats?.length ? [`   caveats: ${event.caveats.join(" | ")}`] : []),
      ]);
    case "evidence":
      return join([
        headline,
        `   event: ${event.id}`,
        `   claim: ${event.claim}`,
        `   ${event.content}`,
        ...(event.source ? [`   source: ${event.source}`] : []),
        ...(event.sourceDate ? [`   sourceDate: ${event.sourceDate}`] : []),
        ...provenance,
      ]);
    case "challenge":
    case "support":
    case "defense":
    case "concede":
      return join([
        headline,
        `   event: ${event.id}`,
        `   targetEventId: ${event.targetEventId}`,
        `   ${event.content}`,
      ]);
    case "question":
      return join([
        headline,
        `   event: ${event.id}`,
        ...(event.targetActorId ? [`   targetActorId: ${event.targetActorId}`] : []),
        `   ${event.content}`,
        ...provenance,
      ]);
    case "uncertain":
      return join([
        headline,
        `   event: ${event.id}`,
        `   confidence: ${Math.round(event.confidence * 100)}%`,
        `   ${event.content}`,
        ...provenance,
      ]);
  }
}

export function formatReport(report: CouncilReport): string {
  const leading = report.consensusStance === null
    ? "No leading position"
    : `${report.consensusStance} · ${Math.round(report.consensusRatio * 100)}% alignment`;
  const positions = report.positions.length
    ? report.positions
        .map((position) => `- ${position.participant.name}: ${position.stance} (${Math.round(position.confidence * 100)}%)`)
        .join("\n")
    : "None";
  const minority = report.disagreements.length
    ? report.disagreements
        .map((position) => `- ${position.participant.name}: ${position.stance} — ${position.content}`)
        .join("\n")
    : "None";

  return [
    "◎ CONSULTATION OUTCOME",
    `Proposal: ${report.question}`,
    ...(report.mode ? [`Mode: ${report.mode}`] : []),
    `Leading position: ${leading}`,
    "Alignment is descriptive telemetry, not authority.",
    `Aggregate confidence: ${Math.round(report.confidence * 100)}%`,
    ...(report.stopReason ? [`Stop reason: ${formatStopReason(report.stopReason)}`] : []),
    `Rounds: ${report.rounds}`,
    `Events: ${report.eventCount}`,
    "",
    "Final positions:",
    positions,
    "",
    "Surviving minority positions:",
    minority,
  ].join("\n");
}

function eventProvenance(
  event: Extract<CouncilEvent, { kind: "argument" | "evidence" | "question" | "uncertain" }>,
): string[] {
  return event.replyToEventId ? [`   replyToEventId: ${event.replyToEventId}`] : [];
}

function formatStopReason(reason: CouncilStopReason): string {
  return reason === "stable_alignment_no_new_signal"
    ? "stable alignment with no fresh peer-response signal"
    : "hard round budget reached with remaining disagreement/issues preserved";
}

function join(lines: readonly string[]): string {
  return lines.filter(Boolean).join("\n");
}
