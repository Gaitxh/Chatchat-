import type {
  CouncilEvent,
  CouncilReport,
} from "../core/types.js";
import {
  deriveEvidenceLedger,
  evidenceDisplayState,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { consultationModeDefinition } from "./modes.js";

export interface ConsultationReceiptKeyTurn {
  causeEventId: string;
  revisionEventId: string;
  causeKind: "evidence" | "challenge" | "support" | "argument" | "other";
  fromActor: string;
  toActor: string;
  previousStance: string;
  newStance: string;
}

export interface ConsultationReceiptEvidence {
  eventId: string;
  actor: string;
  claim: string;
  sourceHost?: string;
  sourceState: "not_checked" | "reachable" | "unavailable" | "unsupported";
  disputed: boolean;
  changedMind: boolean;
  observedAt?: string;
}

export interface ConsultationReceipt {
  sessionId: string;
  createdAt: string;
  mode: NonNullable<CouncilReport["mode"]>;
  modeIcon: string;
  modeLabelEn: string;
  modeLabelZhCN: string;
  proposalPreview: string;
  outcome: string;
  consensusRatio: number;
  participantNames: string[];
  rounds: number;
  eventCount: number;
  challengeCount: number;
  evidenceCount: number;
  revisionCount: number;
  concessionCount: number;
  minorityCount: number;
  minorityStances: string[];
  keyTurn?: ConsultationReceiptKeyTurn;
  evidence?: ConsultationReceiptEvidence;
}

export function deriveConsultationReceipt(
  report: CouncilReport,
  events: readonly CouncilEvent[],
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>> = {},
): ConsultationReceipt {
  const participants = report.positions.map((position) => position.participant);
  const nameById = new Map(participants.map((participant) => [participant.id, participant.name]));
  const byId = new Map(events.map((event) => [event.id, event]));
  const mode = report.mode ?? "balanced";
  const modeDefinition = consultationModeDefinition(mode);
  const ledger = deriveEvidenceLedger(participants, events);

  const rankedEvidence = ledger
    .map((record) => {
      const verification = verifications[record.evidenceEventId];
      const display = evidenceDisplayState(record, verification);
      const score = (display.changedMind ? 8 : 0)
        + (display.disputed ? 4 : 0)
        + (display.sourceState === "reachable" ? 2 : 0)
        + (record.sourceHost ? 1 : 0);
      return { record, verification, display, score };
    })
    .sort((a, b) => b.score - a.score || a.record.evidenceEventId.localeCompare(b.record.evidenceEventId));

  const highlighted = rankedEvidence[0];
  const keyTurn = deriveKeyTurn(events, byId, nameById);

  return {
    sessionId: report.sessionId,
    createdAt: events.at(-1)?.createdAt ?? events[0]?.createdAt ?? "",
    mode,
    modeIcon: modeDefinition.icon,
    modeLabelEn: modeDefinition.en.label,
    modeLabelZhCN: modeDefinition.zhCN.label,
    proposalPreview: compact(report.question, 220),
    outcome: report.consensusStance ?? "No single leading stance",
    consensusRatio: report.consensusRatio,
    participantNames: report.positions.map((position) => position.participant.name),
    rounds: report.rounds,
    eventCount: events.length,
    challengeCount: events.filter((event) => event.kind === "challenge").length,
    evidenceCount: events.filter((event) => event.kind === "evidence").length,
    revisionCount: events.filter((event) => event.kind === "revision").length,
    concessionCount: events.filter((event) => event.kind === "concede").length,
    minorityCount: report.disagreements.length,
    minorityStances: [...new Set(report.disagreements.map((position) => position.stance))],
    ...(keyTurn ? { keyTurn } : {}),
    ...(highlighted ? {
      evidence: {
        eventId: highlighted.record.evidenceEventId,
        actor: highlighted.record.actorName,
        claim: compact(highlighted.record.claim, 180),
        ...(highlighted.record.sourceHost ? { sourceHost: highlighted.record.sourceHost } : {}),
        sourceState: highlighted.display.sourceState,
        disputed: highlighted.display.disputed,
        changedMind: highlighted.display.changedMind,
        ...(highlighted.verification?.observedAt ? { observedAt: highlighted.verification.observedAt } : {}),
      },
    } : {}),
  };
}

export function consultationReceiptMarkdown(
  receipt: ConsultationReceipt,
  locale: "en" | "zh-CN" = "en",
): string {
  const zh = locale === "zh-CN";
  const modeLabel = zh ? receipt.modeLabelZhCN : receipt.modeLabelEn;
  const lines = [
    `# ChatChat · ${receipt.modeIcon} ${modeLabel}`,
    "",
    `> ${receipt.proposalPreview}`,
    "",
    `**${zh ? "协商结果" : "Outcome"}:** ${receipt.outcome}`,
    `**${zh ? "立场对齐" : "Alignment"}:** ${Math.round(receipt.consensusRatio * 100)}%`,
    "",
    `${receipt.participantNames.length} ${zh ? "位 AI" : "AIs"} · ${receipt.rounds} ${zh ? "轮" : "rounds"} · ⚔ ${receipt.challengeCount} · 📎 ${receipt.evidenceCount} · ↻ ${receipt.revisionCount}${receipt.concessionCount ? ` · 🏳 ${receipt.concessionCount}` : ""}`,
  ];

  if (receipt.keyTurn) {
    lines.push(
      "",
      `**${zh ? "关键转折" : "Key turn"}:** ${receipt.keyTurn.fromActor} → ${receipt.keyTurn.toActor}`,
      `${receipt.keyTurn.previousStance} → ${receipt.keyTurn.newStance} (${receipt.keyTurn.causeKind})`,
    );
  }

  if (receipt.evidence) {
    const status = receipt.evidence.sourceState.toUpperCase().replace("_", " ");
    lines.push(
      "",
      `**${zh ? "证据" : "Evidence"}:** ${receipt.evidence.sourceHost ?? receipt.evidence.actor} · ${status}${receipt.evidence.disputed ? ` · ${zh ? "存在质疑" : "DISPUTED"}` : ""}${receipt.evidence.changedMind ? ` · ${zh ? "触发改口" : "CHANGED A VIEW"}` : ""}`,
      receipt.evidence.claim,
    );
  }

  if (receipt.minorityCount) {
    lines.push(
      "",
      `**${zh ? "少数意见保留" : "Minority survives"}:** ${receipt.minorityStances.join(" / ")}`,
    );
  }

  lines.push(
    "",
    zh
      ? "_没有议长 AI · 多数不是权威 · 来源可达不等于主张为真 · 本地回放_"
      : "_No chair AI · Majority is not authority · Reachable is not proof · Local replay_",
  );
  return lines.join("\n");
}

export function consultationReceiptSvg(
  receipt: ConsultationReceipt,
  locale: "en" | "zh-CN" = "en",
): string {
  const zh = locale === "zh-CN";
  const modeLabel = zh ? receipt.modeLabelZhCN : receipt.modeLabelEn;
  const proposalLines = wrap(receipt.proposalPreview, zh ? 34 : 52, 3);
  const outcomeLines = wrap(receipt.outcome, zh ? 30 : 42, 2);
  const keyTurn = receipt.keyTurn
    ? `${receipt.keyTurn.fromActor} → ${receipt.keyTurn.toActor} · ${receipt.keyTurn.previousStance} → ${receipt.keyTurn.newStance}`
    : (zh ? "没有明确 revision 转折" : "No explicit revision turn");
  const keyLines = wrap(keyTurn, zh ? 32 : 48, 2);
  const evidence = receipt.evidence
    ? `${receipt.evidence.sourceHost ?? receipt.evidence.actor} · ${receipt.evidence.sourceState.toUpperCase()}${receipt.evidence.disputed ? " · DISPUTED" : ""}${receipt.evidence.changedMind ? " · ↻" : ""}`
    : (zh ? "本场没有结构化证据" : "No structured evidence in this meeting");
  const evidenceLines = wrap(evidence, zh ? 34 : 52, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="ChatChat Consultation Receipt">
<rect width="1200" height="630" rx="32" fill="#f7f5ef"/>
<g font-family="ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans CJK SC',sans-serif">
<text x="58" y="68" fill="#23221f" font-size="27" font-weight="760">ChatChat</text>
<text x="58" y="96" fill="#8b8479" font-size="12" font-weight="700" letter-spacing="1.6">CONSULTATION RECEIPT</text>
<rect x="884" y="42" width="258" height="56" rx="18" fill="#252824"/>
<text x="1013" y="77" fill="#ffffff" text-anchor="middle" font-size="17" font-weight="720">${escapeXml(`${receipt.modeIcon} ${modeLabel}`)}</text>
<rect x="50" y="126" width="1100" height="118" rx="22" fill="#ffffff" stroke="#e4dfd6"/>
<text x="74" y="156" fill="#989084" font-size="11" font-weight="750" letter-spacing="1.2">${zh ? "提案" : "PROPOSAL"}</text>
${svgLines(proposalLines, 74, 188, 25, 28, "#292723", 650)}
<text x="50" y="286" fill="#8f887e" font-size="11" font-weight="750" letter-spacing="1.2">${zh ? "协商结果" : "OUTCOME"}</text>
${svgLines(outcomeLines, 50, 324, 35, 40, "#1f201d", 760)}
<text x="50" y="400" fill="#736d64" font-size="15">${escapeXml(`${receipt.participantNames.length} ${zh ? "位 AI" : "AIs"} · ${receipt.rounds} ${zh ? "轮" : "rounds"} · ⚔ ${receipt.challengeCount} · 📎 ${receipt.evidenceCount} · ↻ ${receipt.revisionCount}${receipt.minorityCount ? ` · 🧍 ${receipt.minorityCount}` : ""}`)}</text>
<rect x="50" y="430" width="530" height="122" rx="20" fill="#fffdf9" stroke="#e1dcd3"/>
<text x="72" y="460" fill="#8b8378" font-size="10" font-weight="760" letter-spacing="1">${zh ? "关键转折" : "KEY TURN"}</text>
${svgLines(keyLines, 72, 492, 17, 23, "#3b3833", 650)}
<rect x="600" y="430" width="550" height="122" rx="20" fill="#eef3ec" stroke="#dbe4d8"/>
<text x="622" y="460" fill="#6d806c" font-size="10" font-weight="760" letter-spacing="1">${zh ? "证据" : "EVIDENCE"}</text>
${svgLines(evidenceLines, 622, 492, 17, 23, "#39483a", 650)}
<text x="50" y="592" fill="#979086" font-size="11">${zh ? "没有议长 AI · 多数不是权威 · 来源可达不等于主张为真 · 本地回放" : "No chair AI · Majority is not authority · Reachable is not proof · Local replay"}</text>
<text x="1150" y="592" fill="#aaa399" text-anchor="end" font-size="10">${escapeXml(shortSession(receipt.sessionId))}</text>
</g></svg>`;
}

function deriveKeyTurn(
  events: readonly CouncilEvent[],
  byId: ReadonlyMap<string, CouncilEvent>,
  nameById: ReadonlyMap<string, string>,
): ConsultationReceiptKeyTurn | undefined {
  const revisions = [...events].reverse().filter((event) => event.kind === "revision");
  for (const revision of revisions) {
    if (revision.kind !== "revision") continue;
    const causes = (revision.causedBy ?? []).map((id) => byId.get(id)).filter((event): event is CouncilEvent => Boolean(event));
    const cause = causes.sort((a, b) => causeRank(b.kind) - causeRank(a.kind))[0];
    if (!cause) continue;
    const previous = byId.get(revision.previousEventId);
    if (!previous || (previous.kind !== "argument" && previous.kind !== "revision" && previous.kind !== "final_position")) continue;
    return {
      causeEventId: cause.id,
      revisionEventId: revision.id,
      causeKind: receiptCauseKind(cause.kind),
      fromActor: nameById.get(cause.actorId) ?? cause.actorId,
      toActor: nameById.get(revision.actorId) ?? revision.actorId,
      previousStance: previous.stance,
      newStance: revision.stance,
    };
  }
  return undefined;
}

function causeRank(kind: CouncilEvent["kind"]): number {
  if (kind === "evidence") return 4;
  if (kind === "challenge") return 3;
  if (kind === "support") return 2;
  if (kind === "argument") return 1;
  return 0;
}

function receiptCauseKind(kind: CouncilEvent["kind"]): ConsultationReceiptKeyTurn["causeKind"] {
  if (kind === "evidence" || kind === "challenge" || kind === "support" || kind === "argument") return kind;
  return "other";
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function wrap(value: string, width: number, maxLines: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const tokens = /[\u3400-\u9fff]/.test(normalized) ? [...normalized] : normalized.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line ? (/^[\u3400-\u9fff]/.test(token) ? `${line}${token}` : `${line} ${token}`) : token;
    if (visualLength(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = token;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(/[\u3400-\u9fff]/.test(normalized) ? "" : " ");
  if (used.length < normalized.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]!.replace(/…?$/, "")}…`;
  }
  return lines.slice(0, maxLines);
}

function visualLength(value: string): number {
  return [...value].reduce((sum, char) => sum + (/^[\u3400-\u9fff]$/.test(char) ? 2 : 1), 0);
}

function svgLines(lines: readonly string[], x: number, y: number, fontSize: number, step: number, fill: string, weight: number): string {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * step}" fill="${fill}" font-size="${fontSize}" font-weight="${weight}">${escapeXml(line)}</text>`).join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shortSession(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}
