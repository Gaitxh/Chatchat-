import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilEvent,
  CouncilPhaseUpdate,
} from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const phaseUpdates: CouncilPhaseUpdate[] = [];
const published: CouncilEvent[] = [];
let challengeId = "";
let roundFourSawPendingChallenge = false;

const answeringCouncil = new CouncilOrchestrator([
  rebuttalAgent("alice", "bob", true),
  rebuttalAgent("bob", "alice", false),
]);

const { report: answeredReport } = await answeringCouncil.run(
  "Should a direct challenge be allowed to disappear if the target ignores it?",
  {
    maxRounds: 5,
    minDebateRounds: 1,
    convergenceThreshold: 1,
    onPhase: (update) => { phaseUpdates.push(update); },
    onEvent: (event) => {
      published.push(event);
      if (event.kind === "challenge" && event.actorId === "bob") challengeId = event.id;
    },
  },
);

assert(challengeId.length > 0, "Bob must publish a direct round-two challenge against Alice's sealed position.");
assert(
  phaseUpdates.map(({ phase, round }) => `${phase}:${round}`).join(",")
    === "sealed:1,debate:2,debate:3,debate:4,final:5",
  "Ignoring a direct challenge in round three must force a fourth public debate round before Final.",
);
const roundFour = phaseUpdates.find((update) => update.phase === "debate" && update.round === 4);
assert(roundFour?.reason === "fresh_signal_follow_up", "A pending direct response debt should be represented as a concrete peer follow-up reason.");
assert(roundFour?.triggerEventIds?.includes(challengeId), "The exact unanswered challenge id must be the round-four trigger receipt, even though it is older than the calm round-three batch.");
assert(roundFourSawPendingChallenge, "Alice's round-four immutable snapshot must still contain the challenge she ignored in round three.");
const defense = published.find((event) => event.kind === "defense" && event.actorId === "alice");
assert(defense?.kind === "defense" && defense.targetEventId === challengeId, "Alice must close the obligation by explicitly defending against the exact challenge event.");
assert(answeredReport.stopReason === "stable_alignment_no_new_signal", "Once the direct receipt closes and the aligned batch is calm, the meeting may stop normally.");
assert(!answeredReport.unansweredDirectRequestEventIds?.length, "A successfully defended minority/majority position must leave no direct response debt in the final report.");

let ignoredChallengeId = "";
const budgetCouncil = new CouncilOrchestrator([
  neverAnsweringAgent("alice", "bob"),
  neverAnsweringAgent("bob", "alice"),
]);
const { report: budgetReport } = await budgetCouncil.run(
  "What should the report say if the round budget expires before a named challenge is answered?",
  {
    maxRounds: 3,
    minDebateRounds: 1,
    convergenceThreshold: 1,
    onEvent: (event) => {
      if (event.kind === "challenge" && event.actorId === "bob") ignoredChallengeId = event.id;
    },
  },
);
assert(ignoredChallengeId.length > 0, "Budget-limited scenario must also create a direct challenge.");
assert(budgetReport.stopReason === "round_budget", "Round budget remains a hard bound even when direct response debt is still pending.");
assert(
  budgetReport.unansweredDirectRequestEventIds?.includes(ignoredChallengeId) === true,
  "If the hard budget ends first, the final report must expose the exact unanswered direct request instead of implying it was resolved.",
);

console.log("✓ ChatChat direct rebuttal orchestrator tests passed");
console.log("✓ Named challenges persist as automatic agenda obligations until an explicit response receipt closes them or the hard round budget is exhausted");

function rebuttalAgent(id: "alice" | "bob", peerId: "alice" | "bob", answersOnRoundFour: boolean): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance: "A", content: `${id} initially supports A.`, confidence: .82 }];
      }
      if (context.phase === "final") {
        return [{ kind: "final_position", stance: "A", content: `${id} final A.`, confidence: .86 }];
      }

      const peerSealed = context.publicEvents.find((event) =>
        event.round === 1 && event.actorId === peerId && event.kind === "argument",
      );
      if (!peerSealed) throw new Error(`${id} could not see ${peerId}'s sealed public position in debate.`);

      if (context.round === 2) {
        if (id === "bob") {
          return [{
            kind: "challenge",
            targetEventId: peerSealed.id,
            content: "Alice has not explained why an unanswered direct challenge may safely disappear.",
          }];
        }
        return [{ kind: "support", targetEventId: peerSealed.id, content: "Alice acknowledges Bob's base position but does not answer a challenge that has not been published yet." }];
      }

      const challenge = context.publicEvents.find((event) => event.kind === "challenge" && event.actorId === "bob");
      if (id === "alice" && context.round === 4 && answersOnRoundFour) {
        if (!challenge) throw new Error("Alice's round-four snapshot lost Bob's pending challenge.");
        roundFourSawPendingChallenge = true;
        return [{
          kind: "defense",
          targetEventId: challenge.id,
          content: "A direct challenge remains pending until I explicitly answer it; defending my position closes the receipt without requiring me to concede.",
        }];
      }

      // Round three is intentionally calm and intentionally ignores the challenge.
      // Without the receipt ledger the old adaptive stop rule would finalize here.
      return [{ kind: "support", targetEventId: peerSealed.id, content: `${id} emits no new peer-follow-up signal in round ${context.round}.` }];
    },
  };
}

function neverAnsweringAgent(id: "alice" | "bob", peerId: "alice" | "bob"): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(context: CouncilContext): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance: "A", content: `${id} initial A.`, confidence: .8 }];
      }
      if (context.phase === "final") {
        return [{ kind: "final_position", stance: "A", content: `${id} final A with unresolved process debt.`, confidence: .8 }];
      }
      const peerSealed = context.publicEvents.find((event) =>
        event.round === 1 && event.actorId === peerId && event.kind === "argument",
      );
      if (!peerSealed) throw new Error(`${id} cannot locate peer sealed position.`);
      if (context.round === 2 && id === "bob") {
        return [{
          kind: "challenge",
          targetEventId: peerSealed.id,
          content: "This direct challenge will intentionally remain unanswered through the debate budget.",
        }];
      }
      return [{ kind: "support", targetEventId: peerSealed.id, content: `${id} stays calm and does not close Alice's direct debt.` }];
    },
  };
}
