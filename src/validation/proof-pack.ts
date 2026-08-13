import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilReport,
} from "../core/types.js";
import {
  adapterRecipeComplete,
  type AdapterRecipe,
  type AdapterSpeechResult,
  type CouncilBridgeVerificationResult,
  type ProviderProfile,
} from "../provider-sdk/index.js";

export type GateBMode = "demo" | "hybrid" | "live";

export interface ProviderProofSnapshot {
  providerId: string;
  adapterId: string;
  host: string;
  recipeReady: boolean;
  testPassed: boolean;
  councilGatePassed: boolean;
  providerHostHealthy: boolean;
  seated: boolean;
}

export interface GateBProofPack {
  schemaVersion: 1;
  generatedAt: string;
  evidenceCapturedAt: string;
  chatChatVersion: string;
  environment: string;
  verdict: "gate-b-candidate" | "incomplete" | "demo-only";
  providers: ProviderProofSnapshot[];
  council: {
    mode: GateBMode;
    sessionFingerprint: string;
    realParticipantCount: number;
    rounds: number;
    eventCount: number;
    realEventCount: number;
    eventKinds: Record<CouncilEventKind, number>;
    finalPositionCount: number;
    zeroConfidenceFinalCount: number;
    consensusRatio: number;
    minorityOpinionPresent: boolean;
    durationMs: number | null;
  } | null;
  privacy: {
    questionIncluded: false;
    eventTextIncluded: false;
    responseTextIncluded: false;
    selectorsIncluded: false;
    profileKeysIncluded: false;
    credentialsIncluded: false;
  };
}

