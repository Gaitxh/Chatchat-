import type { EvidenceVerificationSnapshot } from "./evidence-ledger.js";

export interface EvidenceSourceObservation extends EvidenceVerificationSnapshot {
  description?: string;
  excerpt?: string;
  pageDate?: string;
  pageDateKind?: "published" | "modified" | "page";
  bodyHash?: string;
  textCharacters?: number;
}

export function describeSourceObservation(observation: EvidenceSourceObservation | undefined): string | null {
  if (!observation || observation.state !== "reachable") return null;
  return [
    observation.title ? `title=${observation.title}` : "",
    observation.pageDate ? `${observation.pageDateKind ?? "page"}_date=${observation.pageDate}` : "",
    observation.description ? `description=${observation.description}` : "",
    observation.excerpt ? `excerpt=${observation.excerpt}` : "",
    observation.bodyHash ? `body_hash=${observation.bodyHash}` : "",
    `observed_at=${observation.observedAt}`,
  ].filter(Boolean).join(" | ");
}

export function sourceAgeDays(pageDate: string | undefined, observedAt: string): number | null {
  if (!pageDate) return null;
  const source = new Date(pageDate);
  const observed = new Date(observedAt);
  if (Number.isNaN(source.getTime()) || Number.isNaN(observed.getTime())) return null;
  return Math.max(0, Math.floor((observed.getTime() - source.getTime()) / 86_400_000));
}
