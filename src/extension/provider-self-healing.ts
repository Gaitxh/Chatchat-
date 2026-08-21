import { participantRowMap } from "./participant-row-identity.js";
import { inspectProviderPage } from "./provider-page-inspection.js";
import {
  classifyProviderRecoveryFailure,
  planProviderRecovery,
} from "./provider-recovery.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const CLAIM_PROVIDER_SELF_HEALING = "CLAIM_PROVIDER_SELF_HEALING";
const MARKER = "__chatchatProviderSelfHealingV3";
const NOTE_CLASS = "provider-self-healing-note";
const RECOVERY_VISIBLE_LIMIT_MS = 45_000;
const RECONNECT_SETTLE_GRACE_MS = 800;

interface ParticipantRecord {
  seatId: string;
  tabId: number;
  providerName: string;
  origin: string;
  hostname: string;
  startUrl?: string;
  createdByChatChat?: boolean;
}

interface ConnectionRecord {
  state?: "idle" | "connecting" | "ready" | "failed";
  detail?: string;
}

interface HealingEpisode {
  startedAt: number;
  tabId: number;
  pageLoadCompletedAt: number | null;
}

type MarkedWindow = Window & { [MARKER]?: true };

const healing = new Map<string, HealingEpisode>();
const inFlight = new Set<string>();
let refreshTimer: number | undefined;

install();

function install(): void {
  const marked = window as MarkedWindow;
  if (marked[MARKER]) return;
  marked[MARKER] = true;

  chrome.storage?.onChanged?.addListener((changes: Record<string, unknown>) => {
    if (PARTICIPANTS_KEY in changes || CONNECTIONS_KEY in changes) scheduleRefresh();
  });
  chrome.tabs?.onUpdated?.addListener?.((tabId: number, changeInfo: { status?: string }) => {
    if (changeInfo?.status === "complete") {
      let matchedRecovery = false;
      for (const episode of healing.values()) {
        if (episode.tabId !== tabId) continue;
        episode.pageLoadCompletedAt = Date.now();
        matchedRecovery = true;
      }
      if (matchedRecovery) {
        // Full Room's existing tabs.onUpdated listener owns automatic reconnect.
        // Give that retry a short settle window, then re-check even if its
        // connecting → failed transition was too fast to observe.
        window.setTimeout(scheduleRefresh, RECONNECT_SETTLE_GRACE_MS + 40);
      }
    }
    scheduleRefresh();
  });
  new MutationObserver(scheduleRefresh).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  scheduleRefresh();
}

function scheduleRefresh(): void {
  if (refreshTimer !== undefined) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = undefined;
    void refresh();
  }, 80);
}

async function refresh(): Promise<void> {
  if (!chrome?.storage) return;
  const [participants, connections] = await Promise.all([
    readParticipants(),
    readConnections(),
  ]);
  const rows = participantRowMap(participants);
  const validSeats = new Set(participants.map((participant) => participant.seatId));

  for (const row of document.querySelectorAll<HTMLElement>(".participant-row")) {
    if (!row.dataset.seatId || !validSeats.has(row.dataset.seatId)) clearHealingState(row);
  }

  for (const participant of participants) {
    const row = rows.get(participant.seatId);
    if (!row) continue;
    const connection = connections[participant.seatId];
    const currentHealing = healing.get(participant.seatId);

    if (currentHealing) {
      if (connection?.state === "ready") {
        healing.delete(participant.seatId);
        clearHealingState(row);
        continue;
      }
      if (connection?.state === "connecting") {
        showHealingState(row);
        continue;
      }
      if (connection?.state === "failed") {
        const cleanPageRetrySettled = currentHealing.pageLoadCompletedAt !== null
          && Date.now() - currentHealing.pageLoadCompletedAt >= RECONNECT_SETTLE_GRACE_MS;
        const recoveryTimedOut = Date.now() - currentHealing.startedAt >= RECOVERY_VISIBLE_LIMIT_MS;
        if (cleanPageRetrySettled || recoveryTimedOut) {
          healing.delete(participant.seatId);
          clearHealingState(row);
        } else {
          showHealingState(row);
        }
        continue;
      }
      showHealingState(row);
      continue;
    }

    if (connection?.state !== "failed") {
      clearHealingState(row);
      continue;
    }
    if (classifyProviderRecoveryFailure(connection.detail) !== "automatic_page_mapping_drift") {
      clearHealingState(row);
      continue;
    }
    if (inFlight.has(participant.seatId)) continue;
    void tryRecover(participant, row, connection.detail);
  }
}

