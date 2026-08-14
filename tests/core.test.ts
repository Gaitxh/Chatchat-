import { Blackboard } from "../src/core/blackboard.js";
import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
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

let roundThreeSawNewEvidence = false;
const evidencePhaseUpdates: CouncilPhaseUpdate[] = [];

function evidenceFollowUpAgent(id: string, emitsEvidence: boolean): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance: "A", content: "Initial A", confidence: 0.8 }];
      }
      if (context.phase === "debate" && context.round === 2 && emitsEvidence) {
        return [{
          kind: "evidence",
          claim: "A newly surfaced fact may change how the shared position should be evaluated.",
          content: "New evidence entered after every participant had already received the round-two snapshot.",
          confidence: 0.75,
        }];
      }
      if (context.phase === "debate" && context.round === 3) {
        if (context.publicEvents.some((event) => event.kind === "evidence" && event.round === 2)) {
          roundThreeSawNewEvidence = true;
        }
        return [];
      }
      if (context.phase === "debate") return [];
      return [{ kind: "final_position", stance: "A", content: "Final A", confidence: 0.85 }];
    },
  };
}

const evidenceCouncil = new CouncilOrchestrator([
  evidenceFollowUpAgent("e1", true),
  evidenceFollowUpAgent("e2", false),
  evidenceFollowUpAgent("e3", false),
  evidenceFollowUpAgent("e4", false),
]);

await evidenceCouncil.run("majority must not end the meeting before peers see new evidence", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase: (update) => {
    evidencePhaseUpdates.push(update);
  },
});

assert(
  evidencePhaseUpdates.map(({ phase, round }) => `${phase}:${round}`).join(",") ===
    "sealed:1,debate:2,debate:3,final:4",
  "Fresh evidence in a converged batch must receive one peer-visible follow-up round before Final.",
);
assert(
  roundThreeSawNewEvidence,
  "The follow-up round must actually receive the evidence published by the previous immutable batch.",
);

const calmPhaseUpdates: CouncilPhaseUpdate[] = [];
const calmCouncil = new CouncilOrchestrator([
  agent("c1", "A", "A"),
  agent("c2", "A", "A"),
  agent("c3", "A", "A"),
]);
await calmCouncil.run("stable alignment can still stop adaptively", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase: (update) => {
    calmPhaseUpdates.push(update);
  },
});
assert(
  calmPhaseUpdates.map(({ phase, round }) => `${phase}:${round}`).join(",") ===
    "sealed:1,debate:2,final:3",
  "A converged round with no fresh peer-relevant signal should still stop adaptively.",
);

console.log("✓ ChatChat council-core tests passed");
