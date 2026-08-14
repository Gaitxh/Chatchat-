import type { CouncilContext, CouncilEvent } from "../core/types.js";

export type PeerInboxKind = "challenge" | "question" | "evidence";

export interface PeerInboxItem {
  eventId: string;
  kind: PeerInboxKind;
  fromActorId: string;
  content: string;
  targetEventId?: string;
  targetExcerpt?: string;
}

const MAX_PEER_INBOX_ITEMS = 4;
const MAX_EXCERPT = 360;

/**
 * Returns only explicit, latest-round public events directed at this participant.
 * The inbox is an attention contract, not authority: it never changes event
 * ordering, snapshot contents, vote weight, or convergence math.
 */
export function buildDirectPeerInbox(context: CouncilContext): readonly PeerInboxItem[] {
  if (context.phase !== "debate" || !context.publicEvents.length) return [];

  const latestRound = Math.max(...context.publicEvents.map((event) => event.round));
  const byId = new Map(context.publicEvents.map((event) => [event.id, event] as const));

  return context.publicEvents
    .filter((event) => event.round === latestRound)
    .flatMap((event): PeerInboxItem[] => {
      if (event.kind === "question" && event.targetActorId === context.participant.id) {
        return [{
          eventId: event.id,
          kind: "question",
          fromActorId: event.actorId,
          content: compact(event.content),
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
          targetEventId: target.id,
          targetExcerpt: compact(eventText(target)),
        }];
      }

      return [];
    })
    .slice(-MAX_PEER_INBOX_ITEMS);
}

export function directPeerInboxPromptBlock(context: CouncilContext): readonly string[] {
  const inbox = buildDirectPeerInbox(context);
  if (!inbox.length) return [];

  return [
    "",
    "CHATCHAT_DIRECT_PEER_INBOX",
    `PEER_INBOX_JSON: ${JSON.stringify(inbox)}`,
    "These are bounded public events from the latest published round that explicitly target you or one of your prior public events. They create a response opportunity, not authority or pressure to agree.",
    "Before unrelated new points, address every inbox item you reasonably can in this turn. Answer direct questions substantively. For challenges or targeted evidence, explicitly defend, concede, revise, provide counter-evidence, or state uncertainty as warranted by the merits.",
    "If an inbox item changes your view, use revision or concede explicitly. If it does not, explain why in a defense, argument, evidence contribution, or uncertainty statement instead of silently ignoring it.",
    "Preserve provenance when semantically appropriate: challenge/evidence event ids may be referenced by defense/concede targetEventId or revision.causedBy. Never invent an event id and never manufacture agreement merely because another participant addressed you.",
    "This inbox does not change speaking priority, vote weight, convergence thresholds, or the immutable shared snapshot. Every participant remains an equal peer.",
    "END_CHATCHAT_DIRECT_PEER_INBOX",
  ];
}

function eventText(event: CouncilEvent): string {
  return event.kind === "evidence" ? `${event.claim} — ${event.content}` : event.content;
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_EXCERPT) return normalized;
  return `${normalized.slice(0, MAX_EXCERPT - 1)}…`;
}
