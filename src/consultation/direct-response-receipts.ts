import type { CouncilEvent } from "../core/types.js";
import { findMeetingIssueResolver } from "./open-issues.js";
import { directPeerRequestTarget, type DirectPeerRequestKind } from "./structured-response.js";

export type DirectResponseReceiptStatus = "pending" | "answered";

export interface DirectResponseReceipt {
  requestEventId: string;
  requestKind: DirectPeerRequestKind;
  requestRound: number;
  fromActorId: string;
  targetActorId: string;
  status: DirectResponseReceiptStatus;
  responseEventId?: string;
  responseRound?: number;
}

/**
 * Deterministic receipt ledger for explicit peer-to-peer obligations.
 *
 * The request target and closure rules are exactly the same canonical structural
 * rules used by Open Issues. A response receipt is never inferred from topical
 * similarity, confidence, majority agreement, or prose such as "I agree".
 * Only a later event by the participant who actually owes the response, carrying
 * an explicit protocol edge to the exact request, can close the receipt.
 */
export function deriveDirectResponseReceipts(
  events: readonly CouncilEvent[],
): DirectResponseReceipt[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const receipts: DirectResponseReceipt[] = [];

  for (const event of events) {
    const target = directPeerRequestTarget(event, eventById);
    if (!target) continue;
    const resolver = findMeetingIssueResolver(events, event, eventById);
    receipts.push({
      requestEventId: event.id,
      requestKind: target.kind,
      requestRound: event.round,
      fromActorId: event.actorId,
      targetActorId: target.actorId,
      status: resolver ? "answered" : "pending",
      ...(resolver ? {
        responseEventId: resolver.id,
        responseRound: resolver.round,
      } : {}),
    });
  }

  return receipts;
}

export function pendingDirectResponseReceipts(
  events: readonly CouncilEvent[],
): DirectResponseReceipt[] {
  return deriveDirectResponseReceipts(events).filter((receipt) => receipt.status === "pending");
}

export function pendingDirectRequestEventIds(
  events: readonly CouncilEvent[],
): string[] {
  return pendingDirectResponseReceipts(events).map((receipt) => receipt.requestEventId);
}
