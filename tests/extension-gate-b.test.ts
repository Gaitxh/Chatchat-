import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import { createEmptyAdapterRecipe } from "../src/provider-sdk/recipe.js";
import {
  captureBrowserHouseProviderProof,
  seatStillOnProviderOrigin,
} from "../src/extension/gate-b.js";
import { buildGateBProofPack, gateBProofJson } from "../src/validation/proof-pack.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const chatgptSeat = {
  seatId: "extension:openai-chatgpt:101",
  providerId: "openai-chatgpt",
  origin: "https://chatgpt.com",
};
const deepseekSeat = {
  seatId: "extension:deepseek-chat:102",
  providerId: "deepseek-chat",
  origin: "https://chat.deepseek.com",
};

const recipes = {
  [chatgptSeat.origin]: {
    ...createEmptyAdapterRecipe(chatgptSeat.origin, "2026-08-13T00:00:00.000Z"),
    composerSelector: "#PRIVATE_CHATGPT_COMPOSER",
    sendSelector: "#PRIVATE_CHATGPT_SEND",
    responseSelector: "#PRIVATE_CHATGPT_RESPONSE",
  },
  [deepseekSeat.origin]: {
    ...createEmptyAdapterRecipe(deepseekSeat.origin, "2026-08-13T00:00:00.000Z"),
    composerSelector: "#PRIVATE_DEEPSEEK_COMPOSER",
    sendSelector: "#PRIVATE_DEEPSEEK_SEND",
    responseSelector: "#PRIVATE_DEEPSEEK_RESPONSE",
  },
};

const tests = {
  [chatgptSeat.seatId]: "pass" as const,
  [deepseekSeat.seatId]: "pass" as const,
};
const gates = {
  [chatgptSeat.seatId]: "pass" as const,
  [deepseekSeat.seatId]: "pass" as const,
};

const providerProof = captureBrowserHouseProviderProof({
  seats: [chatgptSeat, deepseekSeat],
  recipes,
  tests,
  gates,
  providerHostSeatIds: [chatgptSeat.seatId, deepseekSeat.seatId],
});
assert(providerProof.length === 2, "Two Browser House participants should become two Provider proof rows.");
assert(providerProof.every((row) => row.adapterId === "extension.tab"), "Browser proof rows should identify extension.tab transport.");
assert(providerProof[0]?.host === "chatgpt.com", "Proof should preserve host only, not tab paths.");
assert(providerProof.every((row) => row.providerHostHealthy), "Both healthy provider tabs should be marked healthy.");

assert(seatStillOnProviderOrigin("https://chatgpt.com", "https://chatgpt.com/c/private") === true, "Same Provider origin should remain healthy after Council navigation.");
assert(seatStillOnProviderOrigin("https://chatgpt.com", "https://auth.openai.com/login") === false, "Auth/external origin must not count as Provider-host healthy.");
assert(seatStillOnProviderOrigin("https://chatgpt.com", "chrome://settings") === false, "Non-http(s) pages are never Provider-host healthy.");

