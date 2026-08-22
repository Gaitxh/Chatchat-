import { providerTabOwnership } from "./provider-tab-boundary.js";

export const BROWSER_AUTHORITY_RECEIPTS_KEY = "chatchat.browser-authority.receipts.v1";
export const MAX_BROWSER_AUTHORITY_RECEIPTS = 80;

export type BrowserAuthorityActionKind =
  | "managed_tab_created"
  | "automatic_connection_resume"
  | "fresh_session_navigation"
  | "self_heal_navigation";

export type BrowserAuthorityTrigger = "automatic" | "explicit_user";

export type BrowserAuthorityReason =
  | "starter_room"
  | "invite_ai"
  | "quick_open"
  | "session_hydration"
  | "provider_tab_loaded"
  | "recovery"
  | "fresh_consultation"
  | "page_mapping_drift";

export interface BrowserAuthorityReceipt {
  readonly seatId: string;
  readonly providerName: string;
  readonly action: BrowserAuthorityActionKind;
  readonly trigger: BrowserAuthorityTrigger;
  readonly reason: BrowserAuthorityReason;
  readonly occurredAt: string;
  /** Automatic browser authority is valid only for ChatChat-created clean tabs. */
  readonly ownership: "managed";
}

export interface BrowserAuthorityParticipant {
  readonly seatId: string;
  readonly providerName: string;
  readonly createdByChatChat?: boolean;
}

export interface BrowserAuthoritySummary {
  readonly managedSeats: number;
  readonly protectedSeats: number;
  readonly automaticActions: number;
  readonly explicitActions: number;
  readonly receipts: BrowserAuthorityReceipt[];
  readonly protectedProviders: string[];
  readonly managedProviders: string[];
}

export type BrowserAuthorityRetryReason = "provider-tab-loaded" | "manual" | "recovery" | undefined;

/** Manual retry is an explicit user action. Every background/recovery retry is managed-only. */
export function mayDispatchProviderRetryUnderBrowserAuthority(
  participant: BrowserAuthorityParticipant,
  reason: BrowserAuthorityRetryReason,
): boolean {
  if (reason === "manual") return true;
  return providerTabOwnership(participant) === "managed";
}

/**
 * Runtime inputs are copied through a strict allowlist before persistence.
 * Unknown properties are intentionally discarded so a caller cannot accidentally
 * turn this authority receipt into a browser-content or credential log.
 */
export function sanitizeBrowserAuthorityReceipt(
  value: BrowserAuthorityReceipt,
): BrowserAuthorityReceipt {
  if (!value || typeof value !== "object") throw new Error("Browser authority receipt is required.");
  if (!isAction(value.action)) throw new Error("Unknown browser authority action.");
  if (!isTrigger(value.trigger)) throw new Error("Unknown browser authority trigger.");
  if (!isReason(value.reason)) throw new Error("Unknown browser authority reason.");
  if (value.ownership !== "managed") throw new Error("Automatic browser authority receipts must be managed-only.");
  if (typeof value.seatId !== "string" || !value.seatId.trim()) throw new Error("Browser authority seat id is required.");
  if (typeof value.providerName !== "string" || !value.providerName.trim()) throw new Error("Browser authority provider name is required.");
  if (typeof value.occurredAt !== "string" || !Number.isFinite(Date.parse(value.occurredAt))) {
    throw new Error("Browser authority timestamp must be ISO-compatible.");
  }

  return {
    seatId: value.seatId.trim(),
    providerName: value.providerName.trim().slice(0, 80),
    action: value.action,
    trigger: value.trigger,
    reason: value.reason,
    occurredAt: new Date(value.occurredAt).toISOString(),
    ownership: "managed",
  };
}

export function appendBoundedBrowserAuthorityReceipt(
  current: readonly BrowserAuthorityReceipt[],
  value: BrowserAuthorityReceipt,
  maxReceipts = MAX_BROWSER_AUTHORITY_RECEIPTS,
): BrowserAuthorityReceipt[] {
  const next = [...current, sanitizeBrowserAuthorityReceipt(value)];
  return next.slice(-Math.max(1, Math.floor(maxReceipts)));
}

export function deriveBrowserAuthoritySummary(
  participants: readonly BrowserAuthorityParticipant[],
  receipts: readonly BrowserAuthorityReceipt[],
): BrowserAuthoritySummary {
  const managed = participants.filter((participant) => providerTabOwnership(participant) === "managed");
  const protectedSeats = participants.filter((participant) => providerTabOwnership(participant) === "user-owned");
  const sanitized = receipts.flatMap((receipt) => {
    try {
      return [sanitizeBrowserAuthorityReceipt(receipt)];
    } catch {
      return [];
    }
  });

  return {
    managedSeats: managed.length,
    protectedSeats: protectedSeats.length,
    automaticActions: sanitized.filter((receipt) => receipt.trigger === "automatic").length,
    explicitActions: sanitized.filter((receipt) => receipt.trigger === "explicit_user").length,
    receipts: sanitized,
    protectedProviders: protectedSeats.map((participant) => participant.providerName),
    managedProviders: managed.map((participant) => participant.providerName),
  };
}

function isAction(value: unknown): value is BrowserAuthorityActionKind {
  return value === "managed_tab_created"
    || value === "automatic_connection_resume"
    || value === "fresh_session_navigation"
    || value === "self_heal_navigation";
}

function isTrigger(value: unknown): value is BrowserAuthorityTrigger {
  return value === "automatic" || value === "explicit_user";
}

function isReason(value: unknown): value is BrowserAuthorityReason {
  return value === "starter_room"
    || value === "invite_ai"
    || value === "quick_open"
    || value === "session_hydration"
    || value === "provider_tab_loaded"
    || value === "recovery"
    || value === "fresh_consultation"
    || value === "page_mapping_drift";
}
