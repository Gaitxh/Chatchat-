import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
import {
  buildAutomaticTeamPlan,
  type AutomaticTeamDetection,
} from "./automatic-team.js";
import { createFreshSeat, FreshSeatError, planFreshSeat, waitForFreshSeatTab } from "./fresh-seat.js";
import { announceAutomaticTeamAssembled } from "./automatic-team-wire.js";
import { requestConnectionRetry } from "./connection-retry-wire.js";
import "./web-room-onboarding.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const resumeCooldown = new Map<string, number>();
type Locale = "en" | "zh-CN";

interface BrowserTab { id?: number; url?: string; title?: string; }
interface ParticipantRecord {
  seatId: string;
  participantId: string;
  tabId: number;
  providerId: string;
  providerName: string;
  origin: string;
  url: string;
  hostname: string;
  startUrl: string;
  createdByChatChat: boolean;
}

interface ParticipantConnectionSnapshot {
  state?: "idle" | "connecting" | "ready" | "failed";
}

const COPY = {
  en: {
    kicker: "CHOOSE YOUR AI TEAM",
    title: "Choose who joins your room.",
    body: "Use + Invite AI below to choose providers one at a time. If you prefer, explicitly assemble the suggested starter team instead. Existing AI tabs only inform suggestions; they never receive setup messages.",
    button: "Use suggested starter team",
    none: "No AI tabs found. Choose your own providers below, or use the optional starter team.",
    found: (count: number) => `${count} AI source${count === 1 ? "" : "s"} already found`,
    plan: (names: string) => `Optional starter team: ${names}`,
    working: "Opening new-chat entries in separate tabs without touching your existing AI chats…",
    done: "The room is assembled. Automatic connection is taking over…",
    privacy: "Site access is requested only for your chosen sites. New-chat entries and connection checks cannot prove a provider created a fresh conversation. Login stays with each AI site.",
    denied: "Site access was not granted. ChatChat cannot connect those AI pages without the browser's permission.",
    failed: "Starter assembly could not finish. Any seats already added remain available; you can invite the rest yourself.",
    cleanupFailed: "Setup failed and a new tab could not be closed. Close it manually before retrying.",
  },
  "zh-CN": {
    kicker: "自选 AI 团队",
    title: "选择谁来加入你的会议。",
    body: "通过下方“＋ 邀请 AI”逐个选择网站。你也可以明确选择使用建议的起步团队。已有 AI 标签页仅用于建议，不会收到连接消息。",
    button: "使用建议的起步团队",
    none: "尚未发现 AI 标签页。请在下方自选网站，或选择可选的起步团队。",
    found: (count: number) => `已经发现 ${count} 个 AI 来源`,
    plan: (names: string) => `可选起步团队：${names}`,
    working: "正在另开标签页访问新对话入口，不会改动你原来的 AI 聊天……",
    done: "会议室已经组好，自动连接流程正在接管……",
    privacy: "仅为你选择的网站请求访问权限。打开新对话入口和通过连接检查不能证明网站已创建全新对话。登录仍由各 AI 网站管理。",
    denied: "没有获得站点权限。浏览器不允许 ChatChat 在未授权时连接这些 AI 页面。",
    failed: "起步团队未能全部加入。已经加入的席位仍可使用，你可以自行邀请其余 AI。",
    cleanupFailed: "连接失败，且无法关闭新标签页。请先手动关闭该标签页，再重试。",
  },
} as const;

if (document.documentElement.dataset.surface === "web-app") {
  installLoginResume();
  void mount();
}

