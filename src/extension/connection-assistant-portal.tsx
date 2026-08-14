import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  deriveConnectionExperience,
  type AutomaticConnectionState,
  type ConnectionExperienceState,
  type LoginPageProbe,
} from "./login-awareness.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./connection-assistant.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const RECOVERY_VISIBLE_MS = 12_000;

interface ParticipantRecord {
  seatId: string;
  tabId: number;
  providerName: string;
  hostname: string;
}

interface ParticipantConnection {
  state: AutomaticConnectionState;
  detail?: string;
}

interface ConnectionRow {
  participant: ParticipantRecord;
  connection: ParticipantConnection;
  probe: LoginPageProbe | null;
}

const COPY = {
  en: {
    eyebrow: "ROOM SETUP",
    title: "Your AI team is connecting itself.",
    body: "You only need to step in when an AI asks you to sign in. After that page changes, ChatChat resumes the automatic connection by itself.",
    ready: "READY",
    preparing: "Preparing",
    connecting: "Connecting automatically",
    login_required: "Sign in required",
    recovering: "Login detected · resuming",
    needs_attention: "Needs attention",
    preparingDetail: "ChatChat is preparing this AI for the room.",
    connectingDetail: "ChatChat is finding the conversation controls and checking the connection.",
    loginDetail: "This AI is waiting for its own website login. Your password stays with the provider — ChatChat never asks for it.",
    recoveringDetail: "The AI page changed. ChatChat is retrying the connection automatically now.",
    readyDetail: "This AI passed the connection and consultation readiness checks.",
    attentionDetail: "This does not look like a login page. ChatChat could not finish automatic setup, so advanced repair is available as a last resort.",
    openLogin: (name: string) => `Open ${name} to sign in`,
    openAI: (name: string) => `Open ${name}`,
    advanced: "Advanced repair",
  },
  "zh-CN": {
    eyebrow: "会议室准备",
    title: "你的 AI 团队正在自己完成连接。",
    body: "只有当某个 AI 要求登录时才需要你出手。登录页面发生变化后，ChatChat 会自己继续自动连接。",
    ready: "已就绪",
    preparing: "准备中",
    connecting: "自动连接中",
    login_required: "需要登录",
    recovering: "检测到登录完成 · 正在续接",
    needs_attention: "需要处理",
    preparingDetail: "ChatChat 正在把这个 AI 准备进会议室。",
    connectingDetail: "ChatChat 正在自己寻找对话区域并检查连接。",
    loginDetail: "这个 AI 正在等待它自己网站的登录。密码只交给 Provider，ChatChat 不会向你索要密码。",
    recoveringDetail: "AI 页面已经发生变化，ChatChat 正在自动重新连接。",
    readyDetail: "这个 AI 已通过连接检查和协商就绪验证。",
    attentionDetail: "这看起来不像登录页，但自动连接仍未完成。高级修复会作为最后的兜底手段保留。",
    openLogin: (name: string) => `打开 ${name} 完成登录`,
    openAI: (name: string) => `打开 ${name}`,
    advanced: "高级修复",
  },
} as const;

