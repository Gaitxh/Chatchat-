import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import {
  buildGateBProofPack,
  captureProviderProofSnapshot,
  gateBProofJson,
  gateBProofMarkdown,
} from "../src/validation/proof-pack.js";
import type {
  AdapterRecipe,
  AdapterSpeechResult,
  CouncilBridgeVerificationResult,
  ProviderProfile,
} from "../src/provider-sdk/index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const profileA = provider(
  "provider-a",
  "openai-chatgpt",
  "web.chatgpt",
  "https://chatgpt.com",
  "PRIVATE DISPLAY NAME A",
  "PRIVATE_PROFILE_KEY_A",
);
const profileB = provider(
  "provider-b",
  "anthropic-claude",
  "web.claude",
  "https://claude.ai",
  "PRIVATE DISPLAY NAME B",
  "PRIVATE_PROFILE_KEY_B",
);

const recipes: Record<string, AdapterRecipe> = {
  [profileA.profileId]: recipe(profileA.profileId, "SECRET_SELECTOR_A"),
  [profileB.profileId]: recipe(profileB.profileId, "SECRET_SELECTOR_B"),
};
const speechResults: Record<string, AdapterSpeechResult> = {
  [profileA.profileId]: speech("PRIVATE REAL RESPONSE A"),
  [profileB.profileId]: speech("PRIVATE REAL RESPONSE B"),
};
const bridgeResults: Record<string, CouncilBridgeVerificationResult> = {
  [profileA.profileId]: { ok: true, contributionCount: 1, elapsedMs: 1000 },
  [profileB.profileId]: { ok: true, contributionCount: 1, elapsedMs: 1200 },
};

const providerSnapshot = captureProviderProofSnapshot({
  profiles: [profileA, profileB],
  recipes,
  speechResults,
  bridgeResults,
  providerHostProfileIds: [profileA.profileId, profileB.profileId],
});
assert(providerSnapshot.length === 2, "Two seated real providers should be frozen into the proof snapshot.");
assert(providerSnapshot[0]?.host === "chatgpt.com", "Only the public Provider host should survive snapshotting.");

const events: CouncilEvent[] = [
  {
    id: "event-a-argument",
    sessionId: "session-private-fingerprint-1234567890",
    round: 1,
    actorId: profileA.profileId,
    kind: "argument",
    stance: "A",
    content: "PRIVATE EVENT BODY A",
    confidence: 0.7,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "event-b-argument",
    sessionId: "session-private-fingerprint-1234567890",
    round: 1,
    actorId: profileB.profileId,
    kind: "argument",
    stance: "B",
    content: "PRIVATE EVENT BODY B",
    confidence: 0.7,
    createdAt: "2026-08-13T00:00:01.000Z",
  },
  {
    id: "event-b-challenge",
    sessionId: "session-private-fingerprint-1234567890",
    round: 2,
    actorId: profileB.profileId,
    kind: "challenge",
    targetEventId: "event-a-argument",
    content: "PRIVATE CHALLENGE BODY",
    createdAt: "2026-08-13T00:00:02.000Z",
  },
  {
    id: "event-a-revision",
    sessionId: "session-private-fingerprint-1234567890",
    round: 2,
    actorId: profileA.profileId,
    kind: "revision",
    previousEventId: "event-a-argument",
    stance: "B",
    content: "PRIVATE REVISION BODY",
    confidence: 0.8,
    causedBy: ["event-b-challenge"],
    createdAt: "2026-08-13T00:00:03.000Z",
  },
  {
    id: "event-a-final",
    sessionId: "session-private-fingerprint-1234567890",
    round: 3,
    actorId: profileA.profileId,
    kind: "final_position",
    stance: "B",
    content: "PRIVATE FINAL BODY A",
    confidence: 0.82,
    caveats: ["PRIVATE CAVEAT A"],
    createdAt: "2026-08-13T00:00:04.000Z",
  },
  {
    id: "event-b-final",
    sessionId: "session-private-fingerprint-1234567890",
    round: 3,
    actorId: profileB.profileId,
    kind: "final_position",
    stance: "B",
    content: "PRIVATE FINAL BODY B",
    confidence: 0.84,
    caveats: [],
    createdAt: "2026-08-13T00:00:05.000Z",
  },
];

