import type { CouncilEvent, CouncilReport } from "./types.js";

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
  const headline = `${icons[event.kind]} ${actorName} · ${event.kind}`;

  switch (event.kind) {
    case "argument":
    case "revision":
    case "final_position":
      return `${headline}\n   stance: ${event.stance} (${Math.round(
        event.confidence * 100,
      )}%)\n   ${event.content}`;
    case "evidence":
      return `${headline}\n   ${event.claim}\n   ${event.content}`;
    case "challenge":
    case "support":
    case "defense":
    case "concede":
      return `${headline}\n   ${event.content}`;
    case "question":
    case "uncertain":
      return `${headline}\n   ${event.content}`;
  }
}

export function formatReport(report: CouncilReport): string {
  const consensus =
    report.consensusStance === null
      ? "No consensus"
      : `${report.consensusStance} · ${Math.round(
          report.consensusRatio * 100,
        )}% council support`;

  const minority =
    report.disagreements.length === 0
      ? "None"
      : report.disagreements
          .map(
            (position) =>
              `${position.participant.name}: ${position.stance} — ${position.content}`,
          )
          .join("\n");

  return [
    "👑 COUNCIL REPORT",
    `Question: ${report.question}`,
    `Verdict: ${consensus}`,
    `Council confidence: ${Math.round(report.confidence * 100)}%`,
    `Rounds: ${report.rounds}`,
    `Events: ${report.eventCount}`,
    "",
    "Minority report:",
    minority,
  ].join("\n");
}
