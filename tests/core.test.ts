import { Blackboard } from "../src/core/blackboard.js";
import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilEventKind,
  CouncilPhaseUpdate,
} from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const board = new Blackboard();
board.publish({
  id: "e1",
  sessionId: "s1",
  round: 1,
  actorId: "a",
  kind: "argument",
  stance: "Tauri",
  content: "Initial",
  confidence: 0.7,
  createdAt: "2026-01-01T00:00:00.000Z",
});
board.publish({
  id: "e2",
  sessionId: "s1",
  round: 2,
  actorId: "a",
  kind: "revision",
  previousEventId: "e1",
  stance: "Electron",
  content: "Changed",
  confidence: 0.8,
  createdAt: "2026-01-01T00:00:01.000Z",
});

assert(
  board.latestPositionEvent("a")?.stance === "Electron",
  "Blackboard should expose the latest stance.",
);

const sealedViews: number[] = [];

function agent(
  id: string,
  initialStance: string,
  finalStance: string,
): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(
      context: CouncilContext,
    ): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        sealedViews.push(context.publicEvents.length);
        return [
          {
            kind: "argument",
            stance: initialStance,
            content: initialStance,
            confidence: 0.7,
          },
        ];
      }

      if (context.phase === "debate") return [];

      return [
        {
          kind: "final_position",
          stance: finalStance,
          content: finalStance,
          confidence: 0.8,
        },
      ];
    },
  };
}

const council = new CouncilOrchestrator([
  agent("a1", "A", "A"),
  agent("a2", "B", "A"),
  agent("a3", "A", "A"),
]);

const phaseUpdates: CouncilPhaseUpdate[] = [];
const { report } = await council.run("test", {
  maxRounds: 2,
  minDebateRounds: 1,
  onPhase: (update) => {
    phaseUpdates.push(update);
  },
});

assert(
  sealedViews.every((count) => count === 0),
  "Round 1 must be sealed from peer outputs.",
);
assert(report.consensusStance === "A", "Final consensus should be A.");
assert(
  Math.abs(report.consensusRatio - 1) < Number.EPSILON,
  "All three final positions should converge on A.",
);
assert(
  phaseUpdates.map(({ phase, round }) => `${phase}:${round}`).join(",") ===
    "sealed:1,debate:2,final:3",
  "Orchestrator should expose deterministic phase lifecycle updates.",
);

const stablePhases: CouncilPhaseUpdate[] = [];
await new CouncilOrchestrator([
  agent("stable-1", "A", "A"),
  agent("stable-2", "A", "A"),
  agent("stable-3", "A", "A"),
]).run("stable convergence", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase: (update) => {
    stablePhases.push(update);
  },
});
assert(
  stablePhases.map(({ phase, round }) => `${phase}:${round}`).join(",") ===
    "sealed:1,debate:2,final:3",
  "Aligned participants with no fresh unresolved signal should still be allowed to converge early.",
);

for (const kind of ["challenge", "evidence", "revision", "question", "uncertain"] as const) {
  await assertFreshSignalGetsResponseRound(kind);
}

console.log("✓ ChatChat council-core tests passed");
console.log("✓ Fresh challenge/evidence/revision/question/uncertainty cannot be closed by alignment before peers can respond");

async function assertFreshSignalGetsResponseRound(
  kind: Extract<CouncilEventKind, "challenge" | "evidence" | "revision" | "question" | "uncertain">,
) {
  const phases: CouncilPhaseUpdate[] = [];
  let signalVisibleInNextRound = false;

  const agents = ["signal-1", "signal-2", "signal-3"].map((id, index): CouncilAgent => ({
    participant: { id: `${kind}-${id}`, name: `${kind}-${id}`, provider: "test" },
    async respond(context): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance: "A", content: "Aligned initial position", confidence: 0.8 }];
      }
      if (context.phase === "debate" && context.round === 2 && index === 0) {
        return [freshSignal(kind, context)];
      }
      if (context.phase === "debate" && context.round === 3) {
        signalVisibleInNextRound ||= context.publicEvents.some((event) => event.kind === kind && event.round === 2);
        return [];
      }
      if (context.phase === "debate") return [];
      return [{ kind: "final_position", stance: "A", content: "Final A", confidence: 0.85 }];
    },
  }));

  await new CouncilOrchestrator(agents).run(`fresh ${kind}`, {
    maxRounds: 3,
    minDebateRounds: 1,
    convergenceThreshold: 0.75,
    onPhase: (update) => {
      phases.push(update);
    },
  });

  assert(
    phases.map(({ phase, round }) => `${phase}:${round}`).join(",") ===
      "sealed:1,debate:2,debate:3,final:4",
    `A fresh ${kind} must receive another public debate round even when stance alignment already exceeds the threshold.`,
  );
  assert(signalVisibleInNextRound, `Peers must actually receive the fresh ${kind} in the next debate snapshot.`);
}

function freshSignal(
  kind: Extract<CouncilEventKind, "challenge" | "evidence" | "revision" | "question" | "uncertain">,
  context: CouncilContext,
): CouncilContribution {
  if (kind === "challenge") {
    const peer = context.publicEvents.find((event) => event.actorId !== context.participant.id);
    if (!peer) throw new Error("Challenge test requires a peer event.");
    return { kind, targetEventId: peer.id, content: "Fresh challenge requires a response." };
  }
  if (kind === "evidence") {
    return {
      kind,
      claim: "Fresh evidence",
      content: "A new evidence item entered the shared room.",
      source: "https://example.com/evidence",
      confidence: 0.9,
    };
  }
  if (kind === "revision") {
    const own = context.ownEvents.find((event) => event.kind === "argument");
    if (!own) throw new Error("Revision test requires an own prior argument.");
    return {
      kind,
      previousEventId: own.id,
      stance: "A",
      content: "I revised the reasoning while keeping the same normalized stance.",
      confidence: 0.9,
    };
  }
  if (kind === "question") {
    return { kind, content: "A fresh open question remains unanswered." };
  }
  return { kind, content: "Material uncertainty remains unresolved.", confidence: 0 };
}
