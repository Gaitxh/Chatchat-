import { participantRowMap } from "./participant-row-identity.js";
import { inspectProviderPage } from "./provider-page-inspection.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const INSPECTION_TTL_MS = 5_000;
const inspectionCache = new Map<string, { url: string; state: "needs_login" | "not_login"; at: number }>();
let queued = false;
let running = false;

type Locale = "en" | "zh-CN";

interface ParticipantRecord {
  seatId: string;
  tabId: number;
  providerName: string;
  origin: string;
  hostname: string;
}

install();

function install() {
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
  queueRefresh();
}

function queueRefresh() {
  if (queued) return;
  queued = true;
  window.setTimeout(() => {
    queued = false;
    void refresh();
  }, 90);
}

async function refresh() {
  if (running) return;
  running = true;
  try {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get(PARTICIPANTS_KEY);
    const participants = Array.isArray(stored[PARTICIPANTS_KEY])
      ? stored[PARTICIPANTS_KEY] as ParticipantRecord[]
      : [];
    const rowsBySeat = participantRowMap(participants);

    for (const row of document.querySelectorAll<HTMLElement>(".participant-row")) {
      if (!row.dataset.seatId || !rowsBySeat.has(row.dataset.seatId)) clearLoginState(row);
    }

    await Promise.all(participants.map(async (participant) => {
      const row = rowsBySeat.get(participant.seatId);
      if (!row) return;
      if (!row.classList.contains("connection-failed")) {
        clearLoginState(row);
        return;
      }

      const needsLogin = await participantNeedsLogin(participant);
      if (needsLogin) decorateLoginState(row, participant.providerName);
      else clearLoginState(row);
    }));

    if ([...rowsBySeat.values()].some((row) => row.classList.contains("connection-needs-login"))) {
      document.documentElement.dataset.chatchatLoginPending = "true";
    } else {
      delete document.documentElement.dataset.chatchatLoginPending;
    }
  } catch {
    // Login guidance is best-effort and must never interfere with consultation.
  } finally {
    running = false;
  }
}

async function participantNeedsLogin(participant: ParticipantRecord): Promise<boolean> {
  let tab: { url?: string };
  try {
    tab = await chrome.tabs.get(participant.tabId);
  } catch {
    return false;
  }

  const currentUrl = String(tab?.url ?? "");
  if (!currentUrl) return false;
  const cached = inspectionCache.get(participant.seatId);
  if (cached && cached.url === currentUrl && Date.now() - cached.at < INSPECTION_TTL_MS) {
    return cached.state === "needs_login";
  }

  const inspection = await inspectProviderPage({
    tabId: participant.tabId,
    expectedOrigin: participant.origin,
  });
  inspectionCache.set(participant.seatId, {
    url: inspection.currentUrl,
    state: inspection.loginState,
    at: Date.now(),
  });
  return inspection.loginState === "needs_login";
}

function decorateLoginState(row: HTMLElement, providerName: string) {
  row.classList.add("connection-needs-login");
  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const openButton = row.querySelector<HTMLButtonElement>(".participant-row-actions button:first-child");
  if (openButton) {
    if (!openButton.dataset.conciergeOriginalLabel) {
      openButton.dataset.conciergeOriginalLabel = openButton.textContent?.trim() || "Open";
    }
    openButton.textContent = locale === "zh-CN" ? "去登录" : "Sign in";
  }

  let note = row.querySelector<HTMLDivElement>(".login-concierge-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "login-concierge-note";
    note.append(document.createElement("strong"), document.createElement("span"));
    row.querySelector(".participant-main")?.append(note);
  }
  const strong = note.querySelector("strong");
  const body = note.querySelector("span");
  if (locale === "zh-CN") {
    if (strong) strong.textContent = `去 ${providerName} 完成登录`;
    if (body) body.textContent = "登录完成后不用回来点重试。页面加载后，ChatChat 会自动继续连接。";
  } else {
    if (strong) strong.textContent = `Sign in to ${providerName}`;
    if (body) body.textContent = "No retry needed. After the page finishes loading, ChatChat will continue automatically.";
  }
}

function clearLoginState(row: HTMLElement) {
  row.classList.remove("connection-needs-login");
  row.querySelector(".login-concierge-note")?.remove();
  const openButton = row.querySelector<HTMLButtonElement>(".participant-row-actions button:first-child");
  if (openButton?.dataset.conciergeOriginalLabel) {
    openButton.textContent = openButton.dataset.conciergeOriginalLabel;
    delete openButton.dataset.conciergeOriginalLabel;
  }
}
