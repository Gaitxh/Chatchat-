import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
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

const COPY = {
  en: {
    kicker: "ZERO-TOUCH SETUP",
    title: "One click. A clean AI team.",
    body: "ChatChat finds AI sites you already use, asks for those site permissions once, then opens a fresh conversation tab for each AI. Your existing chats stay untouched while connection and protocol checks continue automatically.",
    button: "Auto-assemble my AI team",
    none: "Open the AI sites you normally use and sign in. ChatChat keeps scanning this browser and will find them here.",
    found: (count: number) => `${count} AI source${count === 1 ? "" : "s"} ready to assemble`,
    working: "Creating clean AI conversation tabs…",
    done: "Team created. Automatic connection is taking over…",
    privacy: "You only choose the AI sites. Login stays with each provider.",
  },
  "zh-CN": {
    kicker: "零配置召集",
    title: "只点一次，组建一个干净的 AI 团队。",
    body: "ChatChat 会找到你平时使用的 AI 网站，一次请求必要的站点权限，然后为每个 AI 新开一个干净会话。原来的聊天不会被拿来做握手，连通检查和协商协议验证会自动继续。",
    button: "自动召集我的 AI 团队",
    none: "打开你平时使用的 AI 网站并完成登录。ChatChat 会继续扫描这个浏览器，发现后会自动显示在这里。",
    found: (count: number) => `发现 ${count} 个可以召集的 AI 来源`,
    working: "正在创建干净的 AI 会话标签页……",
    done: "AI 团队已创建，自动连接流程正在接管……",
    privacy: "你只负责选择 AI 网站，登录状态仍由各个 Provider 自己管理。",
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
  const locale: Locale = navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const strings = COPY[locale];
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get(PARTICIPANTS_KEY);
  const hasParticipants = Array.isArray(stored[PARTICIPANTS_KEY]) && stored[PARTICIPANTS_KEY].length > 0;
  if (hasParticipants) {
    root.hidden = true;
    if (guideRoot) guideRoot.hidden = false;
    return;
  }

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
  root.append(card);

  let discovered = await discover();
  renderDiscovery();
  const scan = window.setInterval(async () => {
    if (discovered.length) return;
    discovered = await discover();
    renderDiscovery();
  }, 2500);

  button.addEventListener("click", async () => {
    if (!discovered.length) {
      discovered = await discover();
      renderDiscovery();
      return;
    }
    button.disabled = true;
    status.textContent = strings.working;
    try {
      await assemble(discovered);
      window.clearInterval(scan);
      status.textContent = strings.done;
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      button.disabled = false;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  function renderDiscovery() {
    found.textContent = discovered.length ? strings.found(discovered.length) : strings.none;
    button.disabled = discovered.length === 0;
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

async function discover() {
  const tabs = (await chrome.tabs.query({})) as BrowserTab[];
  const byOrigin = new Map<string, ReturnType<typeof detectProviderUrl>>();
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

async function assemble(discovered: readonly ReturnType<typeof detectProviderUrl>[]) {
  const origins = [...new Set(discovered.map((detection) => `${detection.origin}/*`))];
  const descriptor = { origins };
  if (!(await chrome.permissions.contains(descriptor))) {
    const granted = await chrome.permissions.request(descriptor);
    if (!granted) throw new Error("ChatChat needs permission for the selected AI sites before it can connect them.");
  }

  const participants: ParticipantRecord[] = [];
  const connections: Record<string, { state: "idle"; automatic: true }> = {};
  for (const detection of discovered) {
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
  }
  if (!participants.length) throw new Error("ChatChat could not create a clean AI conversation tab.");
  const session = chrome.storage.session ?? chrome.storage.local;
  await session.set({ [PARTICIPANTS_KEY]: participants, [CONNECTIONS_KEY]: connections });
}
