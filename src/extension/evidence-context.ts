import type { CouncilContext, CouncilEvent } from "../core/types.js";
import type { EvidenceSourceObservation } from "../evidence/source-metadata.js";

const MAX_OBSERVATIONS = 6;
const MAX_EXCERPT = 520;
const MAX_TITLE = 220;
const MAX_DESCRIPTION = 320;
const MAX_TOOL_CONTEXT = 4_800;

export interface ConsultationToolObservation {
  evidenceEventId: string;
  actorId: string;
  sourceHost: string;
  sourceUrl: string;
  state: "reachable" | "unavailable" | "unsupported";
  observedAt: string;
  title?: string;
  description?: string;
  pageDate?: string;
  pageDateKind?: "published" | "modified" | "page";
  excerpt?: string;
  bodyHash?: string;
}

export function buildEvidenceToolContext(
  context: CouncilContext,
  observations: Readonly<Record<string, EvidenceSourceObservation>>,
): string | undefined {
  if (context.phase === "sealed") return undefined;

  const visibleEvidence = context.publicEvents
    .filter((event): event is Extract<CouncilEvent, { kind: "evidence" }> => event.kind === "evidence")
    .slice(-MAX_OBSERVATIONS);

  const rows = visibleEvidence
    .map((event) => toolObservationFor(event, observations[event.id]))
    .filter((value): value is ConsultationToolObservation => Boolean(value));

  if (!rows.length) return undefined;

  const envelope = JSON.stringify({ observations: rows });
  if (envelope.length <= MAX_TOOL_CONTEXT) return envelope;

  // Preserve identifiers/state/date while shrinking prose fields deterministically.
  const compactRows = rows.map((row) => ({
    ...row,
    ...(row.description ? { description: clip(row.description, 140) } : {}),
    ...(row.excerpt ? { excerpt: clip(row.excerpt, 220) } : {}),
  }));
  const compact = JSON.stringify({ observations: compactRows });
  return compact.length <= MAX_TOOL_CONTEXT
    ? compact
    : JSON.stringify({ observations: compactRows.slice(-3) });
}

function toolObservationFor(
  event: Extract<CouncilEvent, { kind: "evidence" }>,
  snapshot: EvidenceSourceObservation | undefined,
): ConsultationToolObservation | undefined {
  if (!event.source || !snapshot) return undefined;
  const source = safeHttpUrl(event.source);
  if (!source) return undefined;
  if (snapshot.state !== "reachable" && snapshot.state !== "unavailable" && snapshot.state !== "unsupported") {
    return undefined;
  }

  return {
    evidenceEventId: event.id,
    actorId: event.actorId,
    sourceHost: source.hostname.replace(/^www\./i, ""),
    sourceUrl: source.toString(),
    state: snapshot.state,
    observedAt: snapshot.observedAt,
    ...(snapshot.title ? { title: clip(snapshot.title, MAX_TITLE) } : {}),
    ...(snapshot.description ? { description: clip(snapshot.description, MAX_DESCRIPTION) } : {}),
    ...(snapshot.pageDate ? { pageDate: clip(snapshot.pageDate, 100) } : {}),
    ...(snapshot.pageDateKind ? { pageDateKind: snapshot.pageDateKind } : {}),
    ...(snapshot.excerpt ? { excerpt: clip(snapshot.excerpt, MAX_EXCERPT) } : {}),
    ...(snapshot.bodyHash ? { bodyHash: clip(snapshot.bodyHash, 100) } : {}),
  };
}

function safeHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.username = "";
    url.password = "";
    return url;
  } catch {
    return undefined;
  }
}

function clip(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
