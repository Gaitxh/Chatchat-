import { StrictMode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  BROWSER_AUTHORITY_RECEIPTS_KEY,
  deriveBrowserAuthoritySummary,
  type BrowserAuthorityParticipant,
  type BrowserAuthorityReceipt,
} from "./browser-authority-ledger.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./browser-authority.css";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const AUTHORITY_UPDATED_EVENT = "chatchat:browser-authority-updated";

function BrowserAuthorityPortal() {
  const [participants, setParticipants] = useState<BrowserAuthorityParticipant[]>([]);
  const [receipts, setReceipts] = useState<BrowserAuthorityReceipt[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const summary = useMemo(
    () => deriveBrowserAuthoritySummary(participants, receipts),
    [participants, receipts],
  );

  useEffect(() => {
    const refresh = () => void readState().then(({ participants: nextParticipants, receipts: nextReceipts }) => {
      setParticipants(nextParticipants);
      setReceipts(nextReceipts);
      setBlockedAttempts(Number(document.documentElement.dataset.chatchatAuthorityBlockedAutomaticRetries ?? "0") || 0);
    });
    refresh();
    const onStorage = (changes: Record<string, unknown>) => {
      if (PARTICIPANTS_KEY in changes || BROWSER_AUTHORITY_RECEIPTS_KEY in changes) refresh();
    };
    chrome.storage?.onChanged?.addListener?.(onStorage);
    window.addEventListener(AUTHORITY_UPDATED_EVENT, refresh);
    const language = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    language.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => {
      chrome.storage?.onChanged?.removeListener?.(onStorage);
      window.removeEventListener(AUTHORITY_UPDATED_EVENT, refresh);
      language.disconnect();
    };
  }, []);

  useEffect(() => {
    const summaryRoot = document.getElementById("browser-authority-summary-root");
    if (!(summaryRoot instanceof HTMLElement)) return;
    const place = () => {
      const participantsCard = document.querySelector(".consultation-app .participants-card");
      if (!(participantsCard instanceof HTMLElement)) return;
      const description = participantsCard.querySelector(".section-description");
      if (summaryRoot.parentElement !== participantsCard) {
        if (description) description.insertAdjacentElement("afterend", summaryRoot);
        else participantsCard.prepend(summaryRoot);
      }
      summaryRoot.dataset.chatchatVisualLayer = "stage";
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const summaryRoot = document.getElementById("browser-authority-summary-root");
  const auditRoot = document.getElementById("browser-authority-root");
  return (
    <>
      {summaryRoot ? createPortal(
        <AuthoritySummary
          summary={summary}
          blockedAttempts={blockedAttempts}
          locale={locale}
        />,
        summaryRoot,
      ) : null}
      {auditRoot ? createPortal(
        <AuthorityLedger
          summary={summary}
          blockedAttempts={blockedAttempts}
          locale={locale}
        />,
        auditRoot,
      ) : null}
    </>
  );
}

function AuthoritySummary({
  summary,
  blockedAttempts,
  locale,
}: {
  summary: ReturnType<typeof deriveBrowserAuthoritySummary>;
  blockedAttempts: number;
  locale: Locale;
}) {
  const zh = locale === "zh-CN";
  return (
    <section
      className="browser-authority-summary"
      data-browser-authority-summary="ready"
      data-browser-authority-managed={summary.managedSeats}
      data-browser-authority-protected={summary.protectedSeats}
      data-browser-authority-auto-actions={summary.automaticActions}
      data-browser-authority-explicit-actions={summary.explicitActions}
      data-browser-authority-blocked={blockedAttempts}
    >
      <div className="browser-authority-summary__mark" aria-hidden="true">⌁</div>
      <div className="browser-authority-summary__copy">
        <strong>{zh ? "浏览器边界" : "Browser boundary"}</strong>
        <span>{zh
          ? "自动操作只属于未被保护的 ChatChat 干净标签页。你的标签页，以及你主动保护的托管席位，都不会在后台自动导航或恢复连接。"
          : "Automatic actions are limited to unprotected clean tabs ChatChat created. Your own tabs — and any managed seat you protect — are never background-navigated or auto-resumed."}</span>
      </div>
      <div className="browser-authority-summary__facts">
        <b>{summary.managedSeats}<small>{zh ? "托管" : "managed"}</small></b>
        <b className={summary.protectedSeats ? "is-protected" : ""}>{summary.protectedSeats}<small>{zh ? "受保护" : "protected"}</small></b>
        {blockedAttempts ? <b className="is-blocked">{blockedAttempts}<small>{zh ? "已拦截" : "blocked"}</small></b> : null}
      </div>
    </section>
  );
}

function AuthorityLedger({
  summary,
  blockedAttempts,
  locale,
}: {
  summary: ReturnType<typeof deriveBrowserAuthoritySummary>;
  blockedAttempts: number;
  locale: Locale;
}) {
  const zh = locale === "zh-CN";
  const recent = [...summary.receipts].reverse().slice(0, 12);
  return (
    <section
      className="browser-authority-ledger"
      data-browser-authority-ledger="ready"
      data-browser-authority-receipts={summary.receipts.length}
      data-browser-authority-managed={summary.managedSeats}
      data-browser-authority-protected={summary.protectedSeats}
      data-browser-authority-blocked={blockedAttempts}
      data-browser-authority-protected-providers={summary.protectedProviders.join(",")}
    >
      <header>
        <div>
          <span>{zh ? "本地权限收据" : "LOCAL AUTHORITY RECEIPT"}</span>
          <h3>{zh ? "ChatChat 动过什么，哪些标签页明确没权限动。" : "What ChatChat touched — and what it is not allowed to touch."}</h3>
          <p>{zh
            ? "只保存在当前浏览器会话中。账本只记录席位、动作、触发方式、原因和时间；不会保存页面 URL、对话、Prompt、回复、账号、Cookie 或 Token。"
            : "Session-local only. Receipts record seat, action, trigger, reason, and time — never page URLs, conversations, prompts, responses, accounts, cookies, or tokens."}</p>
        </div>
        <b>{summary.receipts.length} {zh ? "条收据" : "receipts"}</b>
      </header>

      <div className="browser-authority-ledger__stats">
        <article><span>{zh ? "托管席位" : "MANAGED"}</span><strong>{summary.managedSeats}</strong><small>{zh ? "允许受限自动化" : "bounded automation allowed"}</small></article>
        <article><span>{zh ? "受保护席位" : "PROTECTED"}</span><strong>{summary.protectedSeats}</strong><small>{zh ? "后台自动化禁止" : "background automation denied"}</small></article>
        <article><span>{zh ? "自动动作" : "AUTOMATIC"}</span><strong>{summary.automaticActions}</strong><small>{zh ? "仅托管席位" : "managed seats only"}</small></article>
        <article><span>{zh ? "拦截尝试" : "BLOCKED"}</span><strong>{blockedAttempts}</strong><small>{zh ? "fail closed" : "failed closed"}</small></article>
      </div>

      {summary.protectedProviders.length ? (
        <div className="browser-authority-protected-list">
          <span>🛡</span>
          <div>
            <strong>{zh ? "这些席位已禁止后台自动化" : "These seats are protected from background automation"}</strong>
            <small>{summary.protectedProviders.join(" · ")}</small>
          </div>
          <b>{zh ? "不自动导航 / 不自动恢复" : "NO AUTO NAV / RESUME"}</b>
        </div>
      ) : null}

      {recent.length ? (
        <div className="browser-authority-receipts">
          {recent.map((receipt, index) => (
            <article key={`${receipt.occurredAt}:${receipt.action}:${receipt.providerName}:${index}`}>
              <div className="browser-authority-receipt__icon">{actionIcon(receipt.action)}</div>
              <div>
                <strong>{receipt.providerName}</strong>
                <span>{actionLabel(receipt.action, zh)}</span>
                <small>{reasonLabel(receipt.reason, zh)} · {timeLabel(receipt.occurredAt, locale)}</small>
              </div>
              <b className={receipt.trigger === "automatic" ? "is-auto" : "is-user"}>
                {receipt.trigger === "automatic" ? (zh ? "自动" : "AUTO") : (zh ? "用户触发" : "USER")}
              </b>
            </article>
          ))}
        </div>
      ) : (
        <div className="browser-authority-empty">
          <strong>{zh ? "当前会话还没有浏览器权限动作收据。" : "No browser-authority actions in this session yet."}</strong>
          <span>{zh ? "受保护席位仍然按 fail-closed 规则生效。" : "Protected seats are still governed by the fail-closed boundary."}</span>
        </div>
      )}
    </section>
  );
}

async function readState(): Promise<{
  participants: BrowserAuthorityParticipant[];
  receipts: BrowserAuthorityReceipt[];
}> {
  try {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get([PARTICIPANTS_KEY, BROWSER_AUTHORITY_RECEIPTS_KEY]);
    return {
      participants: participantArray(stored?.[PARTICIPANTS_KEY]),
      receipts: Array.isArray(stored?.[BROWSER_AUTHORITY_RECEIPTS_KEY])
        ? stored[BROWSER_AUTHORITY_RECEIPTS_KEY]
        : [],
    };
  } catch {
    return { participants: [], receipts: [] };
  }
}

function participantArray(value: unknown): BrowserAuthorityParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.filter((participant): participant is BrowserAuthorityParticipant => Boolean(
    participant
      && typeof participant === "object"
      && typeof participant.seatId === "string"
      && typeof participant.providerName === "string",
  ));
}

function actionIcon(action: BrowserAuthorityReceipt["action"]): string {
  if (action === "managed_tab_created") return "+";
  if (action === "automatic_connection_resume") return "↻";
  if (action === "self_heal_navigation") return "⌁";
  if (action === "automation_protected") return "🛡";
  if (action === "automation_restored") return "↺";
  return "→";
}

function actionLabel(action: BrowserAuthorityReceipt["action"], zh: boolean): string {
  if (action === "managed_tab_created") return zh ? "创建干净托管标签页" : "Created clean managed tab";
  if (action === "automatic_connection_resume") return zh ? "自动恢复连接" : "Automatic connection resume";
  if (action === "self_heal_navigation") return zh ? "一次性自愈导航" : "One-shot self-heal navigation";
  if (action === "automation_protected") return zh ? "用户收回自动化权限" : "User revoked automation";
  if (action === "automation_restored") return zh ? "用户恢复受限自动化" : "User restored bounded automation";
  return zh ? "新会议干净会话导航" : "Fresh-session navigation";
}

function reasonLabel(reason: BrowserAuthorityReceipt["reason"], zh: boolean): string {
  const labels: Record<BrowserAuthorityReceipt["reason"], [string, string]> = {
    starter_room: ["Starter room", "起步会议室"],
    invite_ai: ["Invite AI", "邀请 AI"],
    quick_open: ["Quick open", "快速打开"],
    session_hydration: ["Session restore", "会话恢复"],
    provider_tab_loaded: ["Provider page loaded", "Provider 页面已加载"],
    recovery: ["Bounded recovery", "受限恢复"],
    fresh_consultation: ["Fresh consultation", "新协商"],
    page_mapping_drift: ["Page mapping drift", "页面映射漂移"],
    user_protection: ["User protection", "用户保护"],
    user_restored_automation: ["User restored automation", "用户恢复自动化"],
  };
  const label = labels[reason];
  return zh ? label[1] : label[0];
}

function timeLabel(value: string, locale: Locale): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "zh-CN" ? "zh-CN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const root = document.getElementById("browser-authority-root");
const summaryRoot = document.getElementById("browser-authority-summary-root");
if (root || summaryRoot) {
  const mount = document.createElement("div");
  mount.hidden = true;
  document.body.append(mount);
  createRoot(mount).render(
    <StrictMode>
      <BrowserAuthorityPortal />
    </StrictMode>,
  );
}
