import type {
  CouncilConsultationMode,
  CouncilReport,
} from "../core/types.js";
import type {
  ConsultationNextMoveKind,
  ConsultationNextMoveModeHint,
} from "../consultation/next-moves.js";

export const MAX_INVESTIGATION_TRAIL_EDGES = 40;
export const INVESTIGATION_PENDING_TTL_MS = 2 * 60 * 60 * 1000;

export interface PendingInvestigationFollowUp {
  parentSessionId: string;
  parentProposalPreview: string;
  parentOutcome: string;
  parentMode: CouncilConsultationMode;
  moveId: string;
  moveKind: ConsultationNextMoveKind;
  modeHint: ConsultationNextMoveModeHint;
  labelEn: string;
  labelZhCN: string;
  stagedProposalPreview: string;
  stagedAt: string;
}

export interface InvestigationTrailEdge {
  childSessionId: string;
  parentSessionId: string;
  parentProposalPreview: string;
  parentOutcome: string;
  parentMode: CouncilConsultationMode;
  childProposalPreview: string;
  childOutcome: string;
  childMode: CouncilConsultationMode;
  moveId: string;
  moveKind: ConsultationNextMoveKind;
  modeHint: ConsultationNextMoveModeHint;
  labelEn: string;
  labelZhCN: string;
  stagedAt: string;
  linkedAt: string;
}

export interface InvestigationTrailNode {
  sessionId: string;
  proposalPreview: string;
  outcome: string;
  mode: CouncilConsultationMode;
  linkedAt: string;
  children: InvestigationTrailBranch[];
}

export interface InvestigationTrailBranch {
  edge: InvestigationTrailEdge;
  child: InvestigationTrailNode;
}

export function createPendingInvestigationFollowUp(input: {
  parentReport: CouncilReport;
  moveId: string;
  moveKind: ConsultationNextMoveKind;
  modeHint: ConsultationNextMoveModeHint;
  labelEn: string;
  labelZhCN: string;
  stagedProposal: string;
  stagedAt?: string;
}): PendingInvestigationFollowUp {
  return {
    parentSessionId: input.parentReport.sessionId,
    parentProposalPreview: compact(input.parentReport.question, 220),
    parentOutcome: compact(input.parentReport.consensusStance ?? "No single leading stance", 120),
    parentMode: input.parentReport.mode ?? "balanced",
    moveId: compact(input.moveId, 180),
    moveKind: input.moveKind,
    modeHint: input.modeHint,
    labelEn: compact(input.labelEn, 120),
    labelZhCN: compact(input.labelZhCN, 120),
    stagedProposalPreview: compact(input.stagedProposal, 220),
    stagedAt: input.stagedAt ?? new Date().toISOString(),
  };
}

export function pendingFollowUpIsFresh(
  pending: PendingInvestigationFollowUp,
  now = Date.now(),
): boolean {
  const staged = Date.parse(pending.stagedAt);
  if (!Number.isFinite(staged)) return false;
  return now >= staged && now - staged <= INVESTIGATION_PENDING_TTL_MS;
}

export function createInvestigationTrailEdge(
  pending: PendingInvestigationFollowUp,
  childReport: CouncilReport,
  linkedAt = new Date().toISOString(),
): InvestigationTrailEdge | null {
  if (!pendingFollowUpIsFresh(pending, Date.parse(linkedAt))) return null;
  if (!childReport.sessionId || childReport.sessionId === pending.parentSessionId) return null;
  return {
    childSessionId: childReport.sessionId,
    parentSessionId: pending.parentSessionId,
    parentProposalPreview: pending.parentProposalPreview,
    parentOutcome: pending.parentOutcome,
    parentMode: pending.parentMode,
    childProposalPreview: compact(childReport.question, 220),
    childOutcome: compact(childReport.consensusStance ?? "No single leading stance", 120),
    childMode: childReport.mode ?? pending.modeHint ?? "balanced",
    moveId: pending.moveId,
    moveKind: pending.moveKind,
    modeHint: pending.modeHint,
    labelEn: pending.labelEn,
    labelZhCN: pending.labelZhCN,
    stagedAt: pending.stagedAt,
    linkedAt,
  };
}

export function upsertInvestigationTrailEdge(
  current: readonly InvestigationTrailEdge[],
  edge: InvestigationTrailEdge,
  limit = MAX_INVESTIGATION_TRAIL_EDGES,
): InvestigationTrailEdge[] {
  return [edge, ...current.filter((item) => item.childSessionId !== edge.childSessionId)]
    .filter(validEdge)
    .sort((a, b) => b.linkedAt.localeCompare(a.linkedAt))
    .slice(0, Math.max(0, limit));
}

export function removeInvestigationTrailSession(
  current: readonly InvestigationTrailEdge[],
  sessionId: string,
): InvestigationTrailEdge[] {
  return current.filter(
    (edge) => edge.childSessionId !== sessionId && edge.parentSessionId !== sessionId,
  );
}

export function deriveInvestigationTrailForest(
  edges: readonly InvestigationTrailEdge[],
): InvestigationTrailNode[] {
  const clean = edges.filter(validEdge);
  const nodeData = new Map<string, Omit<InvestigationTrailNode, "children">>();
  const childIds = new Set<string>();
  const childrenByParent = new Map<string, InvestigationTrailEdge[]>();

  for (const edge of clean) {
    nodeData.set(edge.parentSessionId, {
      sessionId: edge.parentSessionId,
      proposalPreview: edge.parentProposalPreview,
      outcome: edge.parentOutcome,
      mode: edge.parentMode,
      linkedAt: edge.linkedAt,
    });
    nodeData.set(edge.childSessionId, {
      sessionId: edge.childSessionId,
      proposalPreview: edge.childProposalPreview,
      outcome: edge.childOutcome,
      mode: edge.childMode,
      linkedAt: edge.linkedAt,
    });
    childIds.add(edge.childSessionId);
    const list = childrenByParent.get(edge.parentSessionId) ?? [];
    list.push(edge);
    childrenByParent.set(edge.parentSessionId, list);
  }

  const roots = [...nodeData.keys()].filter((id) => !childIds.has(id));
  const rootIds = roots.length ? roots : [...nodeData.keys()].slice(0, 1);
  const visiting = new Set<string>();

  const build = (sessionId: string, depth = 0): InvestigationTrailNode | null => {
    if (depth > 12 || visiting.has(sessionId)) return null;
    const data = nodeData.get(sessionId);
    if (!data) return null;
    visiting.add(sessionId);
    const children = (childrenByParent.get(sessionId) ?? [])
      .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt))
      .map((edge) => {
        const child = build(edge.childSessionId, depth + 1);
        return child ? { edge, child } : null;
      })
      .filter((branch): branch is InvestigationTrailBranch => Boolean(branch));
    visiting.delete(sessionId);
    return { ...data, children };
  };

  return rootIds
    .map((id) => build(id))
    .filter((node): node is InvestigationTrailNode => Boolean(node))
    .sort((a, b) => latestLinkedAt(b).localeCompare(latestLinkedAt(a)));
}

function latestLinkedAt(node: InvestigationTrailNode): string {
  let latest = node.linkedAt;
  for (const branch of node.children) {
    const childLatest = latestLinkedAt(branch.child);
    if (childLatest > latest) latest = childLatest;
  }
  return latest;
}

function validEdge(edge: InvestigationTrailEdge): boolean {
  return Boolean(
    edge.childSessionId &&
      edge.parentSessionId &&
      edge.childSessionId !== edge.parentSessionId &&
      edge.moveId &&
      edge.linkedAt,
  );
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
