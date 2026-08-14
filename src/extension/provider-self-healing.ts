import { inspectProviderPage } from "./provider-page-inspection.js";
import {
  advanceProviderRecoveryAttempt,
  classifyProviderConnectionFailure,
  planProviderRecovery,
  type ProviderRecoveryAttemptPhase,
} from "./provider-recovery.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const RECOVERY_KEY = "chatchat.provider-self-healing.v1";
const RESET_WAIT_MS = 15_000;
const MARKER = "__chatchatProviderSelfHealingV1";

type MarkedWindow = Window & { [MARKER]?: true };
type Locale = "en" | "zh-CN";

interface ParticipantRecord {
  seatId: string;
  tabId: number;
  providerName: string;
  origin: string;
  startUrl: string;
  createdByChatChat: boolean;
}

interface ParticipantConnection {
  state?: "idle" | "connecting" | "ready" | "failed";
  detail?: string;
  automatic?: boolean;
}

interface RecoveryRecord {
  seatId: string;
  startedAt: string;
  failureKind: string;
  startUrl: string;
  phase: ProviderRecoveryAttemptPhase;
}

install();

function install() {
  const marked = window as MarkedWindow;
  if (marked[MARKER]) return;
  marked[MARKER] = true;

  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  const localeObserver = new MutationObserver(queueRefresh);
  localeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  chrome.tabs?.onUpdated?.addListener?.(() => queueRefresh());
  chrome.storage?.onChanged?.addListener?.((changes: Record<string, unknown>) => {
    if (PARTICIPANTS_KEY in changes || CONNECTIONS_KEY in changes || RECOVERY_KEY in changes) queueRefresh();
  });
  queueRefresh();
}

let queued = false;
let running = false;

function queueRefresh() {
  if (queued) return;
  queued = true;
  window.setTimeout(() => {
    queued = false;
    void refresh();
  }, 120);
}

async function refresh() {
  if (running) return;
  running = true;
  try {
    const store = chrome.storage.session ?? chrome.storage.local;
    const state = await store.get([PARTICIPANTS_KEY, CONNECTIONS_KEY, RECOVERY_KEY]);
    const participants = Array.isArray(state[PARTICIPANTS_KEY])
      ? state[PARTICIPANTS_KEY] as ParticipantRecord[]
      : [];
    const connections = isRecord(state[CONNECTIONS_KEY])
      ? state[CONNECTIONS_KEY] as Record<string, ParticipantConnection>
      : {};
    const recovery = normalizeRecovery(state[RECOVERY_KEY]);
    const rows = [...document.querySelectorAll<HTMLElement>(".participant-row")];
    const participantIds = new Set(participants.map((participant) => participant.seatId));
    let recoveryChanged = pruneMissingParticipants(recovery, participantIds);
    const now = Date.now();

    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index]!;
      const connection = connections[participant.seatId] ?? {};
      const row = rows[index];
      const record = recovery[participant.seatId];

      if (connection.state === "ready") {
        if (record) {
          delete recovery[participant.seatId];
          recoveryChanged = true;
        }
        clearRecoveryNote(row);
        continue;
      }

      if (record) {
        const resetWaitExpired = record.phase === "resetting"
          && recoveryAgeMs(record, now) >= RESET_WAIT_MS;
        const attempt = advanceProviderRecoveryAttempt({
          phase: record.phase,
          connectionState: connection.state ?? "idle",
          resetWaitExpired,
        });

        if (attempt.phase === null) {
          delete recovery[participant.seatId];
          recoveryChanged = true;
          clearRecoveryNote(row);
          continue;
        }
        if (attempt.phase !== record.phase) {
          recovery[participant.seatId] = { ...record, phase: attempt.phase };
          recoveryChanged = true;
        }
        if (attempt.visible) decorateRecovering(row, participant.providerName);
        else clearRecoveryNote(row);
        continue;
      }

      if (connection.state !== "failed") {
        clearRecoveryNote(row);
        continue;
      }

      const inspection = await inspectProviderPage(participant.tabId, participant.origin);
      const failureKind = classifyProviderConnectionFailure(connection.detail ?? "");
      const step = planProviderRecovery({
        failureKind,
        createdByChatChat: Boolean(participant.createdByChatChat),
        onExpectedOrigin: inspection?.onExpectedOrigin ?? false,
        loginRequired: inspection?.loginState === "needs_login",
        freshSessionAlreadyTried: false,
      });

      if (step !== "fresh_session_rediscovery") {
        clearRecoveryNote(row);
        continue;
      }

      recovery[participant.seatId] = {
        seatId: participant.seatId,
        startedAt: new Date().toISOString(),
        failureKind,
        startUrl: participant.startUrl,
        phase: "resetting",
      };
      recoveryChanged = true;
      decorateRecovering(row, participant.providerName);
      await store.set({ [RECOVERY_KEY]: recovery });

      try {
        await chrome.tabs.update(participant.tabId, { url: participant.startUrl });
        window.setTimeout(queueRefresh, RESET_WAIT_MS + 250);
      } catch {
        recovery[participant.seatId] = {
          ...recovery[participant.seatId]!,
          phase: "exhausted",
        };
        recoveryChanged = true;
        clearRecoveryNote(row);
        await store.set({ [RECOVERY_KEY]: recovery });
      }
    }

    if (recoveryChanged) {
      if (Object.keys(recovery).length) await store.set({ [RECOVERY_KEY]: recovery });
      else await store.remove(RECOVERY_KEY);
    }
  } catch {
    // Self-healing is best-effort. It must never interfere with manual repair,
    // Provider login, consultation, or the user's existing tabs.
  } finally {
    running = false;
  }
}