const events: CouncilEvent[] = [
  {
    id: "event-chatgpt-argument",
    sessionId: "session-browser-gate-b-private",
    round: 1,
    actorId: chatgptSeat.seatId,
    kind: "argument",
    stance: "A",
    content: "PRIVATE CHATGPT ANSWER",
    confidence: 0.72,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "event-deepseek-argument",
    sessionId: "session-browser-gate-b-private",
    round: 1,
    actorId: deepseekSeat.seatId,
    kind: "argument",
    stance: "B",
    content: "PRIVATE DEEPSEEK ANSWER",
    confidence: 0.71,
    createdAt: "2026-08-13T00:00:01.000Z",
  },
  {
    id: "event-deepseek-challenge",
    sessionId: "session-browser-gate-b-private",
    round: 2,
    actorId: deepseekSeat.seatId,
    kind: "challenge",
    targetEventId: "event-chatgpt-argument",
    content: "PRIVATE CHALLENGE",
    createdAt: "2026-08-13T00:00:02.000Z",
  },
  {
    id: "event-chatgpt-revision",
    sessionId: "session-browser-gate-b-private",
    round: 2,
    actorId: chatgptSeat.seatId,
    kind: "revision",
    previousEventId: "event-chatgpt-argument",
    stance: "B",
    content: "PRIVATE REVISION",
    confidence: 0.8,
    causedBy: ["event-deepseek-challenge"],
    createdAt: "2026-08-13T00:00:03.000Z",
  },
  {
    id: "event-chatgpt-final",
    sessionId: "session-browser-gate-b-private",
    round: 3,
    actorId: chatgptSeat.seatId,
    kind: "final_position",
    stance: "B",
    content: "PRIVATE FINAL A",
    confidence: 0.82,
    caveats: [],
    createdAt: "2026-08-13T00:00:04.000Z",
  },
  {
    id: "event-deepseek-final",
    sessionId: "session-browser-gate-b-private",
    round: 3,
    actorId: deepseekSeat.seatId,
    kind: "final_position",
    stance: "B",
    content: "PRIVATE FINAL B",
    confidence: 0.84,
    caveats: [],
    createdAt: "2026-08-13T00:00:05.000Z",
  },
];

const report: CouncilReport = {
  sessionId: "session-browser-gate-b-private",
  question: "PRIVATE KING QUESTION",
  consensusStance: "B",
  consensusRatio: 1,
  confidence: 0.83,
  rounds: 3,
  positions: [
    {
      participant: {
        id: chatgptSeat.seatId,
        name: "PRIVATE CHATGPT TAB NAME",
        provider: chatgptSeat.providerId,
        role: "Browser Tab Delegate",
      },
      stance: "B",
      content: "PRIVATE POSITION A",
      confidence: 0.82,
      caveats: [],
    },
    {
      participant: {
        id: deepseekSeat.seatId,
        name: "PRIVATE DEEPSEEK TAB NAME",
        provider: deepseekSeat.providerId,
        role: "Browser Tab Delegate",
      },
      stance: "B",
      content: "PRIVATE POSITION B",
      confidence: 0.84,
      caveats: [],
    },
  ],
  disagreements: [],
  eventCount: events.length,
};

const pack = buildGateBProofPack({
  providers: providerProof,
  report,
  events,
  mode: "live",
  chatChatVersion: "0.9.0",
  environment: "Chromium Side Panel · Linux",
  generatedAt: "2026-08-13T00:01:00.000Z",
});
assert(pack.verdict === "gate-b-candidate", "A clean two-provider Browser House Council should satisfy the same Gate B candidate rule.");
const exported = gateBProofJson(pack);
for (const secret of [
  "PRIVATE KING QUESTION",
  "PRIVATE CHATGPT ANSWER",
  "PRIVATE DEEPSEEK ANSWER",
  "PRIVATE_CHATGPT_COMPOSER",
  "PRIVATE_DEEPSEEK_COMPOSER",
  "PRIVATE CHATGPT TAB NAME",
]) {
  assert(!exported.includes(secret), `Browser proof export must not leak ${secret}.`);
}

const offHostProof = captureBrowserHouseProviderProof({
  seats: [chatgptSeat, deepseekSeat],
  recipes,
  tests,
  gates,
  providerHostSeatIds: [chatgptSeat.seatId],
});
const offHostPack = buildGateBProofPack({
  providers: offHostProof,
  report,
  events,
  mode: "live",
  chatChatVersion: "0.9.0",
  environment: "Chromium",
});
assert(offHostPack.verdict === "incomplete", "One off-host Browser tab must fail closed rather than qualify as Gate B candidate evidence.");

const missingProviderRowPack = buildGateBProofPack({
  providers: providerProof.slice(0, 1),
  report,
  events,
  mode: "live",
  chatChatVersion: "0.9.0",
  environment: "Chromium",
});
assert(
  missingProviderRowPack.verdict === "incomplete",
  "A Gate B candidate must freeze one Provider proof row for every real Council participant.",
);

console.log("✓ ChatChat Browser House Gate B proof tests passed");