function ConnectionAssistantPortal() {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [recoveringTabs, setRecoveringTabs] = useState<Set<number>>(() => new Set());
  const recoveryTimers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const next = await loadRows();
      if (!disposed) setRows(next);
    };
    void refresh();

    const onStorage = (changes: Record<string, unknown>) => {
      if (PARTICIPANTS_KEY in changes || CONNECTIONS_KEY in changes) void refresh();
    };
    chrome.storage?.onChanged?.addListener?.(onStorage);

    const onTabUpdated = (tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (changeInfo.status !== "complete" && !changeInfo.url) return;
      setRecoveringTabs((current) => new Set(current).add(tabId));
      const previous = recoveryTimers.current.get(tabId);
      if (previous) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        recoveryTimers.current.delete(tabId);
        setRecoveringTabs((current) => {
          const next = new Set(current);
          next.delete(tabId);
          return next;
        });
        void refresh();
      }, RECOVERY_VISIBLE_MS);
      recoveryTimers.current.set(tabId, timer);
      window.setTimeout(() => void refresh(), 350);
    };
    chrome.tabs?.onUpdated?.addListener?.(onTabUpdated);

    const languageObserver = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    return () => {
      disposed = true;
      chrome.storage?.onChanged?.removeListener?.(onStorage);
      chrome.tabs?.onUpdated?.removeListener?.(onTabUpdated);
      languageObserver.disconnect();
      for (const timer of recoveryTimers.current.values()) window.clearTimeout(timer);
      recoveryTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById("connection-assistant-root");
    const participants = document.querySelector(".consultation-app .participants-card");
    if (!root || !participants?.parentElement) return;
    if (root.previousElementSibling !== participants) participants.after(root);
  }, [rows.length]);

  const copy = COPY[locale];
  const experiences = useMemo(() => rows.map((row) => ({
    ...row,
    experience: deriveConnectionExperience({
      connectionState: row.connection.state,
      probe: row.probe,
      recovering: recoveringTabs.has(row.participant.tabId),
    }),
  })), [rows, recoveringTabs]);

  const unresolved = experiences.filter((row) => row.experience !== "ready");
  if (!rows.length || !unresolved.length) return null;
  const readyCount = experiences.filter((row) => row.experience === "ready").length;
  const loginCount = experiences.filter((row) => row.experience === "login_required").length;

  return (
    <section
      className="connection-assistant"
      data-login-required-count={loginCount}
      aria-live="polite"
    >
      <header className="connection-assistant__heading">
        <div><span>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.body}</p></div>
        <strong>{readyCount}/{rows.length} {copy.ready}</strong>
      </header>
      <div className="connection-assistant__grid">
        {experiences.map((row) => (
          <ConnectionCard
            key={row.participant.seatId}
            participant={row.participant}
            experience={row.experience}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function ConnectionCard({
  participant,
  experience,
  locale,
}: {
  participant: ParticipantRecord;
  experience: ConnectionExperienceState;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const label = copy[experience];
  const detail = experience === "preparing"
    ? copy.preparingDetail
    : experience === "connecting"
      ? copy.connectingDetail
      : experience === "login_required"
        ? copy.loginDetail
        : experience === "recovering"
          ? copy.recoveringDetail
          : experience === "ready"
            ? copy.readyDetail
            : copy.attentionDetail;

  return (
    <article className={`connection-assistant__card state-${experience}`} data-connection-experience={experience}>
      <div className="connection-assistant__avatar">{monogram(participant.providerName)}</div>
      <div className="connection-assistant__main">
        <div><strong>{participant.providerName}</strong><span>{label}</span></div>
        <small>{participant.hostname}</small>
        <p>{detail}</p>
        {experience === "login_required" ? (
          <button type="button" onClick={() => void openTab(participant.tabId)}>{copy.openLogin(participant.providerName)}</button>
        ) : experience === "needs_attention" ? (
          <div className="connection-assistant__actions">
            <button type="button" onClick={() => void openTab(participant.tabId)}>{copy.openAI(participant.providerName)}</button>
            <button type="button" className="is-secondary" onClick={openAdvancedRepair}>{copy.advanced}</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

async function loadRows(): Promise<ConnectionRow[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const stored = await store.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
  const participants = Array.isArray(stored[PARTICIPANTS_KEY])
    ? (stored[PARTICIPANTS_KEY] as ParticipantRecord[])
    : [];
  const connections = (stored[CONNECTIONS_KEY] ?? {}) as Record<string, ParticipantConnection>;

  return Promise.all(participants.map(async (participant) => ({
    participant,
    connection: connections[participant.seatId] ?? { state: "idle" },
    probe: await inspectTab(participant),
  })));
}

async function inspectTab(participant: ParticipantRecord): Promise<LoginPageProbe | null> {
  let tab: { url?: string; title?: string } | null = null;
  try {
    tab = await chrome.tabs.get(participant.tabId);
  } catch {
    return null;
  }

  const base: LoginPageProbe = {
    url: tab?.url,
    title: tab?.title,
    hostname: safeHostname(tab?.url) ?? participant.hostname,
  };

  try {
    const response = await chrome.tabs.sendMessage(participant.tabId, {
      __chatchat: true,
      type: "PROBE",
    });
    const result = response?.ok ? response.result : null;
    if (!result || typeof result !== "object") return base;
    return {
      ...base,
      ...(typeof result.url === "string" ? { url: result.url } : {}),
      ...(typeof result.hostname === "string" ? { hostname: result.hostname } : {}),
      ...(typeof result.title === "string" ? { title: result.title } : {}),
    };
  } catch {
    return base;
  }
}

async function openTab(tabId: number): Promise<void> {
  try { await chrome.tabs.update(tabId, { active: true }); } catch { /* tab may have closed */ }
}

function openAdvancedRepair(): void {
  const details = document.querySelector<HTMLDetailsElement>(".setup-card");
  if (!details) return;
  details.open = true;
  details.scrollIntoView({ behavior: "smooth", block: "start" });
}

function safeHostname(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return new URL(value).hostname; } catch { return undefined; }
}

function monogram(name: string): string {
  const normalized = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return normalized.slice(0, 2).toUpperCase() || "AI";
}

const root = document.getElementById("connection-assistant-root");
if (!root) throw new Error("ChatChat connection assistant root is missing.");
createRoot(root).render(<StrictMode><ConnectionAssistantPortal /></StrictMode>);
