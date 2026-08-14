import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
import {
  automaticTeamPermissionDescriptor,
  buildAutomaticTeamPlan,
  type AutomaticTeamDetection,
} from "./automatic-team.js";
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

interface ParticipantConnection {
  state: string;
  detail?: string;
  verifiedAt?: string;
  automatic?: boolean;
}

interface LiveRoomState {
  participants: ParticipantRecord[];
  connections: Record<string, ParticipantConnection>;
  hadStoredParticipants: boolean;
}

const COPY = {
  en: {
    kicker: "ZERO-CONFIG START",
    title: "Open ChatChat. The room assembles itself.",
    body: "ChatChat uses AI sites already open in your browser first. If there are not enough, one click opens a small starter team in clean conversation tabs. Page recognition, connection checks, and consultation readiness all continue automatically.",
    button: "Start automatic setup",
    none: "No AI tabs are open yet. ChatChat can open a starter team for you — no setup forms or technical configuration.",
    found: (count: number) => `${count} AI source${count === 1 ? "" : "s"} already found`,
    plan: (names: string) => `Automatic team: ${names}`,
    working: "Preparing clean AI conversation tabs…",
    done: "The room is assembled. Automatic connection is taking over…",
    privacy: "The only unavoidable first-run step is the browser's own site-permission confirmation. Provider login stays with each AI site.",
    denied: "Site access was not granted. ChatChat cannot connect those AI pages without the browser's permission.",
    failed: "ChatChat could not create enough clean AI conversation tabs.",
    keeperKicker: "ROOM KEEPER",
    keeperTitle: "An AI wandered off. ChatChat can restore the room.",
    keeperBody: "A participant tab disappeared or became stale. ChatChat keeps every participant that is still alive and reopens only what is missing — no manual reconfiguration.",
    keeperButton: "Restore the room",
    keeperFound: (count: number) => `${count} live participant${count === 1 ? "" : "s"} preserved`,
    keeperWorking: "Restoring the missing AI participant…",
    keeperDone: "Room restored. Automatic connection is resuming…",
  },
  "zh-CN": {
    kicker: "零配置开始",
    title: "打开 ChatChat，会议室自己组起来。",
    body: "ChatChat 会优先使用浏览器里已经打开的 AI；数量不够时，只点一次就会自动打开一组干净的 AI 会话。页面识别、连接检查和协商就绪验证都会自动继续。",
    button: "开始自动配置",
    none: "现在还没有打开 AI 标签页。ChatChat 可以直接替你打开一组起步 AI——不用填配置表，也不用理解任何技术设置。",
    found: (count: number) => `已经发现 ${count} 个 AI 来源`,
    plan: (names: string) => `自动团队：${names}`,
    working: "正在准备干净的 AI 会话标签页……",
    done: "会议室已经组好，自动连接流程正在接管……",
    privacy: "第一次唯一无法省掉的是浏览器自己的站点权限确认；各 AI 的登录状态仍然只留在各自网站。",
    denied: "没有获得站点权限。浏览器不允许 ChatChat 在未授权时连接这些 AI 页面。",
    failed: "ChatChat 没能创建足够的干净 AI 会话标签页。",
    keeperKicker: "会议室管家",
    keeperTitle: "有 AI 掉队了，ChatChat 会把会议室补回来。",
    keeperBody: "某个参与者标签页被关闭或已经失效。ChatChat 会保留仍然在线的参与者，只补回缺少的 AI，不让你重新配置。",
    keeperButton: "自动恢复会议室",
    keeperFound: (count: number) => `保留 ${count} 位仍在线的参与者`,
    keeperWorking: "正在补回缺少的 AI 参与者……",
    keeperDone: "会议室已恢复，自动连接正在继续……",
  },
} as const;

if (document.documentElement.dataset.surface === "web-app") {
  installLoginResume();
  installRoomKeeper();
  void mount();
}

