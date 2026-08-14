import {
  pendingFollowUpIsFresh,
  removeInvestigationTrailSession,
  upsertInvestigationTrailEdge,
  type InvestigationTrailEdge,
  type PendingInvestigationFollowUp,
} from "../history/investigation-trail.js";

declare const chrome: any;

export const INVESTIGATION_TRAIL_STORAGE_KEY = "chatchat.investigation.trail.v1";
export const INVESTIGATION_PENDING_STORAGE_KEY = "chatchat.investigation.pending.v1";

export class BrowserInvestigationTrailStore {
  async list(): Promise<InvestigationTrailEdge[]> {
    const value = await chrome.storage.local.get(INVESTIGATION_TRAIL_STORAGE_KEY);
    return normalizeEdges(value[INVESTIGATION_TRAIL_STORAGE_KEY]);
  }

  async save(edge: InvestigationTrailEdge): Promise<InvestigationTrailEdge[]> {
    const next = upsertInvestigationTrailEdge(await this.list(), edge);
    await chrome.storage.local.set({ [INVESTIGATION_TRAIL_STORAGE_KEY]: next });
    return next;
  }

  async removeSession(sessionId: string): Promise<InvestigationTrailEdge[]> {
    const next = removeInvestigationTrailSession(await this.list(), sessionId);
    await chrome.storage.local.set({ [INVESTIGATION_TRAIL_STORAGE_KEY]: next });
    return next;
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(INVESTIGATION_TRAIL_STORAGE_KEY);
  }

  async getPending(): Promise<PendingInvestigationFollowUp | null> {
    const area = chrome.storage.session ?? chrome.storage.local;
    const value = await area.get(INVESTIGATION_PENDING_STORAGE_KEY);
    const pending = normalizePending(value[INVESTIGATION_PENDING_STORAGE_KEY]);
    if (!pending) return null;
    if (pendingFollowUpIsFresh(pending)) return pending;
    await area.remove(INVESTIGATION_PENDING_STORAGE_KEY);
    return null;
  }

  async setPending(pending: PendingInvestigationFollowUp): Promise<void> {
    const area = chrome.storage.session ?? chrome.storage.local;
    await area.set({ [INVESTIGATION_PENDING_STORAGE_KEY]: pending });
  }

  async clearPending(): Promise<void> {
    const area = chrome.storage.session ?? chrome.storage.local;
    await area.remove(INVESTIGATION_PENDING_STORAGE_KEY);
  }
}

function normalizeEdges(value: unknown): InvestigationTrailEdge[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is InvestigationTrailEdge => {
    if (!item || typeof item !== "object") return false;
    const edge = item as Partial<InvestigationTrailEdge>;
    return Boolean(
      typeof edge.childSessionId === "string" &&
        typeof edge.parentSessionId === "string" &&
        typeof edge.parentProposalPreview === "string" &&
        typeof edge.childProposalPreview === "string" &&
        typeof edge.moveId === "string" &&
        typeof edge.linkedAt === "string",
    );
  });
}

function normalizePending(value: unknown): PendingInvestigationFollowUp | null {
  if (!value || typeof value !== "object") return null;
  const pending = value as Partial<PendingInvestigationFollowUp>;
  if (
    typeof pending.parentSessionId !== "string" ||
    typeof pending.parentProposalPreview !== "string" ||
    typeof pending.parentOutcome !== "string" ||
    typeof pending.parentMode !== "string" ||
    typeof pending.moveId !== "string" ||
    typeof pending.moveKind !== "string" ||
    typeof pending.modeHint !== "string" ||
    typeof pending.labelEn !== "string" ||
    typeof pending.labelZhCN !== "string" ||
    typeof pending.stagedProposalPreview !== "string" ||
    typeof pending.stagedAt !== "string"
  ) return null;
  return pending as PendingInvestigationFollowUp;
}
