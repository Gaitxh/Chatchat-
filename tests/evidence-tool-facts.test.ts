import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilEvent,
  CouncilToolFact,
} from "../src/core/types.js";
import { buildEvidenceToolFacts } from "../src/evidence/tool-facts.js";
import { buildProviderConsultationPrompt } from "../src/provider-sdk/consultation-protocol.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const evidence: CouncilEvent = {
  id: "evidence-1",
  sessionId: "s",
  round: 2,
  actorId: "gemini",
  kind: "evidence",
  claim: "The browser API supports optional per-origin permissions.",
  content: "A public browser documentation page is supplied.",
  source: "https://example.com/browser-docs",
  sourceDate: "2025-08-01",
  confidence: 0.8,
  createdAt: "2026-08-14T00:00:00Z",
};

const facts = buildEvidenceToolFacts(
  [evidence],
  {
    "evidence-1": {
      state: "reachable",
      observedAt: "2026-08-14T00:00:00Z",
      finalUrl: "https://example.com/browser-docs",
      statusCode: 200,
      title: "Browser docs",
      description: "Documentation for optional permissions.",
      excerpt: "Extensions can request optional access for a site when needed.",
      pageDate: "2025-08-01",
      pageDateKind: "published",
      bodyHash: "sha256:abc123",
      textCharacters: 1234,
    },
  },
);

assert(facts.length === 1, "A checked evidence event should produce one bounded tool fact.");
assert(facts[0]?.sourceState === "reachable", "Reachability should be preserved as a machine observation.");
assert(facts[0]?.contentFingerprint === "sha256:abc123", "Content fingerprint should be preserved.");
assert((facts[0]?.sourceAgeDays ?? 0) > 300, "Date age should be exposed as a neutral age signal.");
assert(/does not prove/i.test(facts[0]?.note ?? ""), "Tool fact must explicitly deny that reachability proves the claim.");

const unavailable = buildEvidenceToolFacts(
  [evidence],
  {
    "evidence-1": {
      state: "unavailable",
      observedAt: "2026-08-14T00:00:00Z",
      error: "timeout",
    },
  },
);
assert(unavailable[0]?.sourceState === "unavailable", "Unavailability should remain a tool observation, not become a false verdict.");
assert(/does not prove/i.test(unavailable[0]?.note ?? ""), "Unavailability must not be described as proof that the claim is false.");

const promptContext: CouncilContext = {
  sessionId: "s",
  question: "Which approach should we choose?",
  phase: "final",
  round: 3,
  participant: { id: "claude", name: "Claude", provider: "anthropic" },
  publicEvents: [evidence],
  ownEvents: [],
  toolFacts: facts,
};
const prompt = buildProviderConsultationPrompt(promptContext);
assert(prompt.includes("TOOL_FACTS_JSON"), "Consultation prompt should expose machine observations separately from peer events.");
assert(prompt.includes("Browser docs"), "Bounded source metadata should reach the next consultation context.");
assert(prompt.includes("does not prove"), "Prompt must preserve the no-truth-verdict boundary.");

const observedByRound = new Map<number, string[][]>();
function agent(id: string): CouncilAgent {
  return {
    participant: { id, name: id, provider: id },
    async respond(context) {
      const current = observedByRound.get(context.round) ?? [];
      current.push((context.toolFacts ?? []).map((fact) => fact.id));
      observedByRound.set(context.round, current);
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance: id, content: `${id} initial`, confidence: 0.6 }];
      }
      if (context.phase === "final") {
        return [{ kind: "final_position", stance: id, content: `${id} final`, confidence: 0.6 }];
      }
      return [{ kind: "question", content: "What should change our view?" }];
    },
  };
}

let providerCalls = 0;
const sharedFact: CouncilToolFact = {
  id: "tool-shared",
  kind: "evidence_source_observation",
  relatedEventId: "evidence-1",
  observedAt: "2026-08-14T00:00:00Z",
  sourceState: "reachable",
  note: "Reachability is not proof.",
};

const orchestrator = new CouncilOrchestrator([agent("a"), agent("b")]);
await orchestrator.run("test", {
  maxRounds: 2,
  minDebateRounds: 1,
  convergenceThreshold: 1,
  toolFactsProvider: () => {
    providerCalls += 1;
    return [sharedFact];
  },
});

assert(providerCalls === 3, "Tool provider should run once per sealed/debate/final round, not once per participant.");
for (const snapshots of observedByRound.values()) {
  assert(snapshots.length === 2, "Both equal participants should receive one context per round.");
  assert(JSON.stringify(snapshots[0]) === JSON.stringify(snapshots[1]), "Every participant in a round must receive the same tool fact snapshot.");
}

console.log("✓ ChatChat shared evidence tool fact tests passed");