async function mount() {
  const root = document.getElementById("web-onboarding-root");
  const guideRoot = document.getElementById("first-run-guide-root");
  if (!root) return;
  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh")
    || navigator.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en";
  const strings = COPY[locale];
  const session = chrome.storage.session ?? chrome.storage.local;
  const room = await readLiveRoomState(session);
  const recovering = room.hadStoredParticipants && room.participants.length < 2;

  if (room.participants.length >= 2) {
    delete document.documentElement.dataset.chatchatOnboarding;
    root.hidden = true;
    if (guideRoot) guideRoot.hidden = false;
    return;
  }

  document.documentElement.dataset.chatchatOnboarding = recovering ? "room-recovery" : "zero-config";
  if (guideRoot) guideRoot.hidden = true;
  root.replaceChildren();

  const card = document.createElement("section");
  card.className = `zero-touch-card${recovering ? " room-keeper-card" : ""}`;
  card.setAttribute("aria-live", "polite");
  const copy = document.createElement("div");
  copy.className = "zero-touch-copy";
  const kicker = document.createElement("span");
  kicker.className = "zero-touch-kicker";
  kicker.textContent = recovering ? strings.keeperKicker : strings.kicker;
  const title = document.createElement("h2");
  title.textContent = recovering ? strings.keeperTitle : strings.title;
  const body = document.createElement("p");
  body.textContent = recovering ? strings.keeperBody : strings.body;
  const privacy = document.createElement("small");
  privacy.textContent = strings.privacy;
  copy.append(kicker, title, body, privacy);

  const action = document.createElement("div");
  action.className = "zero-touch-action";
  const found = document.createElement("strong");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = recovering ? strings.keeperButton : strings.button;
  const arrow = document.createElement("span");
  arrow.textContent = " →";
  button.append(arrow);
  const status = document.createElement("em");
  action.append(found, button, status);
  card.append(copy, action);
  root.append(card);

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
    status.textContent = recovering ? strings.keeperWorking : strings.working;
    try {
      let granted = permissionReady;
      if (!granted) {
        granted = await chrome.permissions.request(automaticTeamPermissionDescriptor(plan));
      }
      if (!granted) throw new Error(strings.denied);
      await assemble(plan, strings.failed, room.participants, room.connections);
      clearScan();
      status.textContent = recovering ? strings.keeperDone : strings.done;
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      starting = false;
      button.disabled = false;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  async function refreshPlan() {
    discovered = await discover();
    const known = mergeRetainedDetections(discovered, room.participants);
    plan = buildAutomaticTeamPlan(known, MAX_CONSULTATION_PARTICIPANTS);
    permissionReady = plan.length > 0
      && await chrome.permissions.contains(automaticTeamPermissionDescriptor(plan));
    found.textContent = recovering
      ? strings.keeperFound(room.participants.length)
      : discovered.length
        ? strings.found(discovered.length)
        : strings.none;
    status.textContent = plan.length ? strings.plan(plan.map((item) => item.displayName).join(" · ")) : "";
    button.disabled = starting || plan.length < 2;

    if (permissionReady && plan.length >= 2 && !starting) {
      starting = true;
      button.disabled = true;
      status.textContent = recovering ? strings.keeperWorking : strings.working;
      try {
        await assemble(plan, strings.failed, room.participants, room.connections);
        clearScan();
        status.textContent = recovering ? strings.keeperDone : strings.done;
        window.setTimeout(() => window.location.reload(), 650);
      } catch (error) {
        starting = false;
        button.disabled = false;
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    }
  }

  function clearScan() {
    if (scan === undefined) return;
    window.clearInterval(scan);
    scan = undefined;
  }
}

function installLoginResume() {
  if (!chrome.tabs?.onUpdated?.addListener) return;
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: { status?: string; url?: string }) => {
    if (changeInfo.status !== "complete" && !changeInfo.url) return;
    window.setTimeout(() => void retryAfterLogin(tabId), 1000);
  });
}

function installRoomKeeper() {
  if (!chrome.tabs?.onRemoved?.addListener) return;
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    void recoverAfterUnexpectedTabClose(tabId);
  });
}

