import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
import {
  automaticTeamLaunchUrl,
  automaticTeamPermissionDescriptor,
  buildAutomaticTeamPlan,
  type AutomaticTeamDetection,
} from "./automatic-team.js";
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
    kicker: "ZERO-CONFIG START",
    title: "Open ChatChat. The room assembles itself.",
    body: "ChatChat notices the AI sites already open in your browser to choose a useful team, then opens clean consultation tabs so your existing conversations stay untouched. Page recognition, connection checks, and consultation readiness continue automatically.",
    button: "Assemble my AI room",
    none: "No AI tabs are open yet. ChatChat can open a small starter team for you — no setup forms or technical configuration.",
    found: (count: number) => `${count} AI source${count === 1 ? "" : "s"} already found`,
    plan: (names: string) => `Automatic team: ${names}`,
    working: "Preparing clean consultation tabs without touching your existing AI chats…",
    done: "The room is assembled. Automatic connection is taking over…",
    privacy: "Your existing AI conversations stay untouched. The only unavoidable first-run step is the browser's own site-permission confirmation; Provider login remains with each AI site.",
    denied: "Site access was not granted. ChatChat cannot connect those AI pages without the browser's permission.",
    failed: "ChatChat could not assemble at least two AI participants.",
  },
  "zh-CN": {
    kicker: "零配置开始",
    title: "打开 ChatChat，会议室自己组起来。",
    body: "ChatChat 会识别浏览器里已经打开的 AI，用它们决定这次会议的团队；真正开会时会另开干净的专用会话，不会往你原来的聊天里塞握手或协商内容。页面识别、连接检查和协商就绪验证都会自动继续。",
    button: "组建我的 AI 会议室",
    none: "现在还没有打开 AI 标签页。ChatChat 可以直接替你打开一组起步 AI——不用填配置表，也不用理解任何技术设置。",
    found: (count: number) => `已经发现 ${count} 个 AI 来源`,
    plan: (names: string) => `自动团队：${names}`,
    working: "正在准备干净的会议专用会话，不会改动你原来的 AI 聊天……",
    done: "会议室已经组好，自动连接流程正在接管……",
    privacy: "你原来的 AI 对话不会被改动。第一次唯一无法省掉的是浏览器自己的站点权限确认；各 AI 的登录状态仍然只留在各自网站。",
    denied: "没有获得站点权限。浏览器不允许 ChatChat 在未授权时连接这些 AI 页面。",
    failed: "ChatChat 没能组建出至少两位 AI 参与者。",
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
  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh")
    || navigator.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en";
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
  let permissionReady = false;
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
      let granted = permissionReady;
      if (!granted) {
        granted = await chrome.permissions.request(automaticTeamPermissionDescriptor(plan));
      }
      if (!granted) throw new Error(strings.denied);
      await assemble(plan, strings.failed);
      completeAssembly();
    } catch (error) {
      starting = false;
      button.disabled = false;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  async function refreshPlan() {
    discovered = await discover();
    plan = buildAutomaticTeamPlan(discovered, MAX_CONSULTATION_PARTICIPANTS);
    permissionReady = plan.length > 0
      && await chrome.permissions.contains(automaticTeamPermissionDescriptor(plan));
    found.textContent = discovered.length ? strings.found(discovered.length) : strings.none;
    status.textContent = plan.length ? strings.plan(plan.map((item) => item.displayName).join(" · ")) : "";
    button.disabled = starting || plan.length < 2;

    if (permissionReady && plan.length >= 2 && !starting) {
      starting = true;
      button.disabled = true;
      status.textContent = strings.working;
      try {
        await assemble(plan, strings.failed);
        completeAssembly();
      } catch (error) {
        starting = false;
        button.disabled = false;
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    }
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

async function assemble(plan: readonly AutomaticTeamDetection[], failureMessage: string) {
  const participants: ParticipantRecord[] = [];
  const connections: Record<string, { state: "idle"; automatic: true }> = {};

  for (const detection of plan) {
    const startUrl = automaticTeamLaunchUrl(detection);
    const fresh = await createAutomaticTeamTab(startUrl);
    if (!fresh?.id) continue;

    const seatId = `extension:${detection.providerId}:${fresh.id}`;
    participants.push({
      seatId,
      participantId: seatId,
      tabId: fresh.id,
      providerId: detection.providerId,
      providerName: detection.displayName,
      origin: detection.origin,
      url: fresh.url ?? startUrl,
      hostname: detection.hostname,
      startUrl,
      createdByChatChat: true,
    });
    connections[seatId] = { state: "idle", automatic: true };
  }
  if (participants.length < 2) throw new Error(failureMessage);
  const session = chrome.storage.session ?? chrome.storage.local;
  await session.set({ [PARTICIPANTS_KEY]: participants, [CONNECTIONS_KEY]: connections });
}

async function createAutomaticTeamTab(startUrl: string): Promise<{ id?: number; url?: string }> {
  const fresh = await chrome.tabs.create({ url: startUrl, active: false });
  return {
    id: fresh?.id,
    url: fresh?.url ?? startUrl,
  };
}
