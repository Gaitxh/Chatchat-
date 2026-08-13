import { detectProvider, delegationId } from "../extension/catalog.js";
import { buildCouncilPrompt, parseCouncilResponse, runCouncil } from "../extension/council.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const yuanbao = detectProvider(
  "https://yuanbao.tencent.com/chat/example-room/example-session",
);
assert(yuanbao.id === "tencent-yuanbao", "Yuanbao should be recognized by host.");
assert(delegationId(yuanbao) === "delegation:tencent-yuanbao", "Known providers should get stable delegation ids.");

const custom = detectProvider("https://ai.example.test/new-chat");
assert(custom.kind === "custom", "Unknown AI sites should remain usable as custom delegations.");

const parseContext = {
  phase: "sealed",
  round: 1,
  actorId: "seat-a",
  publicEvents: [],
  ownEvents: [],
  question: "test",
};
const parsed = parseCouncilResponse(
  '<CHATCHAT_COUNCIL_JSON>{"contributions":[{"kind":"argument","stance":"A","content":"x","confidence":0.7}]}</CHATCHAT_COUNCIL_JSON>',
  parseContext,
);
assert(parsed[0]?.kind === "argument", "Extension parser should accept the strict Council envelope.");

let rejectedUnknownTarget = false;
try {
  parseCouncilResponse(
    '<CHATCHAT_COUNCIL_JSON>{"contributions":[{"kind":"challenge","targetEventId":"missing","content":"x"}]}</CHATCHAT_COUNCIL_JSON>',
    { ...parseContext, phase: "debate", publicEvents: [] },
  );
} catch {
  rejectedUnknownTarget = true;
}
assert(rejectedUnknownTarget, "Extension parser must reject invented Blackboard event ids.");

const advisors = [
  advisor("gpt-1", "GPT-1", "openai-chatgpt", "gpt", "GPT"),
  advisor("gpt-2", "GPT-2", "openai-chatgpt", "gpt", "GPT"),
  advisor("qwen-1", "Qwen-1", "alibaba-tongyi", "qwen", "Qwen"),
  advisor("qwen-2", "Qwen-2", "alibaba-tongyi", "qwen", "Qwen"),
];

const seen = [];
const report = await runCouncil({
  advisors,
  question: "Tauri or Electron?",
  sendTurn: async (advisor, prompt) => {
    const phase = line(prompt, "PHASE: ");
    const events = JSON.parse(line(prompt, "COUNCIL_EVENTS_JSON: "));
    seen.push({ actorId: advisor.id, phase, ids: events.map((event) => event.id) });

    if (phase === "sealed") {
      assert(events.length === 0, "Every sealed seat must see an empty public Blackboard.");
      const stance = advisor.id === "gpt-2" ? "Electron" : "Tauri";
      return envelope({ kind: "argument", stance, content: `${advisor.name} sealed`, confidence: 0.7 });
    }

    if (phase === "debate") {
      const target = events.find((event) => event.actorId !== advisor.id && event.kind === "argument");
      return envelope({
        kind: "challenge",
        targetEventId: target.id,
        content: `${advisor.name} challenges a peer`,
      });
    }

    const stance = advisor.id === "gpt-2" ? "Electron" : "Tauri";
    return envelope({
      kind: "final_position",
      stance,
      content: `${advisor.name} final`,
      confidence: 0.8,
      caveats: [],
    });
  },
});

const sealedSeen = seen.filter((item) => item.phase === "sealed");
assert(sealedSeen.length === advisors.length, "All seats should complete an independent sealed turn.");
assert(sealedSeen.every((item) => item.ids.length === 0), "No same-provider seat may see another seat during Round 1.");

const debateSeen = seen.filter((item) => item.phase === "debate");
const canonicalSnapshot = JSON.stringify(debateSeen[0]?.ids ?? []);
assert(
  debateSeen.every((item) => JSON.stringify(item.ids) === canonicalSnapshot),
  "Every seat in the same open-council round must receive the exact same Blackboard snapshot.",
);

assert(report.positions.length === 4, "Every seat should submit a final position.");
assert(report.consensusStance === "Tauri", "Three of four independent seats should produce the Tauri majority.");
assert(Math.abs(report.consensusRatio - 0.75) < 1e-9, "House vote should report a 75% overall consensus.");

const gpt = report.delegationSummary.find((group) => group.delegationId === "gpt");
const qwen = report.delegationSummary.find((group) => group.delegationId === "qwen");
assert(gpt?.seats === 2, "GPT delegation should contain two independent seats.");
assert(gpt?.cohesion === 0.5, "A 1-1 GPT split should produce 50% delegation cohesion, not forced party unity.");
assert(qwen?.cohesion === 1, "Two matching Qwen seats should produce 100% cohesion after the fact.");

const prompt = buildCouncilPrompt({
  phase: "sealed",
  round: 1,
  actorId: "gpt-1",
  publicEvents: [],
  ownEvents: [],
  question: "test",
});
assert(
  prompt.includes("Do not assume your delegation should vote together"),
  "The protocol must explicitly reject provider/delegation herd behavior.",
);

console.log("✓ ChatChat browser-extension Council/House tests passed");

function advisor(id, name, providerId, groupId, groupName) {
  return {
    id,
    name,
    providerId,
    delegationId: groupId,
    delegationName: groupName,
    recipe: {},
    tabId: 1,
  };
}

function envelope(contribution) {
  return `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [contribution] })}</CHATCHAT_COUNCIL_JSON>`;
}

function line(prompt, prefix) {
  const match = prompt.split("\n").find((item) => item.startsWith(prefix));
  if (!match) throw new Error(`Missing prompt line: ${prefix}`);
  return match.slice(prefix.length);
}
