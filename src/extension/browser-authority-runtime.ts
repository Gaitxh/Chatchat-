import {
  CONNECTION_RETRY_REQUESTED_EVENT,
  type ConnectionRetryRequestedDetail,
} from "./connection-retry-wire.js";
import {
  browserAuthorityReasonForRetry,
  mayDispatchProviderRetryUnderBrowserAuthority,
  shouldTrackAutomaticResumeIntent,
  type BrowserAuthorityParticipant,
  type BrowserAuthorityReason,
  type BrowserAuthorityTrigger,
} from "./browser-authority-ledger.js";
import { recordBrowserAuthorityAction } from "./browser-authority-store.js";
import { providerTabOwnership } from "./provider-tab-boundary.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const RECENT_NAVIGATION_WINDOW_MS = 2_500;
const AUTOMATIC_RESUME_INTENT_TTL_MS = 8_000;
const INITIAL_HYDRATION_INTENT_TTL_MS = 12_000;
const SELF_HEALING_ROW_SELECTOR = ".participant-row.connection-self-healing[data-seat-id]";

interface ParticipantRecord extends BrowserAuthorityParticipant {
  tabId: number;
  providerId?: string;
  createdByChatChat?: boolean;
}

interface ConnectionRecord {
  state?: "idle" | "connecting" | "ready" | "failed";
  detail?: string;
  verifiedAt?: string;
  automatic?: boolean;
}

interface CreationIntent {
  trigger: BrowserAuthorityTrigger;
  reason: BrowserAuthorityReason;
  expiresAt: number;
}

interface AutomaticResumeIntent {
  reason: "provider_tab_loaded" | "recovery";
  expiresAt: number;
}

const participantBySeat = new Map<string, ParticipantRecord>();
const participantByTab = new Map<number, ParticipantRecord>();
const connectionStateBySeat = new Map<string, ConnectionRecord["state"]>();
const selfHealingSeats = new Set<string>();
const recentNavigation = new Map<string, number>();
const pendingAutomaticResumeBySeat = new Map<string, AutomaticResumeIntent>();
const initialHydrationExpiryBySeat = new Map<string, number>();
let creationIntent: CreationIntent | null = null;
let blockedAutomaticRetryCount = 0;
let participantHydration: Promise<void> = Promise.resolve();

if (document.documentElement.dataset.surface === "web-app") {
  installSynchronousGuards();
  participantHydration = hydrateParticipants();
  void participantHydration;
}

function installSynchronousGuards() {
  window.addEventListener(
    CONNECTION_RETRY_REQUESTED_EVENT,
    onConnectionRetryRequested,
    { capture: true },
  );

  chrome.storage?.onChanged?.addListener?.((changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    const participantChange = changes?.[PARTICIPANTS_KEY];
    if (participantChange) {
      const previous = participantArray(participantChange.oldValue);
      const next = participantArray(participantChange.newValue);
      updateParticipantMaps(next);
      void recordNewManagedSeats(previous, next);
    }

    const connectionChange = changes?.[CONNECTIONS_KEY];
    if (connectionChange) {
      const previous = connectionRecord(connectionChange.oldValue);
      const next = connectionRecord(connectionChange.newValue);
      updateConnectionStateMap(next);
      void recordConsumedAutomaticResumes(previous, next);
    }
  });

  chrome.tabs?.onUpdated?.addListener?.((tabId: number, changeInfo: { url?: string }) => {
    if (!changeInfo?.url) return;
    const participant = participantByTab.get(tabId);
    if (!participant || providerTabOwnership(participant) !== "managed") return;

    if (selfHealingSeats.delete(participant.seatId)) {
      void recordNavigation(participant, "self_heal_navigation", "page_mapping_drift");
      return;
    }
    if (document.querySelector(".stage-badge.stage-sealed")) {
      void recordNavigation(participant, "fresh_session_navigation", "fresh_consultation");
    }
  });

  document.addEventListener("click", captureCreationIntent, true);
  new MutationObserver(collectSelfHealingSeatsFromMutations).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-seat-id"],
  });
}

async function hydrateParticipants() {
  try {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
    const participants = participantArray(stored?.[PARTICIPANTS_KEY]);
    const connections = connectionRecord(stored?.[CONNECTIONS_KEY]);
    updateParticipantMaps(participants);
    updateConnectionStateMap(connections);

    const expiresAt = Date.now() + INITIAL_HYDRATION_INTENT_TTL_MS;
    for (const participant of participants) {
      if (providerTabOwnership(participant) !== "managed") continue;
      if (connections[participant.seatId]?.state === "ready") continue;
      initialHydrationExpiryBySeat.set(participant.seatId, expiresAt);
    }
  } catch {
    // Unknown ownership must fail closed in the synchronous retry guard.
  }
}

