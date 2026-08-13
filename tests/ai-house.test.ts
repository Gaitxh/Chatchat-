import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import {
  deriveHouseSummary,
  expandDelegationPlan,
  MAX_DELEGATION_SEATS,
  MAX_HOUSE_SEATS,
} from "../src/house/delegations.js";
import { createMockHouse, MOCK_HOUSE_PLAN } from "../src/providers/mock-house.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const descriptors = expandDelegationPlan(MOCK_HOUSE_PLAN);
assert(descriptors.length === 16, "The deterministic House plan should create 16 unique delegates.");
assert(new Set(descriptors.map((item) => item.actorId)).size === 16, "Every House delegate actor id must be unique.");
assert(descriptors[0]?.displayName.includes("01"), "Seat display names should expose the delegate number.");

let rejectedOversizedDelegation = false;
try {
  expandDelegationPlan([
    { id: "too-many", name: "Too Many", provider: "mock", seats: MAX_DELEGATION_SEATS + 1 },
  ]);
} catch {
  rejectedOversizedDelegation = true;
}
assert(rejectedOversizedDelegation, "A single delegation above the configured seat cap must be rejected.");

let rejectedOversizedHouse = false;
try {
  expandDelegationPlan(
    Array.from({ length: 5 }, (_, index) => ({
      id: `big-${index}`,
      name: `Big ${index}`,
      provider: `mock-${index}`,
      seats: MAX_DELEGATION_SEATS,
    })),
  );
} catch {
  rejectedOversizedHouse = true;
}
assert(rejectedOversizedHouse, `A House above ${MAX_HOUSE_SEATS} seats must be rejected.`);

const agents = createMockHouse();
const result = await new CouncilOrchestrator(agents).run(
  "Should ChatChat prefer Tauri or Electron for its local-first desktop shell?",
  {
    maxRounds: 3,
    minDebateRounds: 2,
    convergenceThreshold: 0.9,
  },
);
const house = deriveHouseSummary(result.report);

assert(house.seatCount === 16, "The completed Mock House should preserve all 16 final seats.");
assert(house.delegationCount === 4, "The House should contain four model delegations.");
assert(house.seatMajority.stance === "tauri", "Tauri should win the raw seat majority in the scripted House.");
assert(house.seatMajority.support === 11, "The final scripted House should have 11 Tauri seats.");
assert(house.seatMajority.total === 16, "Seat majority denominator should be every delegate.");
assert(Math.abs(house.seatMajority.ratio - 11 / 16) < 0.0001, "Seat majority ratio should be 11/16.");

assert(house.delegationConsensus.stance === "tauri", "Tauri should also win the delegation-level vote.");
assert(house.delegationConsensus.support === 3, "Three delegations should have an unambiguous Tauri plurality.");
assert(house.delegationConsensus.total === 4, "Delegation consensus denominator must include the split delegation.");
assert(Math.abs(house.delegationConsensus.ratio - 0.75) < 0.0001, "Delegation consensus should be 3/4, not a misleading 3/3 100%.");
assert(house.splitDelegations === 1, "DeepSeek should finish split 2-2.");

const deepSeek = house.delegations.find((delegation) => delegation.id === "deepseek");
assert(deepSeek?.split, "DeepSeek's 2-2 delegation should be explicitly marked split.");
assert(deepSeek?.pluralityStance === null, "A tied delegation must not invent a plurality stance.");
assert(deepSeek?.discipline === 0, "A tied delegation should not claim one side as the disciplined majority.");

const gpt = house.delegations.find((delegation) => delegation.id === "gpt");
assert(gpt?.pluralityStance === "tauri", "GPT delegation plurality should be Tauri.");
assert(Math.abs((gpt?.discipline ?? 0) - 0.75) < 0.0001, "GPT delegation discipline should be 75%.");
assert(gpt?.rebelIds.includes("gpt::seat-03"), "GPT-03 should be visible as a delegation dissenter rather than erased.");

const tauriCaucus = house.caucuses.find((caucus) => caucus.key === "tauri");
const electronCaucus = house.caucuses.find((caucus) => caucus.key === "electron");
assert(tauriCaucus?.seats === 11, "The emergent Tauri caucus should contain 11 delegates.");
assert(electronCaucus?.seats === 5, "The emergent Electron caucus should contain 5 delegates.");
assert(
  Object.keys(tauriCaucus?.delegationBreakdown ?? {}).length === 4,
  "The Tauri caucus should cross all four model delegations rather than being a provider party.",
);

const revisions = result.blackboard.events.filter((event) => event.kind === "revision");
assert(revisions.length === 2, "Two scripted delegates should cross the aisle through explicit revision events.");
assert(
  revisions.every((event) => event.causedBy?.length === 1),
  "Every scripted aisle-crossing should retain a causal Blackboard event id.",
);

console.log("✓ ChatChat AI House delegation/caucus tests passed");