async function mount() {
  const root = document.getElementById("web-onboarding-root");
  const guideRoot = document.getElementById("first-run-guide-root");
  if (!root) return;
  const onboardingRoot = root;
  // An explicit page locale wins over the operating system language. Using
  // navigator.language as an OR condition forced Chinese onboarding on an
  // English page whenever the host/browser was configured in Chinese.
  const pageLanguage = document.documentElement.lang.trim().toLowerCase();
  const preferredLanguage = pageLanguage || navigator.language?.toLowerCase() || "en";
  const locale: Locale = preferredLanguage.startsWith("zh") ? "zh-CN" : "en";
  const strings = COPY[locale];
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get(PARTICIPANTS_KEY);
  const hasParticipants = Array.isArray(stored[PARTICIPANTS_KEY]) && stored[PARTICIPANTS_KEY].length > 0;
  if (hasParticipants) {
    finishOnboarding();
    return;
  }

  document.documentElement.dataset.chatchatOnboarding = "zero-config";
  if (guideRoot) guideRoot.hidden = true;
  const card = document.createElement("section");
  card.className = "zero-touch-card";
  card.setAttribute("aria-live", "polite");
  const copy = document.createElement("div");
  copy.className = "zero-touch-copy";
  const kicker = document.createElement("span");
  kicker.className = "zero-touch-kicker";
  kicker.textContent = strings.kicker;
  const title = document.createElement("h2");
  title.textContent = strings.title;
  const body = document.createElement("p");
  body.textContent = strings.body;
  const privacy = document.createElement("small");
  privacy.textContent = strings.privacy;
  copy.append(kicker, title, body, privacy);

  const action = document.createElement("div");
  action.className = "zero-touch-action";
  const found = document.createElement("strong");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = strings.button;
  const arrow = document.createElement("span");
  arrow.textContent = " →";
  button.append(arrow);
  const status = document.createElement("em");
  action.append(found, button, status);
  card.append(copy, action);
  onboardingRoot.append(card);

  let discovered: AutomaticTeamDetection[] = [];
  let plan: AutomaticTeamDetection[] = [];
  let starting = false;
  let scan: number | undefined;

  await refreshPlan();

  if (!starting) {
    scan = window.setInterval(() => {
      if (!starting) void refreshPlan();
    }, 2500);
  }

  button.addEventListener("click", async () => {
    if (starting || !plan.length) return;
    starting = true;
    button.disabled = true;
    status.textContent = strings.working;
    try {
      const selected = [...plan];
      const descriptor = {
        origins: [...new Set(selected.flatMap((item) => planFreshSeat(item.normalizedUrl).permissionOrigins)
          .map((origin) => `${origin}/*`))],
      };
      const granted = await chrome.permissions.request(descriptor);
      if (!granted) throw new Error(strings.denied);
      await assemble(selected, strings.failed, descriptor.origins);
      completeAssembly();
    } catch (error) {
      starting = false;
      button.disabled = false;
      status.textContent = error instanceof FreshSeatError && error.code === "cleanup-failed"
        ? strings.cleanupFailed
        : error instanceof Error ? error.message : String(error);
    }
  });

  async function refreshPlan() {
    const current = await session.get(PARTICIPANTS_KEY);
    if (Array.isArray(current[PARTICIPANTS_KEY]) && current[PARTICIPANTS_KEY].length > 0) {
      clearScan();
      finishOnboarding();
      return;
    }
    discovered = await discover();
    plan = buildAutomaticTeamPlan(discovered, MAX_CONSULTATION_PARTICIPANTS);
    found.textContent = discovered.length ? strings.found(discovered.length) : strings.none;
    status.textContent = plan.length ? strings.plan(plan.map((item) => item.displayName).join(" · ")) : "";
    button.disabled = starting || plan.length < 2;
    // Existing permissions are capability, never consent to choose a team.
  }

  function completeAssembly() {
    clearScan();
    status.textContent = strings.done;
    announceAutomaticTeamAssembled();
    finishOnboarding();
  }

  function clearScan() {
    if (scan === undefined) return;
    window.clearInterval(scan);
    scan = undefined;
  }

  function finishOnboarding() {
    delete document.documentElement.dataset.chatchatOnboarding;
    onboardingRoot.hidden = true;
    if (guideRoot) guideRoot.hidden = false;
  }
}

function installLoginResume() {
  if (!chrome.tabs?.onUpdated?.addListener) return;
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: { status?: string; url?: string }) => {
    if (changeInfo.status !== "complete" && !changeInfo.url) return;
    window.setTimeout(() => void retryAfterLogin(tabId), 1000);
  });
}

async function retryAfterLogin(tabId: number) {
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
  const participants = Array.isArray(stored[PARTICIPANTS_KEY])
    ? (stored[PARTICIPANTS_KEY] as ParticipantRecord[])
    : [];
  const participant = participants.find((item) => item.tabId === tabId);
  if (!participant) return;

  const connections = (stored[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnectionSnapshot>;
  const connection = connections[participant.seatId];
  if (connection?.state === "ready" || connection?.state === "connecting") return;

  const last = resumeCooldown.get(participant.seatId) ?? 0;
  if (Date.now() - last < 8000) return;
  resumeCooldown.set(participant.seatId, Date.now());
  requestConnectionRetry(participant.seatId, "provider-tab-loaded");
}

async function discover(): Promise<AutomaticTeamDetection[]> {
  const tabs = (await chrome.tabs.query({})) as BrowserTab[];
  const byOrigin = new Map<string, AutomaticTeamDetection>();
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) continue;
    try {
      const detection = detectProviderUrl(tab.url);
      if (detection.kind === "known" && !byOrigin.has(detection.origin)) byOrigin.set(detection.origin, detection);
    } catch {
      // Ignore ordinary non-AI tabs.
    }
  }
  return [...byOrigin.values()].slice(0, MAX_CONSULTATION_PARTICIPANTS);
}

async function assemble(plan: readonly AutomaticTeamDetection[], failureMessage: string, grantedPatterns: readonly string[]) {
  const session = chrome.storage.session ?? chrome.storage.local;
  for (const detection of plan) {
    try {
      await createFreshSeat(planFreshSeat(detection.normalizedUrl), {
        readParticipants: async () => {
          const stored = await session.get(PARTICIPANTS_KEY);
          return Array.isArray(stored[PARTICIPANTS_KEY]) ? stored[PARTICIPANTS_KEY] : [];
        },
        writeParticipants: (participants) => session.set({ [PARTICIPANTS_KEY]: participants }),
        requestPermissions: async (origins) => {
          if (origins.some((origin) => !grantedPatterns.includes(`${origin}/*`))) {
            throw new Error(failureMessage);
          }
        },
        createTab: (url) => chrome.tabs.create({ url, active: false }),
        waitForTab: (tabId) => waitForFreshSeatTab(tabId, (id) => chrome.tabs.get(id)),
        getTab: (tabId) => chrome.tabs.get(tabId),
        removeTab: (tabId) => chrome.tabs.remove(tabId),
      });
    } catch (error) {
      if (error instanceof FreshSeatError && error.code === "duplicate-origin") continue;
      // Keep successfully committed seats; a failed new tab is cleaned up by createFreshSeat.
      announceAutomaticTeamAssembled();
      if (error instanceof FreshSeatError && error.code === "cleanup-failed") throw error;
      throw new Error(failureMessage);
    }
  }
}
