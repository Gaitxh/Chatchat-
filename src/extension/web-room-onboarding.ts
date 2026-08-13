import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import { detectProviderUrl } from "../provider-sdk/catalog.js";
import "./web-room-onboarding.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
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
    title: "Bring your AI team in with one click.",
    body: "ChatChat finds AI sites you already have open, asks for those site permissions once, then creates clean conversation tabs so your existing chats stay untouched. Detection and protocol checks continue automatically.",
    button: "Auto-assemble my AI team",
    none: "Open the AI sites you normally use and sign in. Then return here and ChatChat will do the rest.",
    found: (count: number) => `${count} AI source${count === 1 ? "" : "s"} found in this browser`,
    working: "Preparing clean AI conversation tabs…",
    done: "AI team created. Automatic verification is taking over…",
    privacy: "Existing conversation text stays in its original AI tab.",
  },
  "zh-CN": {
    kicker: "零配置召集",
    title: "一键把你常用的 AI 拉进会议。",
    body: "ChatChat 会找到浏览器里已经打开的 AI 网站，一次请求必要的站点权限，然后为每个 AI 新开一个干净会话，所以不会污染你原来的聊天。页面识别和协议验证会继续自动完成。",
    button: "自动召集我的 AI 团队",
    none: "先打开你平时使用的 AI 网站并完成登录，然后回到这里。剩下的交给 ChatChat。",
    found: (count: number) => `这个浏览器里发现了 ${count} 个 AI 来源`,
    working: "正在准备干净的 AI 会话标签页……",
    done: "AI 团队已创建，自动验证流程正在接管……",
    privacy: "原有会话正文仍然留在原来的 AI 标签页里。",
  },
} as const;

if (document.documentElement.dataset.surface === "web-app") void mount();

async function mount() {
  const root = document.getElementById("web-onboarding-root");
  if (!root) return;
  const locale: Locale = navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const strings = COPY[locale];
  const session = chrome.storage.session ?? chrome.storage.local;
  const stored = await session.get(PARTICIPANTS_KEY);
  if (Array.isArray(stored[PARTICIPANTS_KEY]) && stored[PARTICIPANTS_KEY].length) {
    root.hidden = true;
    return;
  }

  const discovered = await discover();
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
  found.textContent = discovered.length ? strings.found(discovered.length) : strings.none;
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = discovered.length === 0;
  button.textContent = strings.button;
  const arrow = document.createElement("span");
  arrow.textContent = " →";
  button.append(arrow);
  const status = document.createElement("em");
  action.append(found, button, status);
  card.append(copy, action);
  root.append(card);

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = strings.working;
    try {
      await assemble(discovered);
      status.textContent = strings.done;
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      button.disabled = false;
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });
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
      // Ordinary browser tabs are ignored.
    }
  }
  return [...byOrigin.values()].slice(0, MAX_CONSULTATION_PARTICIPANTS);
}

async function assemble(discovered: readonly ReturnType<typeof detectProviderUrl>[]) {
  const origins = [...new Set(discovered.map((detection) => `${detection.origin}/*`))];
  const descriptor = { origins };
  if (!(await chrome.permissions.contains(descriptor))) {
    const granted = await chrome.permissions.request(descriptor);
    if (!granted) throw new Error("ChatChat needs the selected AI site permissions to connect them.");
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
