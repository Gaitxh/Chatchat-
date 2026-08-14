import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilParticipantTurnUpdate,
} from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

let releaseSealed!: () => void;
const sealedGate = new Promise<void>((resolve) => { releaseSealed = resolve; });
const updates: CouncilParticipantTurnUpdate[] = [];
const participants = ["alpha", "beta", "gamma"];

function lifecycleAgent(id: string): CouncilAgent {
  return {
    participant: { id, name: id.toUpperCase(), provider: `provider-${id}` },
    async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        await sealedGate;
        return [{
          kind: "argument",
          stance: id === "beta" ? "B" : "A",
          content: `${id} independent view`,
          confidence: 0.7,
        }];
      }
      if (context.phase === "debate") return [];
      return [{
        kind: "final_position",
        stance: "A",
        content: `${id} final position`,
        confidence: 0.8,
      }];
    },
  };
}

const orchestrator = new CouncilOrchestrator(participants.map(lifecycleAgent));
const runPromise = orchestrator.run("lifecycle", {
  maxRounds: 2,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onParticipantTurn: (update) => {
    updates.push({
      ...update,
      participant: { ...update.participant },
      ...(update.contributionKinds ? { contributionKinds: [...update.contributionKinds] } : {}),
    });
  },
});

await new Promise((resolve) => setTimeout(resolve, 0));
const sealedWorking = updates.filter((update) => update.phase === "sealed" && update.state === "working");
assert(sealedWorking.length === 3, "All sealed participants must become visibly working before the shared gate is released.");
assert(
  sealedWorking.map((update) => update.participant.id).sort().join(",") === participants.join(","),
  "The live lifecycle must identify every equal participant independently.",
);
assert(
  !updates.some((update) => update.phase === "sealed" && update.state === "completed"),
  "No participant may be shown as completed before its real response resolves.",
);

releaseSealed();
await runPromise;

for (const participantId of participants) {
  const sealedCompleted = updates.find((update) =>
    update.participant.id === participantId
    && update.phase === "sealed"
    && update.round === 1
    && update.state === "completed");
  assert(sealedCompleted, `${participantId} must emit a sealed completion lifecycle update.`);
  assert(
    sealedCompleted.contributionKinds?.join(",") === "argument",
    `${participantId} sealed completion must report the declared structured argument action.`,
  );

  const finalCompleted = updates.find((update) =>
    update.participant.id === participantId
    && update.phase === "final"
    && update.state === "completed");
  assert(finalCompleted, `${participantId} must emit a final completion lifecycle update.`);
  assert(
    finalCompleted.contributionKinds?.join(",") === "final_position",
    `${participantId} final completion must report final_position rather than inferred prose activity.`,
  );
}

const failedUpdates: CouncilParticipantTurnUpdate[] = [];
const failingCouncil = new CouncilOrchestrator([
  {
    participant: { id: "ok", name: "OK", provider: "test" },
    async respond(context) {
      if (context.phase === "sealed") return [{ kind: "argument", stance: "A", content: "ok", confidence: 0.7 }];
      if (context.phase === "debate") return [];
      return [{ kind: "final_position", stance: "A", content: "ok", confidence: 0.8 }];
    },
  },
  {
    participant: { id: "boom", name: "BOOM", provider: "test" },
    async respond() {
      throw new Error("synthetic turn failure");
    },
  },
]);

let rejected = false;
try {
  await failingCouncil.run("failure lifecycle", {
    maxRounds: 2,
    onParticipantTurn: (update) => { failedUpdates.push(update); },
  });
} catch {
  rejected = true;
}
assert(rejected, "A real participant failure should still reject the consultation as before.");
assert(
  failedUpdates.some((update) => update.participant.id === "boom" && update.state === "failed"),
  "The live lifecycle must surface a real failed participant turn without inventing a contribution.",
);

console.log("✓ ChatChat participant turn lifecycle tests passed");
console.log("✓ Parallel working state is observable without changing deliberation authority or fabricating actions");