async function recoverAfterUnexpectedTabClose(tabId: number) {
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
  const participants = Array.isArray(stored[PARTICIPANTS_KEY])
    ? stored[PARTICIPANTS_KEY] as ParticipantRecord[]
    : [];
  if (!participants.some((participant) => participant.tabId === tabId)) return;

  const nextParticipants = participants.filter((participant) => participant.tabId !== tabId);
  const currentConnections = (stored[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnection>;
  const nextConnections = Object.fromEntries(
    nextParticipants.map((participant) => [
      participant.seatId,
      currentConnections[participant.seatId] ?? { state: "idle", automatic: true },
    ]),
  );
  await session.set({
    [PARTICIPANTS_KEY]: nextParticipants,
    [CONNECTIONS_KEY]: nextConnections,
  });

  if (nextParticipants.length < 2) {
    window.setTimeout(() => window.location.reload(), 180);
  }
}

async function retryAfterLogin(tabId: number) {
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get(PARTICIPANTS_KEY);
  const participants = Array.isArray(stored[PARTICIPANTS_KEY])
    ? (stored[PARTICIPANTS_KEY] as ParticipantRecord[])
    : [];
  const index = participants.findIndex((participant) => participant.tabId === tabId);
  if (index < 0) return;
  const seatId = participants[index]!.seatId;
  const last = resumeCooldown.get(seatId) ?? 0;
  if (Date.now() - last < 8000) return;
  const row = [...document.querySelectorAll<HTMLElement>(".participant-row")][index];
  if (!row || row.classList.contains("connection-ready") || row.classList.contains("connection-connecting")) return;
  const retry = [...document.querySelectorAll<HTMLButtonElement>(".setup-participant .verify-button")][index];
  if (!retry || retry.disabled || retry.classList.contains("is-ready")) return;
  resumeCooldown.set(seatId, Date.now());
  retry.click();
}

async function readLiveRoomState(session: any): Promise<LiveRoomState> {
  const stored = await session.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
  const restored = Array.isArray(stored[PARTICIPANTS_KEY])
    ? stored[PARTICIPANTS_KEY] as ParticipantRecord[]
    : [];
  const storedConnections = (stored[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnection>;
  const alive: ParticipantRecord[] = [];

  for (const participant of restored) {
    try {
      const tab = await chrome.tabs.get(participant.tabId);
      if (tab?.id && tab?.url) alive.push({ ...participant, url: tab.url });
    } catch {
      // Stale browser tab ids are removed before deciding whether onboarding is complete.
    }
  }

  const connections = Object.fromEntries(
    alive.map((participant) => [
      participant.seatId,
      storedConnections[participant.seatId] ?? { state: "idle", automatic: true },
    ]),
  ) as Record<string, ParticipantConnection>;

  if (alive.length !== restored.length) {
    await session.set({
      [PARTICIPANTS_KEY]: alive,
      [CONNECTIONS_KEY]: connections,
    });
  }

  return {
    participants: alive,
    connections,
    hadStoredParticipants: restored.length > 0,
  };
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

function mergeRetainedDetections(
  discovered: readonly AutomaticTeamDetection[],
  retained: readonly ParticipantRecord[],
): AutomaticTeamDetection[] {
  const byOrigin = new Map(discovered.map((item) => [item.origin, item]));
  for (const participant of retained) {
    if (byOrigin.has(participant.origin)) continue;
    try {
      const detection = detectProviderUrl(participant.startUrl || participant.origin);
      if (detection.kind === "known") byOrigin.set(detection.origin, detection);
    } catch {
      // A retained custom participant stays in storage even if it cannot seed a built-in plan.
    }
  }
  return [...byOrigin.values()];
}

async function assemble(
  plan: readonly AutomaticTeamDetection[],
  failureMessage: string,
  retained: readonly ParticipantRecord[] = [],
  retainedConnections: Readonly<Record<string, ParticipantConnection>> = {},
) {
  const participants: ParticipantRecord[] = [...retained];
  const connections: Record<string, ParticipantConnection> = Object.fromEntries(
    retained.map((participant) => [
      participant.seatId,
      retainedConnections[participant.seatId] ?? { state: "idle", automatic: true },
    ]),
  );
  const origins = new Set(participants.map((participant) => participant.origin));

  for (const detection of plan) {
    if (origins.has(detection.origin)) continue;
    const startUrl = detection.manifest?.defaultUrl ?? detection.normalizedUrl;
    const fresh = await chrome.tabs.create({ url: startUrl, active: false });
    if (!fresh?.id) continue;
    const seatId = `extension:${detection.providerId}:${fresh.id}`;
    participants.push({
      seatId,
      participantId: seatId,
      tabId: fresh.id,
      providerId: detection.providerId,
      providerName: detection.displayName,
      origin: detection.origin,
      url: startUrl,
      hostname: detection.hostname,
      startUrl,
      createdByChatChat: true,
    });
    connections[seatId] = { state: "idle", automatic: true };
    origins.add(detection.origin);
    if (participants.length >= MAX_CONSULTATION_PARTICIPANTS) break;
  }

  if (participants.length < 2) throw new Error(failureMessage);
  const session = chrome.storage.session ?? chrome.storage.local;
  await session.set({
    [PARTICIPANTS_KEY]: participants,
    [CONNECTIONS_KEY]: connections,
  });
}
