import type { CouncilEvent, CouncilToolFact } from "../core/types.js";
import type { EvidenceVerificationSnapshot } from "./evidence-ledger.js";
import { safeEvidenceSource } from "./evidence-ledger.js";

const MAX_FACTS = 8;
const MAX_CLAIM = 700;
const MAX_DESCRIPTION = 500;
const MAX_EXCERPT = 700;

export function buildEvidenceToolFacts(
  events: readonly CouncilEvent[],
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>>,
): CouncilToolFact[] {
  const facts: CouncilToolFact[] = [];

  for (const event of events) {
    if (event.kind !== "evidence") continue;
    const verification = verifications[event.id];
    if (!verification || (verification.state !== "reachable" && verification.state !== "unavailable")) {
      continue;
    }

    const source = safeEvidenceSource(event.source);
    const dateSignal = verification.pageDate ?? event.sourceDate;
    const sourceAgeDays = dateSignal
      ? ageDays(dateSignal, verification.observedAt)
      : undefined;

    facts.push({
      id: `tool:evidence:${event.id}:${verification.bodyHash ?? verification.observedAt}`,
      kind: "evidence_source_observation",
      relatedEventId: event.id,
      observedAt: verification.observedAt,
      sourceState: verification.state,
      claim: clipped(event.claim, MAX_CLAIM),
      ...(source ? { sourceUrl: source.url, sourceHost: source.host } : {}),
      ...(verification.finalUrl ? { finalUrl: verification.finalUrl } : {}),
      ...(typeof verification.statusCode === "number" ? { statusCode: verification.statusCode } : {}),
      ...(verification.title ? { title: verification.title } : {}),
      ...(verification.description
        ? { description: clipped(verification.description, MAX_DESCRIPTION) }
        : {}),
      ...(verification.excerpt
        ? { excerpt: clipped(verification.excerpt, MAX_EXCERPT) }
        : {}),
      ...(dateSignal ? { pageDate: dateSignal } : {}),
      ...(verification.pageDateKind ? { pageDateKind: verification.pageDateKind } : {}),
      ...(typeof sourceAgeDays === "number" ? { sourceAgeDays } : {}),
      ...(verification.bodyHash ? { contentFingerprint: verification.bodyHash } : {}),
      ...(typeof verification.textCharacters === "number"
        ? { textCharacters: verification.textCharacters }
        : {}),
      ...(verification.truncated ? { truncated: true } : {}),
      note:
        verification.state === "reachable"
          ? "The source URL answered ChatChat's bounded credential-free fetch. This observation does not prove the associated claim."
          : "ChatChat's bounded source check could not obtain a successful public response. This observation does not prove the associated claim is false.",
    });
  }

  return facts.slice(-MAX_FACTS);
}

export function evidenceDateAgeDays(
  dateSignal: string | undefined,
  observedAt: string,
): number | undefined {
  return dateSignal ? ageDays(dateSignal, observedAt) : undefined;
}

function ageDays(dateSignal: string, observedAt: string): number | undefined {
  const date = Date.parse(dateSignal);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(date) || !Number.isFinite(observed)) return undefined;
  const days = Math.floor(Math.max(0, observed - date) / 86_400_000);
  return Number.isFinite(days) ? days : undefined;
}

function clipped(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
