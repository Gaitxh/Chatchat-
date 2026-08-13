import type {
  CouncilToolFact,
  CouncilToolFactsRequest,
} from "../core/types.js";
import {
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  safeEvidenceSource,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { buildEvidenceToolFacts } from "../evidence/tool-facts.js";

declare const chrome: any;

const MAX_AUTOMATIC_CHECKS_PER_ROUND = 3;

export async function browserEvidenceToolFacts(
  request: CouncilToolFactsRequest,
): Promise<readonly CouncilToolFact[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const stored = await store.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
  const verifications = {
    ...((stored[EVIDENCE_VERIFICATIONS_STORAGE_KEY] ?? {}) as Record<
      string,
      EvidenceVerificationSnapshot
    >),
  };

  const unchecked = request.publicEvents
    .filter((event) => event.kind === "evidence" && !verifications[event.id])
    .slice(-MAX_AUTOMATIC_CHECKS_PER_ROUND);

  let changed = false;
  await Promise.all(
    unchecked.map(async (event) => {
      if (event.kind !== "evidence") return;
      const source = safeEvidenceSource(event.source);
      if (!source) return;
      const descriptor = { origins: [`${new URL(source.url).origin}/*`] };
      const alreadyAllowed = await chrome.permissions.contains(descriptor);
      if (!alreadyAllowed) return;

      try {
        const verification = await requestVerification(source.url);
        verifications[event.id] = verification;
        changed = true;
      } catch {
        // Tool observations are best-effort and must never interrupt consultation.
      }
    }),
  );

  if (changed) {
    await store.set({ [EVIDENCE_VERIFICATIONS_STORAGE_KEY]: verifications });
  }

  return buildEvidenceToolFacts(request.publicEvents, verifications);
}

async function requestVerification(url: string): Promise<EvidenceVerificationSnapshot> {
  const response = await chrome.runtime.sendMessage({
    type: "VERIFY_EVIDENCE_SOURCE",
    url,
  });
  if (!response?.ok || !response.result) {
    throw new Error(response?.error || "Evidence source observation failed.");
  }
  return response.result as EvidenceVerificationSnapshot;
}
