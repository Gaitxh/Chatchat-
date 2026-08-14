import { participantRowMap } from "./participant-row-identity.js";
import { inspectProviderPage } from "./provider-page-inspection.js";
import {
  classifyProviderRecoveryFailure,
  planProviderRecovery,
} from "./provider-recovery.js";
import "./provider-self-healing.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const CLAIM_PROVIDER_SELF_HEALING = "CLAIM_PROVIDER_SELF_HEALING";
const MARKER = "__chatchatProviderSelfHealingV2";
const NOTE_CLASS = "provider-self-healing-note";

interface ParticipantRecord {
  seatId: string;
  tabId: number;
  providerName: string;
  origin: string;
  startUrl?: string;
  createdByChatChat?: boolean;
}

interface ConnectionRecord {
  state?: string;
  detail?: string;
}

type MarkedWindow = Window & { [MARKER]?: true };

const attempted = new Set<string>();
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
  window.addEventListener("chatchat:connection-retry-requested", scheduleRefresh);
  scheduleRefresh();
}

function scheduleRefresh(): void {
  if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = undefined;
    void refresh();
  }, 0);
}

async function refresh(): Promise<void> {
  if (!chrome?.storage) return;
  const [participants, connections] = await Promise.all([
    readParticipants(),
    readConnections(),
  ]);
  const rows = participantRowMap(participants);

  for (const participant of participants) {
    const row = rows.get(participant.seatId);
    const connection = connections[participant.seatId];
    if (!row) continue;

    if (connection?.state !== "failed") {
      clearHealingState(row);
      continue;
    }

    const failure = classifyProviderRecoveryFailure(connection.detail);
    if (failure !== "automatic_page_mapping_drift") {
      clearHealingState(row);
      continue;
    }

    const episode = recoveryEpisode(participant, connection.detail);
    if (inFlight.has(episode)) continue;
    if (attempted.has(episode)) {
      clearHealingState(row);
      continue;
    }
    void tryRecover(participant, row, episode);
  }
}

async function tryRecover(
  participant: ParticipantRecord,
  row: HTMLElement,
  episode: string,
): Promise<void> {
  inFlight.add(episode);
  try {
    const inspection = await inspectProviderPage({
      tabId: participant.tabId,
      providerName: participant.providerName,
      expectedOrigin: participant.origin,
    });
    const action = planProviderRecovery({
      failure: "automatic_page_mapping_drift",
      attempted: attempted.has(episode),
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

    attempted.add(episode);
    showHealingState(row);
    await chrome.tabs.update(participant.tabId, { url: action.url });
    // No retry is dispatched here. The existing tabs.onUpdated auto-resume
    // controller owns the next connection attempt after the clean page loads.
  } catch (caught) {
    console.warn("ChatChat could not self-heal the Provider page.", caught);
    clearHealingState(row);
  } finally {
    inFlight.delete(episode);
  }
}

async function readParticipants(): Promise<ParticipantRecord[]> {
  const stored = await chrome.storage.local.get(PARTICIPANTS_KEY);
  const value = stored?.[PARTICIPANTS_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter((participant): participant is ParticipantRecord =>
    Boolean(
      participant
      && typeof participant === "object"
      && typeof participant.seatId === "string"
      && Number.isInteger(participant.tabId)
      && typeof participant.providerName === "string"
      && typeof participant.origin === "string",
    ),
  );
}

async function readConnections(): Promise<Record<string, ConnectionRecord>> {
  const area = chrome.storage.session ?? chrome.storage.local;
  const stored = await area.get(CONNECTIONS_KEY);
  const value = stored?.[CONNECTIONS_KEY];
  return value && typeof value === "object" ? value as Record<string, ConnectionRecord> : {};
}

function recoveryEpisode(participant: ParticipantRecord, detail: string | undefined): string {
  return `${participant.seatId}:${participant.tabId}:${String(detail ?? "")}`;
}

function showHealingState(row: HTMLElement): void {
  row.classList.add("connection-self-healing");
  row.querySelector(`.${NOTE_CLASS}`)?.remove();
  const note = document.createElement("div");
  note.className = NOTE_CLASS;
  note.innerHTML = `
    <span class="provider-self-healing-note__pulse" aria-hidden="true"></span>
    <span class="provider-self-healing-note__zh">ChatChat 正在重新识别这个 AI 的页面…</span>
    <span class="provider-self-healing-note__en">ChatChat is re-learning this AI page…</span>
  `;
  row.append(note);
}

function clearHealingState(row: HTMLElement): void {
  row.classList.remove("connection-self-healing");
  row.querySelector(`.${NOTE_CLASS}`)?.remove();
}