export interface CaptureProviderProofInput {
  profiles: readonly ProviderProfile[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  speechResults: Readonly<Record<string, AdapterSpeechResult>>;
  bridgeResults: Readonly<Record<string, CouncilBridgeVerificationResult>>;
  providerHostProfileIds: readonly string[];
}

export interface BuildGateBProofPackInput {
  providers: readonly ProviderProofSnapshot[];
  report: CouncilReport | null;
  events: readonly CouncilEvent[];
  mode: GateBMode;
  chatChatVersion: string;
  environment: string;
  generatedAt?: string;
}

const EVENT_KINDS: readonly CouncilEventKind[] = [
  "argument",
  "challenge",
  "evidence",
  "support",
  "defense",
  "revision",
  "concede",
  "question",
  "uncertain",
  "final_position",
];

export function captureProviderProofSnapshot(
  input: CaptureProviderProofInput,
): ProviderProofSnapshot[] {
  const healthy = new Set(input.providerHostProfileIds);
  return input.profiles
    .filter((profile) => profile.seatState === "seated")
    .map((profile) => ({
      providerId: profile.providerId,
      adapterId: profile.adapterId,
      host: safeHost(profile.origin),
      recipeReady: adapterRecipeComplete(input.recipes[profile.profileId]),
      testPassed: Boolean(input.speechResults[profile.profileId]?.ok),
      councilGatePassed:
        profile.authState === "ready" || Boolean(input.bridgeResults[profile.profileId]?.ok),
      providerHostHealthy: healthy.has(profile.profileId),
      seated: profile.seatState === "seated",
    }));
}

export function buildGateBProofPack(
  input: BuildGateBProofPackInput,
): GateBProofPack {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const council = input.report
    ? buildCouncilEvidence(input.report, input.events, input.mode)
    : null;
  const allProviderGates =
    input.providers.length >= 2 &&
    input.providers.every(
      (provider) =>
        provider.recipeReady &&
        provider.testPassed &&
        provider.councilGatePassed &&
        provider.providerHostHealthy &&
        provider.seated,
    );
  const liveCouncilComplete = Boolean(
    council &&
      council.mode === "live" &&
      council.realParticipantCount >= 2 &&
      input.providers.length === council.realParticipantCount &&
      council.finalPositionCount === council.realParticipantCount &&
      council.zeroConfidenceFinalCount === 0 &&
      council.eventKinds.uncertain === 0 &&
      council.realEventCount === council.eventCount &&
      council.rounds >= 3,
  );

  const verdict: GateBProofPack["verdict"] =
    input.mode === "demo"
      ? "demo-only"
      : allProviderGates && liveCouncilComplete
        ? "gate-b-candidate"
        : "incomplete";

  return {
    schemaVersion: 1,
    generatedAt,
    evidenceCapturedAt:
      input.events.at(-1)?.createdAt ?? input.events.at(0)?.createdAt ?? generatedAt,
    chatChatVersion: input.chatChatVersion,
    environment: sanitizeEnvironment(input.environment),
    verdict,
    providers: input.providers.map((provider) => ({ ...provider })),
    council,
    privacy: {
      questionIncluded: false,
      eventTextIncluded: false,
      responseTextIncluded: false,
      selectorsIncluded: false,
      profileKeysIncluded: false,
      credentialsIncluded: false,
    },
  };
}

export function gateBProofMarkdown(pack: GateBProofPack): string {
  const title =
    pack.verdict === "gate-b-candidate"
      ? "✅ Gate B candidate evidence"
      : pack.verdict === "demo-only"
        ? "🎭 Demo-only evidence"
        : "⚠️ Incomplete Gate B evidence";

  const providerRows = pack.providers.length
    ? pack.providers
        .map(
          (provider) =>
            `| ${escapeCell(provider.providerId)} | \`${escapeCell(provider.host)}\` | ${mark(provider.recipeReady)} | ${mark(provider.testPassed)} | ${mark(provider.councilGatePassed)} | ${mark(provider.providerHostHealthy)} | ${mark(provider.seated)} |`,
        )
        .join("\n")
    : "| — | — | — | — | — | — | — |";

  const council = pack.council;
  const eventSummary = council
    ? EVENT_KINDS.map((kind) => `${kind}=${council.eventKinds[kind]}`).join(", ")
    : "none";

  return [
    "## ChatChat Royal Proof Pack",
    "",
    `**${title}**`,
    "",
    `- Schema: \`gate-b-proof/v${pack.schemaVersion}\``,
    `- ChatChat: \`${escapeInline(pack.chatChatVersion)}\``,
    `- Environment: ${escapeInline(pack.environment || "not supplied")}`,
    `- Evidence captured: \`${pack.evidenceCapturedAt}\``,
    `- Exported: \`${pack.generatedAt}\``,
    "",
    "### Provider gates",
    "",
    "| Provider | Host | Recipe 3/3 | Test | Council Gate | Provider Host | Seated |",
    "|---|---|:---:|:---:|:---:|:---:|:---:|",
    providerRows,
    "",
    "### Council evidence",
    "",
    council
      ? [
          `- Mode: **${council.mode.toUpperCase()}**`,
          `- Session fingerprint: \`${council.sessionFingerprint}\``,
          `- Real participants: **${council.realParticipantCount}**`,
          `- Rounds: **${council.rounds}**`,
          `- Events: **${council.eventCount}** total / **${council.realEventCount}** from real advisors`,
          `- Final positions: **${council.finalPositionCount}**`,
          `- Zero-confidence finals: **${council.zeroConfidenceFinalCount}**`,
          `- Consensus ratio: **${Math.round(council.consensusRatio * 100)}%**`,
          `- Minority opinion present: **${council.minorityOpinionPresent ? "yes" : "no"}**`,
          `- Event kinds: \`${eventSummary}\``,
          `- Duration: **${council.durationMs === null ? "unknown" : `${Math.round(council.durationMs / 100) / 10}s`}**`,
        ].join("\n")
      : "- No completed Council attached.",
    "",
    "### Privacy declaration",
    "",
    "This Proof Pack intentionally excludes the King's question, model response text, Blackboard message content, taught selectors, local profile keys, cookies, tokens and credentials.",
    "",
    "> This is environment-specific evidence, not a universal Provider support claim.",
  ].join("\n");
}

export function gateBProofJson(pack: GateBProofPack): string {
  return JSON.stringify(pack, null, 2);
}

export function coarsePlatformHint(userAgent: string): string {
  const value = userAgent.toLocaleLowerCase();
  if (value.includes("windows")) return "Windows";
  if (value.includes("macintosh") || value.includes("mac os")) return "macOS";
  if (value.includes("linux")) return "Linux";
  return "Unknown OS";
}

function buildCouncilEvidence(
  report: CouncilReport,
  events: readonly CouncilEvent[],
  mode: GateBMode,
): NonNullable<GateBProofPack["council"]> {
  const eventKinds = Object.fromEntries(
    EVENT_KINDS.map((kind) => [kind, 0]),
  ) as Record<CouncilEventKind, number>;
  const realPositions = report.positions.filter(
    (position) => position.participant.provider !== "mock",
  );
  const realActorIds = new Set(
    realPositions.map((position) => position.participant.id),
  );

  let realEventCount = 0;
  for (const event of events) {
    eventKinds[event.kind] += 1;
    if (realActorIds.has(event.actorId)) realEventCount += 1;
  }

  const firstTimestamp = parseTimestamp(events.at(0)?.createdAt);
  const lastTimestamp = parseTimestamp(events.at(-1)?.createdAt);
  const durationMs =
    firstTimestamp === null || lastTimestamp === null
      ? null
      : Math.max(0, lastTimestamp - firstTimestamp);

  return {
    mode,
    sessionFingerprint: fingerprint(report.sessionId),
    realParticipantCount: realActorIds.size,
    rounds: report.rounds,
    eventCount: events.length,
    realEventCount,
    eventKinds,
    finalPositionCount: eventKinds.final_position,
    zeroConfidenceFinalCount: realPositions.filter(
      (position) => position.confidence <= 0,
    ).length,
    consensusRatio: report.consensusRatio,
    minorityOpinionPresent: report.disagreements.length > 0,
    durationMs,
  };
}

function safeHost(origin: string): string {
  try {
    return new URL(origin).hostname.toLocaleLowerCase();
  } catch {
    return "invalid-host";
  }
}

function sanitizeEnvironment(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 160);
}

function fingerprint(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return compact.slice(-12) || "unknown";
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mark(value: boolean): string {
  return value ? "✅" : "❌";
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function escapeInline(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/`/g, "'");
}
