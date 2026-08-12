import { Blackboard } from "../src/core/blackboard.js";
import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
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

const { report } = await council.run("test", {
  maxRounds: 2,
  minDebateRounds: 1,
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

console.log("✓ ChatChat council-core tests passed");
