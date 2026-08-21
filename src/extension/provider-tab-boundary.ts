export interface ProviderTabOwnershipMetadata {
  /**
   * True only for a clean Provider tab that ChatChat itself created.
   * Missing metadata fails closed so restored records from older versions are
   * treated as user-owned rather than silently gaining automation privileges.
   */
  readonly createdByChatChat?: boolean;
}

export type ProviderTabOwnership = "managed" | "user-owned";

export function providerTabOwnership(
  participant: ProviderTabOwnershipMetadata,
): ProviderTabOwnership {
  return participant.createdByChatChat === true ? "managed" : "user-owned";
}

/**
 * Automatic navigation is reserved for clean Provider tabs created by
 * ChatChat. An attached tab already owned by the user may be activated or used
 * only as a consequence of an explicit user action, never reset behind their
 * back.
 */
export function mayAutomaticallyNavigateProviderTab(
  participant: ProviderTabOwnershipMetadata,
): boolean {
  return providerTabOwnership(participant) === "managed";
}

/**
 * Session hydration is background automation, so it follows the same strict
 * ownership boundary. User-owned tabs can be retried only by an explicit UI
 * action after restoration.
 */
export function mayAutomaticallyResumeProviderTab(
  participant: ProviderTabOwnershipMetadata,
): boolean {
  return providerTabOwnership(participant) === "managed";
}
