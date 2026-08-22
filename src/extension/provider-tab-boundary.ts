export interface ProviderTabOwnershipMetadata {
  /** Stable provenance: true only for a clean Provider tab ChatChat itself created. */
  readonly createdByChatChat?: boolean;
  /** Stable seat identity lets a fresh runtime protection override stale UI objects. */
  readonly seatId?: string;
  /**
   * Explicit user revocation for an otherwise ChatChat-created clean tab.
   * This changes current automation authority without rewriting creation provenance.
   */
  readonly automationProtected?: boolean;
}

export type ProviderTabOwnership = "managed" | "protected" | "user-owned";

const runtimeProtectedSeatIds = new Set<string>();

/**
 * Synchronize the immediate runtime revocation set from the latest session store.
 * This closes the small React-hydration window where a stale participant object
 * might still carry automationProtected=false after the user has just revoked it.
 */
export function replaceRuntimeProtectedProviderSeats(seatIds: readonly string[]): void {
  runtimeProtectedSeatIds.clear();
  for (const seatId of seatIds) {
    const normalized = seatId.trim();
    if (normalized) runtimeProtectedSeatIds.add(normalized);
  }
}

export function setRuntimeProviderSeatProtected(seatId: string, protectedState: boolean): void {
  const normalized = seatId.trim();
  if (!normalized) return;
  if (protectedState) runtimeProtectedSeatIds.add(normalized);
  else runtimeProtectedSeatIds.delete(normalized);
}

export function providerTabOwnership(
  participant: ProviderTabOwnershipMetadata,
): ProviderTabOwnership {
  if (participant.createdByChatChat !== true) return "user-owned";
  const runtimeProtected = typeof participant.seatId === "string"
    && runtimeProtectedSeatIds.has(participant.seatId);
  return participant.automationProtected === true || runtimeProtected
    ? "protected"
    : "managed";
}

/**
 * Automatic navigation is reserved for clean Provider tabs created by ChatChat
 * whose authority has not been explicitly revoked. User-owned and protected tabs
 * may be activated or used only as a consequence of an explicit user action.
 */
export function mayAutomaticallyNavigateProviderTab(
  participant: ProviderTabOwnershipMetadata,
): boolean {
  return providerTabOwnership(participant) === "managed";
}

/**
 * Session hydration is background automation, so it follows the same revocable
 * authority boundary. User-owned and protected tabs require explicit user action.
 */
export function mayAutomaticallyResumeProviderTab(
  participant: ProviderTabOwnershipMetadata,
): boolean {
  return providerTabOwnership(participant) === "managed";
}
