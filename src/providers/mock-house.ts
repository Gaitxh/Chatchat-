import type {
  CouncilAgent,
  CouncilContext,
  CouncilEvent,
} from "../core/types.js";
import {
  expandDelegationPlan,
  participantForDelegate,
  type DelegateDescriptor,
  type DelegationPlan,
} from "../house/delegations.js";
import { ScriptedCouncilAgent } from "./provider.js";

export const MOCK_HOUSE_PLAN: readonly DelegationPlan[] = [
  { id: "gpt", name: "GPT Delegation", provider: "mock-gpt", seats: 4 },
  { id: "qwen", name: "Qwen Delegation", provider: "mock-qwen", seats: 4 },
  { id: "claude", name: "Claude Delegation", provider: "mock-claude", seats: 4 },
  { id: "deepseek", name: "DeepSeek Delegation", provider: "mock-deepseek", seats: 4 },
];

interface DelegateScript {
  initial: string;
  final: string;
  confidence: number;
  influencerActorId?: string;
}

const SCRIPTS: Record<string, DelegateScript> = {
  "gpt::seat-01": { initial: "Tauri", final: "Tauri", confidence: 0.84 },
  "gpt::seat-02": { initial: "Tauri", final: "Tauri", confidence: 0.78 },
  "gpt::seat-03": { initial: "Electron", final: "Electron", confidence: 0.66 },
  "gpt::seat-04": { initial: "Tauri", final: "Tauri", confidence: 0.76 },

  "qwen::seat-01": { initial: "Tauri", final: "Tauri", confidence: 0.82 },
  "qwen::seat-02": { initial: "Tauri", final: "Tauri", confidence: 0.79 },
  "qwen::seat-03": { initial: "Tauri", final: "Tauri", confidence: 0.75 },
  "qwen::seat-04": { initial: "Electron", final: "Electron", confidence: 0.64 },

  "claude::seat-01": { initial: "Electron", final: "Electron", confidence: 0.7 },
  "claude::seat-02": {
    initial: "Electron",
    final: "Tauri",
    confidence: 0.77,
    influencerActorId: "gpt::seat-01",
  },
  "claude::seat-03": { initial: "Tauri", final: "Tauri", confidence: 0.8 },
  "claude::seat-04": { initial: "Tauri", final: "Tauri", confidence: 0.73 },

  "deepseek::seat-01": { initial: "Electron", final: "Electron", confidence: 0.69 },
  "deepseek::seat-02": {
    initial: "Electron",
    final: "Tauri",
    confidence: 0.72,
    influencerActorId: "qwen::seat-01",
  },
  "deepseek::seat-03": { initial: "Tauri", final: "Tauri", confidence: 0.71 },
  "deepseek::seat-04": { initial: "Electron", final: "Electron", confidence: 0.65 },
};

export function createMockHouse(): readonly CouncilAgent[] {
  return expandDelegationPlan(MOCK_HOUSE_PLAN).map(createDelegateAgent);
}

function createDelegateAgent(delegate: DelegateDescriptor): CouncilAgent {
  const script = SCRIPTS[delegate.actorId];
  if (!script) throw new Error(`Missing Mock House script for ${delegate.actorId}`);
  const participant = participantForDelegate(delegate, "Mock House Delegate");

  return new ScriptedCouncilAgent(participant, (context) =>
    respondForDelegate(context, delegate, script),
  );
}

function respondForDelegate(
  context: CouncilContext,
  delegate: DelegateDescriptor,
  script: DelegateScript,
) {
  if (context.phase === "sealed") {
    return [
      {
        kind: "argument" as const,
        stance: script.initial,
        content: `${delegate.displayName} independently opens for ${script.initial}. This is a sealed House opinion; no other delegate was visible yet.`,
        confidence: Math.max(0.5, script.confidence - 0.08),
      },
    ];
  }

  if (context.phase === "debate" && context.round === 2) {
    const opposite = firstPositionWithDifferentStance(
      context.publicEvents,
      delegate.actorId,
      script.initial,
    );
    if (!opposite) return [];

    if (delegate.delegationId === "qwen" && delegate.seatIndex === 1) {
      return [
        {
          kind: "evidence" as const,
          targetEventId: opposite.id,
          claim: "A local-first shell should minimize the amount of application runtime ChatChat itself owns.",
          content: "Qwen-01 submits a requirement-level argument to the House. It is evidence inside this scripted demo, not a claim of an external benchmark.",
          source: "session://mock-house-brief",
          confidence: 0.9,
        },
      ];
    }

    if (normalizeStance(script.initial) === "tauri") {
      return [
        {
          kind: "challenge" as const,
          targetEventId: opposite.id,
          content: `${delegate.displayName} challenges the opposing caucus to justify why browser determinism should dominate the local-first footprint goal.`,
        },
      ];
    }

    return [
      {
        kind: "challenge" as const,
        targetEventId: opposite.id,
        content: `${delegate.displayName} challenges the Tauri caucus to prove that system WebView differences will not become a Provider compatibility tax.`,
      },
    ];
  }

  if (context.phase === "debate" && context.round >= 3) {
    if (normalizeStance(script.initial) !== normalizeStance(script.final)) {
      const previous = firstOwnPosition(context);
      const cause = script.influencerActorId
        ? latestDebateEventBy(context.publicEvents, script.influencerActorId)
        : undefined;
      if (previous && cause) {
        return [
          {
            kind: "revision" as const,
            previousEventId: previous.id,
            stance: script.final,
            content: `${delegate.displayName} crosses the aisle from ${script.initial} to ${script.final} after considering ${cause.actorId}'s structured intervention.`,
            confidence: script.confidence,
            causedBy: [cause.id],
          },
        ];
      }
    }

    const ally = firstPositionWithSameStance(
      context.publicEvents,
      delegate.actorId,
      script.final,
    );
    return ally
      ? [
          {
            kind: "support" as const,
            targetEventId: ally.id,
            content: `${delegate.displayName} supports a cross-seat argument in the ${script.final} caucus while retaining an independent vote.`,
          },
        ]
      : [];
  }

  return [
    {
      kind: "final_position" as const,
      stance: script.final,
      content: `${delegate.displayName} casts a final independent House position for ${script.final}.`,
      confidence: script.confidence,
      caveats:
        normalizeStance(script.final) === "tauri"
          ? ["Keep browser/provider compatibility as a release gate."]
          : ["Revisit after real cross-platform Provider automation evidence."],
    },
  ];
}

function firstOwnPosition(context: CouncilContext): CouncilEvent | undefined {
  return context.ownEvents.find(
    (event) => event.kind === "argument" || event.kind === "revision",
  );
}

function firstPositionWithDifferentStance(
  events: readonly CouncilEvent[],
  actorId: string,
  stance: string,
): CouncilEvent | undefined {
  return events.find(
    (event) =>
      event.actorId !== actorId &&
      event.kind === "argument" &&
      normalizeStance(event.stance) !== normalizeStance(stance),
  );
}

function firstPositionWithSameStance(
  events: readonly CouncilEvent[],
  actorId: string,
  stance: string,
): CouncilEvent | undefined {
  return [...events].reverse().find(
    (event) =>
      event.actorId !== actorId &&
      (event.kind === "argument" || event.kind === "revision") &&
      normalizeStance(event.stance) === normalizeStance(stance),
  );
}

function latestDebateEventBy(
  events: readonly CouncilEvent[],
  actorId: string,
): CouncilEvent | undefined {
  return [...events].reverse().find(
    (event) => event.actorId === actorId && event.round >= 2,
  );
}

function normalizeStance(value: string): string {
  return value.trim().toLocaleLowerCase();
}