function decorateRecovering(row: HTMLElement | undefined, providerName: string) {
  if (!row) return;
  row.classList.add("connection-self-healing");
  row.setAttribute("aria-busy", "true");

  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const chip = row.querySelector<HTMLElement>(".connection-chip");
  if (chip) {
    chip.dataset.chatchatSelfHealing = "true";
    chip.textContent = locale === "zh-CN" ? "自动修复中" : "SELF-HEALING";
  }

  let note = row.querySelector<HTMLDivElement>(".self-healing-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "self-healing-note";
    note.setAttribute("role", "status");
    note.append(document.createElement("strong"), document.createElement("span"));
    row.querySelector(".participant-main")?.append(note);
  }
  const title = note.querySelector("strong");
  const body = note.querySelector("span");
  if (locale === "zh-CN") {
    if (title) title.textContent = `${providerName} 正在自动修复连接`;
    if (body) body.textContent = "ChatChat 正在重开自己创建的干净会话并重新识别页面。你不需要操作。";
  } else {
    if (title) title.textContent = `${providerName} is self-healing`;
    if (body) body.textContent = "ChatChat is reopening its own clean conversation and rediscovering the page automatically. No action needed.";
  }
}

function clearRecoveryNote(row: HTMLElement | undefined) {
  if (!row) return;
  row.classList.remove("connection-self-healing");
  row.removeAttribute("aria-busy");
  row.querySelector(".self-healing-note")?.remove();
  row.querySelector<HTMLElement>(".connection-chip")?.removeAttribute("data-chatchat-self-healing");
}

function normalizeRecovery(value: unknown): Record<string, RecoveryRecord> {
  if (!isRecord(value)) return {};
  const result: Record<string, RecoveryRecord> = {};
  for (const [seatId, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    if (typeof item.seatId !== "string" || typeof item.startedAt !== "string") continue;
    const phase = item.phase === "resetting" || item.phase === "reconnecting" || item.phase === "exhausted"
      ? item.phase
      : "exhausted";
    result[seatId] = {
      seatId: item.seatId,
      startedAt: item.startedAt,
      failureKind: typeof item.failureKind === "string" ? item.failureKind : "unknown",
      startUrl: typeof item.startUrl === "string" ? item.startUrl : "",
      phase,
    };
  }
  return result;
}

function pruneMissingParticipants(
  recovery: Record<string, RecoveryRecord>,
  participantIds: ReadonlySet<string>,
): boolean {
  let changed = false;
  for (const seatId of Object.keys(recovery)) {
    if (!participantIds.has(seatId)) {
      delete recovery[seatId];
      changed = true;
    }
  }
  return changed;
}

function recoveryAgeMs(record: RecoveryRecord, now: number): number {
  const startedAt = Date.parse(record.startedAt);
  return Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : Number.POSITIVE_INFINITY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