const report: CouncilReport = {
  sessionId: "session-private-fingerprint-1234567890",
  question: "PRIVATE KING QUESTION THAT MUST NEVER EXPORT",
  consensusStance: "B",
  consensusRatio: 1,
  confidence: 0.83,
  rounds: 3,
  positions: [
    {
      participant: {
        id: profileA.profileId,
        name: "PRIVATE DISPLAY NAME A",
        provider: profileA.providerId,
        role: "Real Web Advisor",
      },
      stance: "B",
      content: "PRIVATE POSITION BODY A",
      confidence: 0.82,
      caveats: [],
    },
    {
      participant: {
        id: profileB.profileId,
        name: "PRIVATE DISPLAY NAME B",
        provider: profileB.providerId,
        role: "Real Web Advisor",
      },
      stance: "B",
      content: "PRIVATE POSITION BODY B",
      confidence: 0.84,
      caveats: [],
    },
  ],
  disagreements: [],
  eventCount: events.length,
};

const pack = buildGateBProofPack({
  providers: providerSnapshot,
  report,
  events,
  mode: "live",
  chatChatVersion: "0.9.0",
  environment: "macOS 15.x\nApple Silicon",
  generatedAt: "2026-08-13T00:10:00.000Z",
});
assert(pack.verdict === "gate-b-candidate", "A two-provider three-round real Council should qualify as Gate B candidate evidence.");
assert(pack.environment === "macOS 15.x Apple Silicon", "Environment labels should be flattened to one public line.");
assert(pack.council?.eventKinds.challenge === 1, "Challenge counts should be preserved without challenge text.");
assert(pack.council?.eventKinds.revision === 1, "Revision counts should be preserved without revision text.");
assert(pack.council?.finalPositionCount === 2, "Two real final positions should be counted.");
assert(pack.council?.realEventCount === events.length, "All test events should be recognized as real-provider events.");

const exported = `${gateBProofJson(pack)}\n${gateBProofMarkdown(pack)}`;
for (const secret of [
  "PRIVATE KING QUESTION",
  "PRIVATE EVENT BODY",
  "PRIVATE CHALLENGE BODY",
  "PRIVATE REVISION BODY",
  "PRIVATE FINAL BODY",
  "PRIVATE POSITION BODY",
  "PRIVATE CAVEAT",
  "PRIVATE REAL RESPONSE",
  "SECRET_SELECTOR",
  "PRIVATE_PROFILE_KEY",
  "PRIVATE DISPLAY NAME",
]) {
  assert(!exported.includes(secret), `Proof Pack must not leak ${secret}.`);
}
assert(exported.includes("chatgpt.com"), "Public Provider hosts belong in compatibility evidence.");
assert(exported.includes("openai-chatgpt"), "Provider ids belong in compatibility evidence.");
assert(exported.includes("challenge=1"), "Markdown should expose event-kind counts, not event content.");

const demoPack = buildGateBProofPack({
  providers: [],
  report,
  events,
  mode: "demo",
  chatChatVersion: "0.9.0",
  environment: "Linux",
  generatedAt: "2026-08-13T00:10:00.000Z",
});
assert(demoPack.verdict === "demo-only", "Mock demo evidence must never be represented as Gate B proof.");

console.log("✓ ChatChat Gate B Proof Pack tests passed");

function provider(
  profileId: string,
  providerId: string,
  adapterId: string,
  origin: string,
  displayName: string,
  profileKey: string,
): ProviderProfile {
  return {
    profileId,
    providerId,
    adapterId,
    displayName,
    url: `${origin}/chat`,
    origin,
    profileKey,
    authState: "ready",
    seatState: "seated",
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

function recipe(profileId: string, secret: string): AdapterRecipe {
  return {
    profileId,
    composerSelector: `#composer-${secret}`,
    sendSelector: `#send-${secret}`,
    responseSelector: `#response-${secret}`,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

function speech(responseText: string): AdapterSpeechResult {
  return {
    ok: true,
    responseText,
    elapsedMs: 1000,
    baselineCount: 1,
    responseCount: 2,
    stablePolls: 4,
    truncated: false,
  };
}