function onConnectionRetryRequested(event: Event) {
  const custom = event as CustomEvent<ConnectionRetryRequestedDetail>;
  const seatId = custom.detail?.seatId;
  const reason = custom.detail?.reason;
  if (!seatId || reason === "manual") return;
  const participant = participantBySeat.get(seatId);

  // A missing ownership record cannot acquire background authority during an
  // asynchronous hydration race. It may be retried later or by explicit user action.
  if (!participant || !mayDispatchProviderRetryUnderBrowserAuthority(participant, reason)) {
    event.stopImmediatePropagation();
    blockedAutomaticRetryCount += 1;
    document.documentElement.dataset.chatchatAuthorityBlockedAutomaticRetries = String(blockedAutomaticRetryCount);
    announceAuthorityUpdated();
    return;
  }

  const connectionState = connectionStateBySeat.get(seatId);
  if (!shouldTrackAutomaticResumeIntent(participant, reason, connectionState)) return;
  const receiptReason = browserAuthorityReasonForRetry(reason);
  if (!receiptReason) return;
  pendingAutomaticResumeBySeat.set(seatId, {
    reason: receiptReason,
    expiresAt: Date.now() + AUTOMATIC_RESUME_INTENT_TTL_MS,
  });
}

async function recordConsumedAutomaticResumes(
  previous: Readonly<Record<string, ConnectionRecord>>,
  next: Readonly<Record<string, ConnectionRecord>>,
) {
  await participantHydration;
  const now = Date.now();

  for (const [seatId, connection] of Object.entries(next)) {
    if (connection.state !== "connecting") continue;
    if (!connectionChanged(previous[seatId], connection)) continue;
    const participant = participantBySeat.get(seatId);
    if (!participant || providerTabOwnership(participant) !== "managed") continue;

    const pending = pendingAutomaticResumeBySeat.get(seatId);
    if (pending && pending.expiresAt >= now) {
      pendingAutomaticResumeBySeat.delete(seatId);
      initialHydrationExpiryBySeat.delete(seatId);
      await recordAutomaticResume(participant, pending.reason);
      continue;
    }
    if (pending) pendingAutomaticResumeBySeat.delete(seatId);

    const hydrationExpiry = initialHydrationExpiryBySeat.get(seatId);
    if (hydrationExpiry && hydrationExpiry >= now) {
      initialHydrationExpiryBySeat.delete(seatId);
      await recordAutomaticResume(participant, "session_hydration");
      continue;
    }
    if (hydrationExpiry) initialHydrationExpiryBySeat.delete(seatId);
  }
}

async function recordAutomaticResume(
  participant: ParticipantRecord,
  reason: "session_hydration" | "provider_tab_loaded" | "recovery",
) {
  await recordBrowserAuthorityAction({
    seatId: participant.seatId,
    providerName: participant.providerName,
    action: "automatic_connection_resume",
    trigger: "automatic",
    reason,
  });
  announceAuthorityUpdated();
}

function captureCreationIntent(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-chatchat-invite-ai="true"] button')) {
    creationIntent = { trigger: "explicit_user", reason: "invite_ai", expiresAt: Date.now() + 45_000 };
    return;
  }
  if (target.closest(".quick-open button")) {
    creationIntent = { trigger: "explicit_user", reason: "quick_open", expiresAt: Date.now() + 45_000 };
    return;
  }
  if (target.closest(".zero-touch-action button")) {
    creationIntent = { trigger: "explicit_user", reason: "starter_room", expiresAt: Date.now() + 45_000 };
  }
}

