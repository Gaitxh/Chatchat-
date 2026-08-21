import type { CouncilContext, CouncilEvent } from "../core/types.js";
import {
  deriveDirectResponseReceipts,
  type DirectResponseReceipt,
} from "./direct-response-receipts.js";

export type PeerInboxKind = "challenge" | "question" | "evidence";

export interface PeerInboxItem {
  eventId: string;
  kind: PeerInboxKind;
  fromActorId: string;
  content: string;
  requestRound: number;
  receiptStatus: "pending";
  targetEventId?: string;
  targetExcerpt?: string;
}

const MAX_PEER_INBOX_ITEMS = 4;
const MAX_EXCERPT = 360;
const FIRST_PUBLIC_DEBATE_ROUND = 2;

/**
 * Returns only explicit public peer requests that still require this participant's
 * response. New latest-round requests appear immediately; older unanswered requests
 * remain in the bounded inbox while Open Issues / context selection keep their source
 * events visible. An explicitly answered request disappears mechanically.
 *
 * The inbox is an attention contract, not authority: it never changes event ordering,
 * snapshot contents, vote weight, convergence math, or the participant's right to
 * defend a minority view.
 */
export function buildDirectPeerInbox(context: CouncilContext): readonly PeerInboxItem[] {
  if (context.phase !== "debate" || !context.publicEvents.length) return [];

  const byId = new Map(context.publicEvents.map((event) => [event.id, event] as const));
  const pendingReceipts = deriveDirectResponseReceipts(context.publicEvents)
    .filter((receipt) =>
      receipt.status === "pending"
      && receipt.targetActorId === context.participant.id
      // Round 1 is sealed. Historical/synthetic archives that contain a targeted
      // request there must not punch through the independence boundary later.
      && receipt.requestRound >= FIRST_PUBLIC_DEBATE_ROUND,
    );

  return prioritizePending(pendingReceipts)
    .flatMap((receipt): PeerInboxItem[] => {
      const event = byId.get(receipt.requestEventId);
      if (!event) return [];
      if (event.kind === "question") {
        return [{
          eventId: event.id,
          kind: "question",
          fromActorId: event.actorId,
          content: compact(event.content),
          requestRound: event.round,
          receiptStatus: "pending",
        }];
      }

      if ((event.kind === "challenge" || event.kind === "evidence") && event.targetEventId) {
        const target = byId.get(event.targetEventId);
        if (!target || target.actorId !== context.participant.id) return [];
        return [{
          eventId: event.id,
          kind: event.kind,
          fromActorId: event.actorId,
          content: compact(event.kind === "evidence" ? `${event.claim} — ${event.content}` : event.content),
          requestRound: event.round,
          receiptStatus: "pending",
          targetEventId: target.id,
          targetExcerpt: compact(eventText(target)),
        }];
      }

      return [];
    })
    .slice(0, MAX_PEER_INBOX_ITEMS);
}

export function directPeerInboxPromptBlock(context: CouncilContext): readonly string[] {
  const inbox = buildDirectPeerInbox(context);
  if (!inbox.length) return [];

  return [
    "",
    "CHATCHAT_DIRECT_PEER_INBOX",
    `PEER_INBOX_JSON: ${JSON.stringify(inbox)}`,
    "These are bounded public peer requests that explicitly target you or one of your prior public events and still have no machine-verifiable response receipt from you. They create a response obligation of attention, not authority or pressure to agree.",
    "Older pending items may remain here across debate rounds until you publish an explicit structured response edge. Topical similarity or merely discussing the same subject does not close a receipt.",
    "Before unrelated new points, address every inbox item you reasonably can in this turn. Answer direct questions substantively. For challenges or targeted evidence, explicitly defend, concede, revise, provide counter-evidence, or state uncertainty as warranted by the merits.",
    "Close provenance deliberately: argument/evidence/question/uncertain may use replyToEventId; defense/concede/evidence may target the request event id; revision may include the request event id in causedBy. Use only fields allowed by the contribution schema.",
    "If an inbox item changes your view, use revision or concede explicitly. If it does not, explain why with a structured response edge instead of silently ignoring it. A valid defense of a minority position is a successful response receipt; agreement is never required.",
    "Never invent an event id. This inbox does not change speaking priority, vote weight, convergence thresholds, or the immutable shared snapshot. Every participant remains an equal peer.",
    "END_CHATCHAT_DIRECT_PEER_INBOX",
  ];
}

/**
 * Oldest-round first prevents a valid but ignored request from being starved by a
 * stream of newer requests. ECMAScript's stable sort preserves immutable Blackboard
 * publication order for requests from the same round. The hard cap still bounds
 * prompt cost; unshown pending issues remain in the canonical Open Issues ledger and
 * can rotate into view once earlier debts close.
 */
function prioritizePending(receipts: readonly DirectResponseReceipt[]): DirectResponseReceipt[] {
  return [...receipts].sort((a, b) => a.requestRound - b.requestRound);
}

function eventText(event: CouncilEvent): string {
  return event.kind === "evidence" ? `${event.claim} — ${event.content}` : event.content;
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_EXCERPT) return normalized;
  return `${normalized.slice(0, MAX_EXCERPT - 1)}…`;
}