async function tryRecover(
  participant: ParticipantRecord,
  row: HTMLElement,
  detail: string | undefined,
): Promise<void> {
  inFlight.add(participant.seatId);
  try {
    const inspection = await inspectProviderPage({
      tabId: participant.tabId,
      expectedOrigin: participant.origin,
    });
    const action = planProviderRecovery({
      failure: classifyProviderRecoveryFailure(detail),
      createdByChatChat: participant.createdByChatChat === true,
      participantOrigin: participant.origin,
      startUrl: participant.startUrl,
      inspection,
    });
    if (action.kind !== "navigate_clean_start") {
      clearHealingState(row);
      return;
    }

    const claim = await chrome.runtime.sendMessage({
      type: CLAIM_PROVIDER_SELF_HEALING,
      seatId: participant.seatId,
      tabId: participant.tabId,
    });
    if (!claim?.ok || claim.claimed !== true) return;

    healing.set(participant.seatId, {
      startedAt: Date.now(),
      tabId: participant.tabId,
      pageLoadCompletedAt: null,
    });
    showHealingState(row);
    await chrome.tabs.update(participant.tabId, { url: action.url });
    // Do not dispatch Retry here. The existing tabs.onUpdated auto-resume path
    // owns the next automatic connection attempt after the clean page loads.
    scheduleRefresh();
  } catch (caught) {
    healing.delete(participant.seatId);
    clearHealingState(row);
    console.warn("ChatChat could not safely self-heal this Provider page.", caught);
  } finally {
    inFlight.delete(participant.seatId);
  }
}

async function readParticipants(): Promise<ParticipantRecord[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const stored = await store.get(PARTICIPANTS_KEY);
  const value = stored?.[PARTICIPANTS_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter((participant): participant is ParticipantRecord => Boolean(
    participant
      && typeof participant === "object"
      && typeof participant.seatId === "string"
      && Number.isInteger(participant.tabId)
      && typeof participant.providerName === "string"
      && typeof participant.origin === "string"
      && typeof participant.hostname === "string",
  ));
}

async function readConnections(): Promise<Record<string, ConnectionRecord>> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const stored = await store.get(CONNECTIONS_KEY);
  const value = stored?.[CONNECTIONS_KEY];
  return value && typeof value === "object"
    ? value as Record<string, ConnectionRecord>
    : {};
}

function showHealingState(row: HTMLElement): void {
  row.classList.add("connection-self-healing");
  row.setAttribute("aria-busy", "true");
  if (row.querySelector(`.${NOTE_CLASS}`)) return;
  const note = document.createElement("div");
  note.className = NOTE_CLASS;
  note.innerHTML = `
    <span class="provider-self-healing-note__pulse" aria-hidden="true"></span>
    <span class="provider-self-healing-note__zh"><strong>正在自动修复连接</strong><small>ChatChat 正在重新识别这个 AI 页面，你不需要操作。</small></span>
    <span class="provider-self-healing-note__en"><strong>Self-healing connection</strong><small>ChatChat is re-learning this AI page. No action needed.</small></span>
  `;
  row.querySelector(".participant-main")?.append(note);
}

function clearHealingState(row: HTMLElement): void {
  row.classList.remove("connection-self-healing");
  row.removeAttribute("aria-busy");
  row.querySelector(`.${NOTE_CLASS}`)?.remove();
}