async function recordNewManagedSeats(
  previous: readonly ParticipantRecord[],
  next: readonly ParticipantRecord[],
) {
  const previousBySeat = new Map(previous.map((participant) => [participant.seatId, participant] as const));
  const newManaged = next.filter((participant) => {
    if (providerTabOwnership(participant) !== "managed") return false;
    const old = previousBySeat.get(participant.seatId);
    return !old || providerTabOwnership(old) !== "managed";
  });
  if (!newManaged.length) return;

  const activeIntent = creationIntent && creationIntent.expiresAt >= Date.now()
    ? creationIntent
    : null;
  const automaticStarter = document.documentElement.dataset.chatchatOnboarding === "zero-config";
  const receiptContext = activeIntent ?? (automaticStarter
    ? { trigger: "automatic" as const, reason: "starter_room" as const }
    : null);
  creationIntent = null;
  if (!receiptContext) return;

  for (const participant of newManaged) {
    initialHydrationExpiryBySeat.delete(participant.seatId);
    await recordBrowserAuthorityAction({
      seatId: participant.seatId,
      providerName: participant.providerName,
      action: "managed_tab_created",
      trigger: receiptContext.trigger,
      reason: receiptContext.reason,
    });
  }
  announceAuthorityUpdated();
}

/**
 * The Full Room mutates heavily while a meeting and audit views render. Inspect
 * only MutationObserver targets/new subtrees instead of rescanning the entire
 * document for every class change. This keeps the authority ledger passive on
 * unrelated high-frequency UI updates such as Provider Memory proof rendering.
 */
function collectSelfHealingSeatsFromMutations(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    if (mutation.type === "attributes") {
      collectSelfHealingSeatFromNode(mutation.target);
      continue;
    }
    for (const node of mutation.addedNodes) collectSelfHealingSeatFromNode(node);
  }
}

function collectSelfHealingSeatFromNode(node: Node) {
  if (!(node instanceof Element)) return;
  const row = node.matches(SELF_HEALING_ROW_SELECTOR)
    ? node as HTMLElement
    : node.closest<HTMLElement>(SELF_HEALING_ROW_SELECTOR);
  if (row?.dataset.seatId) selfHealingSeats.add(row.dataset.seatId);
  for (const nested of node.querySelectorAll<HTMLElement>(SELF_HEALING_ROW_SELECTOR)) {
    if (nested.dataset.seatId) selfHealingSeats.add(nested.dataset.seatId);
  }
}

async function recordNavigation(
  participant: ParticipantRecord,
  action: "fresh_session_navigation" | "self_heal_navigation",
  reason: "fresh_consultation" | "page_mapping_drift",
) {
  const key = `${participant.seatId}:${action}`;
  const last = recentNavigation.get(key) ?? 0;
  if (Date.now() - last < RECENT_NAVIGATION_WINDOW_MS) return;
  recentNavigation.set(key, Date.now());
  await recordBrowserAuthorityAction({
    seatId: participant.seatId,
    providerName: participant.providerName,
    action,
    trigger: "automatic",
    reason,
  });
  announceAuthorityUpdated();
}

function updateParticipantMaps(participants: readonly ParticipantRecord[]) {
  participantBySeat.clear();
  participantByTab.clear();
  const validSeats = new Set<string>();
  for (const participant of participants) {
    participantBySeat.set(participant.seatId, participant);
    participantByTab.set(participant.tabId, participant);
    validSeats.add(participant.seatId);
  }
  for (const seatId of pendingAutomaticResumeBySeat.keys()) {
    if (!validSeats.has(seatId)) pendingAutomaticResumeBySeat.delete(seatId);
  }
  for (const seatId of initialHydrationExpiryBySeat.keys()) {
    if (!validSeats.has(seatId)) initialHydrationExpiryBySeat.delete(seatId);
  }
  announceAuthorityUpdated();
}

function updateConnectionStateMap(connections: Readonly<Record<string, ConnectionRecord>>) {
  connectionStateBySeat.clear();
  for (const [seatId, connection] of Object.entries(connections)) {
    connectionStateBySeat.set(seatId, connection.state);
  }
}

function connectionChanged(previous: ConnectionRecord | undefined, next: ConnectionRecord): boolean {
  return previous?.state !== next.state
    || previous?.detail !== next.detail
    || previous?.verifiedAt !== next.verifiedAt
    || previous?.automatic !== next.automatic;
}

function participantArray(value: unknown): ParticipantRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((participant): participant is ParticipantRecord => Boolean(
    participant
      && typeof participant === "object"
      && typeof participant.seatId === "string"
      && typeof participant.providerName === "string"
      && Number.isInteger(participant.tabId),
  ));
}

function connectionRecord(value: unknown): Record<string, ConnectionRecord> {
  return value && typeof value === "object"
    ? value as Record<string, ConnectionRecord>
    : {};
}

function announceAuthorityUpdated() {
  window.dispatchEvent(new CustomEvent("chatchat:browser-authority-updated"));
}
