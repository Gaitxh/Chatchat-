import { MAX_CONSULTATION_PARTICIPANTS } from "../consultation/equality.js";
import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
} from "../provider-sdk/catalog.js";
import "./web-room-onboarding.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const STARTER_PROVIDER_IDS = ["openai-chatgpt", "anthropic-claude", "google-gemini"] as const;
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
    kicker: "AUTOMATIC AI ROOM",
    title: "Choose the AIs. ChatChat handles the wiring.",
    body: "Pick at least two AI providers. ChatChat requests site access once, opens clean conversations, figures out how to talk to each AI, performs a quick connection check, verifies that each one can join the meeting, and keeps retrying after login — automatically.",
    detected: (count: number) => count ? `${count} provider${count === 1 ? " is" : "s are"} already open in this browser` : "No AI tab needs to be open first",
    selected: (count: number) => `${count} AI${count === 1 ? "" : "s"} selected`,
    open: "OPEN",
    starter: "STARTER",
    button: (count: number) => `Build my room with ${count} AIs`,
    working: "Opening clean AI conversations and handing setup to the automatic connector…",
    done: "Room created. ChatChat is connecting and verifying every AI now…",
    hint: "If a provider asks you to sign in, sign in normally in that tab. ChatChat resumes by itself after the page loads.",
    privacy: "No API keys. No technical setup. Login stays with each provider.",
  },
  "zh-CN": {
    kicker: "自动 AI 会议室",
    title: "你只选 AI，剩下的交给 ChatChat。",
    body: "选择至少两个 AI。ChatChat 会一次请求必要的网站权限、打开干净的新会话、自己找到如何与每个 AI 对话、完成快速连通检查、确认它能参加会议，并在登录完成后自动继续。",
    detected: (count: number) => count ? `这个浏览器里已经打开了 ${count} 个 AI 来源` : "不需要提前打开任何 AI 标签页",
    selected: (count: number) => `已选择 ${count} 个 AI`,
    open: "已打开",
    starter: "推荐",
    button: (count: number) => `用 ${count} 个 AI 组建会议室`,
    working: "正在打开干净的 AI 会话，并把后续配置交给自动连接器……",
    done: "会议室已创建，ChatChat 正在自动连接并验证每个 AI……",
    hint: "如果某个 Provider 要求登录，只需在它的标签页里正常登录。页面加载后 ChatChat 会自己接着做。",
    privacy: "不需要 API Key，不需要技术配置，登录仍由各个 Provider 自己管理。",
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
  const locale: Locale = document.documentElement.lang === "zh-CN" || navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
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

  const detections = BUILT_IN_PROVIDER_MANIFESTS
    .map((manifest) => detectProviderUrl(manifest.defaultUrl))
    .filter((detection, index, values) => values.findIndex((item) => item.providerId === detection.providerId) === index)
    .slice(0, MAX_CONSULTATION_PARTICIPANTS);

  let discovered = await discover();
  let selectionTouched = false;
  const selected = new Set(discovered.map((item) => item.providerId));
  for (const providerId of STARTER_PROVIDER_IDS) {
    if (selected.size >= 3) break;
    if (detections.some((item) => item.providerId === providerId)) selected.add(providerId);
  }
  for (const detection of detections) {
    if (selected.size >= 2) break;
    selected.add(detection.providerId);
  }

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

  const chooser = document.createElement("div");
  chooser.className = "zero-touch-chooser";
  const summary = document.createElement("div");
  summary.className = "zero-touch-summary";
  const detected = document.createElement("strong");
  const selectedLabel = document.createElement("span");
  summary.append(detected, selectedLabel);

  const providerGrid = document.createElement("div");
  providerGrid.className = "zero-touch-provider-grid";

  const action = document.createElement("div");
  action.className = "zero-touch-action";
  const button = document.createElement("button");
  button.type = "button";
  const status = document.createElement("em");
  const hint = document.createElement("small");
  hint.textContent = strings.hint;
  action.append(button, status, hint);

  chooser.append(summary, providerGrid, action);
  card.append(copy, chooser);
  root.append(card);

  render();

  const scan = window.setInterval(async () => {
    const next = await discover();
    const before = new Set(discovered.map((item) => item.providerId));
    discovered = next;
    if (!selectionTouched) {
      for (const item of next) selected.add(item.providerId);
    }
    const after = new Set(next.map((item) => item.providerId));
    if (before.size !== after.size || [...before].some((id) => !after.has(id))) render();
  }, 2500);

  button.addEventListener("click", async () => {
    const chosen = detections.filter((item) => selected.has(item.providerId));
    if (chosen.length < 2) return;
    button.disabled = true;
    providerGrid.querySelectorAll("button").forEach((item) => { (item as HTMLButtonElement).disabled = true; });
    status.textContent = strings.working;
    try {
      await assemble(chosen, locale);
      window.clearInterval(scan);
      status.textContent = strings.done;
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      providerGrid.querySelectorAll("button").forEach((item) => { (item as HTMLButtonElement).disabled = false; });
      button.disabled = selected.size < 2;
    }
  });

  function render() {
    const openIds = new Set(discovered.map((item) => item.providerId));
    detected.textContent = strings.detected(openIds.size);
    selectedLabel.textContent = strings.selected(selected.size);
    button.textContent = strings.button(selected.size);
    button.disabled = selected.size < 2;
    providerGrid.replaceChildren();

    for (const detection of detections) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `zero-touch-provider ${selected.has(detection.providerId) ? "is-selected" : ""}`;
      tile.setAttribute("aria-pressed", selected.has(detection.providerId) ? "true" : "false");
      tile.dataset.providerId = detection.providerId;

      const monogram = document.createElement("b");
      monogram.textContent = detection.manifest?.monogram ?? detection.displayName.slice(0, 2);
      const label = document.createElement("span");
      label.textContent = detection.displayName;
      const badges = document.createElement("i");
      badges.textContent = [
        openIds.has(detection.providerId) ? strings.open : "",
        STARTER_PROVIDER_IDS.includes(detection.providerId as typeof STARTER_PROVIDER_IDS[number]) ? strings.starter : "",
      ].filter(Boolean).join(" · ");
      tile.append(monogram, label, badges);
      tile.addEventListener("click", () => {
        selectionTouched = true;
        if (selected.has(detection.providerId)) selected.delete(detection.providerId);
        else selected.add(detection.providerId);
        render();
      });
      providerGrid.append(tile);
    }
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

async function assemble(
  chosen: readonly ReturnType<typeof detectProviderUrl>[],
  locale: Locale,
) {
  const origins = [...new Set(chosen.map((detection) => `${detection.origin}/*`))];
  const descriptor = { origins };
  if (!(await chrome.permissions.contains(descriptor))) {
    const granted = await chrome.permissions.request(descriptor);
    if (!granted) {
      throw new Error(locale === "zh-CN"
        ? "ChatChat 需要你允许访问所选 AI 网站，才能自动连接它们。"
        : "ChatChat needs access to the selected AI sites so it can connect them automatically.");
    }
  }

  const participants: ParticipantRecord[] = [];
  const connections: Record<string, { state: "idle"; automatic: true }> = {};
  for (const detection of chosen.slice(0, MAX_CONSULTATION_PARTICIPANTS)) {
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
  if (participants.length < 2) {
    throw new Error(locale === "zh-CN"
      ? "ChatChat 没能创建至少两个 AI 会话，请重新选择后再试一次。"
      : "ChatChat could not create at least two AI conversations. Please adjust the selection and try again.");
  }
  const session = chrome.storage.session ?? chrome.storage.local;
  await session.set({ [PARTICIPANTS_KEY]: participants, [CONNECTIONS_KEY]: connections });
}
