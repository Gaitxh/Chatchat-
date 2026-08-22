import {
  setRuntimeProviderSeatProtected,
  type ProviderTabOwnershipMetadata,
} from "./provider-tab-boundary.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
let mutationQueue = Promise.resolve();

export interface ProtectableProviderParticipant extends ProviderTabOwnershipMetadata {
  seatId: string;
  providerName: string;
  [key: string]: unknown;
}

export interface ProviderAutomationProtectionResult {
  changed: boolean;
  protected: boolean;
  participant?: ProtectableProviderParticipant;
  reason?: "missing" | "not_chatchat_created" | "unchanged";
}

/**
 * Explicitly revoke or restore automation for a ChatChat-created Provider tab.
 * Creation provenance never changes. The runtime override flips first so stale
 * React objects immediately lose authority; a failed storage write rolls back.
 */
export function setProviderAutomationProtected(
  seatId: string,
  protectedState: boolean,
): Promise<ProviderAutomationProtectionResult> {
  const normalizedSeatId = seatId.trim();
  if (!normalizedSeatId) return Promise.resolve({ changed: false, protected: true, reason: "missing" });

  const task = mutationQueue.then(async () => {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get(PARTICIPANTS_KEY);
    const participants = Array.isArray(stored?.[PARTICIPANTS_KEY])
      ? stored[PARTICIPANTS_KEY] as ProtectableProviderParticipant[]
      : [];
    const index = participants.findIndex((participant) => participant?.seatId === normalizedSeatId);
    if (index < 0) return { changed: false, protected: true, reason: "missing" } as const;
    const current = participants[index]!;
    if (current.createdByChatChat !== true) {
      return { changed: false, protected: true, participant: current, reason: "not_chatchat_created" } as const;
    }
    const currentProtected = current.automationProtected === true;
    if (currentProtected === protectedState) {
      setRuntimeProviderSeatProtected(normalizedSeatId, protectedState);
      return { changed: false, protected: protectedState, participant: current, reason: "unchanged" } as const;
    }

    setRuntimeProviderSeatProtected(normalizedSeatId, protectedState);
    const nextParticipant: ProtectableProviderParticipant = {
      ...current,
      automationProtected: protectedState,
    };
    const next = [...participants];
    next[index] = nextParticipant;
    try {
      await store.set({ [PARTICIPANTS_KEY]: next });
    } catch (error) {
      setRuntimeProviderSeatProtected(normalizedSeatId, currentProtected);
      throw error;
    }
    return { changed: true, protected: protectedState, participant: nextParticipant } as const;
  });
  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}
