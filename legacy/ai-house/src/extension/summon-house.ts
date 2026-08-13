import {
  planOpenAiTabsForHouse,
  summarizeSummonPlan,
  type SummonBrowserTab,
  type SummonExistingSeat,
} from "./summon-plan.js";

declare const chrome: any;

const SEATS_KEY = "chatchat.extension.seats.v1";

interface ExtensionSeat extends SummonExistingSeat {
  seatId: string;
  url: string;
  hostname: string;
  providerName: string;
  delegationId: string;
  delegationName: string;
  startUrl: string;
  createdByChatChat: boolean;
}

interface BridgeResponse {
  ok: boolean;
  error?: string;
}

/**
 * A deliberately small companion module for the Side Panel.
 *
 * It bulk-attaches only already-open, catalog-recognized AI tabs. It never
 * marks Test Speech or Council Gate as passed; the normal Side Panel validation
 * remains mandatory after the panel reloads.
 */
void bootSummonControl();

async function bootSummonControl() {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.storage) return;
  if (new URLSearchParams(location.search).get("showcase") === "1") return;

  await whenDomReady();
  const host = document.createElement("div");
  host.id = "chatchat-summon-house";
  host.dataset.summonCandidates = "0";
  host.dataset.summonProviders = "";
  host.dataset.summonTrust = "unverified";
  host.dataset.summonAction = "attach-only";
  host.innerHTML = `
    <style>
      #chatchat-summon-house {
        position: sticky;
        top: 8px;
        z-index: 2147483000;
        margin: 8px 10px 0;
        pointer-events: none;
      }
      #chatchat-summon-house .summon-shell {
        display: none;
        align-items: center;
        gap: 9px;
        padding: 8px 9px 8px 11px;
        border: 1px solid rgba(37, 111, 88, .2);
        border-radius: 14px;
        background: rgba(248, 253, 251, .96);
        box-shadow: 0 10px 28px rgba(22, 53, 45, .12);
        backdrop-filter: blur(12px);
        pointer-events: auto;
        color: #193f35;
        font: 12px/1.25 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #chatchat-summon-house .summon-shell.is-visible { display: flex; }
      #chatchat-summon-house .summon-copy { min-width: 0; flex: 1; }
      #chatchat-summon-house .summon-copy strong { display: block; font-size: 12px; }
      #chatchat-summon-house .summon-copy span {
        display: block;
        margin-top: 2px;
        color: #5d766f;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #chatchat-summon-house button {
        flex: none;
        border: 0;
        border-radius: 10px;
        padding: 8px 10px;
        background: #173f34;
        color: white;
        font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
      }
      #chatchat-summon-house button:disabled { opacity: .55; cursor: wait; }
      #chatchat-summon-house .summon-result { color: #2c735e; }
      #chatchat-summon-house .summon-error { color: #a54d45; }
    </style>
    <div class="summon-shell" role="status">
      <div class="summon-copy">
        <strong>👑 SUMMON THE HOUSE · 召集诸卿</strong>
        <span class="summon-detail">扫描已打开的 AI 标签页…</span>
      </div>
      <button type="button">召集</button>
    </div>
  `;
  document.body.prepend(host);

  const shell = host.querySelector<HTMLElement>(".summon-shell")!;
  const detail = host.querySelector<HTMLElement>(".summon-detail")!;
  const button = host.querySelector<HTMLButtonElement>("button")!;

  async function refresh() {
    try {
      const [tabs, existing] = await Promise.all([queryTabs(), loadSeats()]);
      const plan = planOpenAiTabsForHouse(tabs, existing);
      host.dataset.summonCandidates = String(plan.candidates.length);
      host.dataset.summonProviders = [...new Set(plan.candidates.map((item) => item.providerId))].join(",");
      if (!plan.candidates.length) {
        shell.classList.remove("is-visible");
        return;
      }
      shell.classList.add("is-visible");
      detail.className = "summon-detail";
      detail.textContent = `${summarizeSummonPlan(plan)} · 新席位仍需 Test + Gate`;
      button.textContent = `召集 ${plan.candidates.length} 席`;
      button.dataset.summonCount = String(plan.candidates.length);
      button.disabled = false;
    } catch (caught) {
      host.dataset.summonCandidates = "error";
      shell.classList.add("is-visible");
      detail.className = "summon-detail summon-error";
      detail.textContent = message(caught);
      button.disabled = true;
    }
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    detail.className = "summon-detail";
    detail.textContent = "正在请求这些 AI 站点的本地标签页权限…";

    try {
      const [tabs, existing] = await Promise.all([queryTabs(), loadSeats()]);
      const plan = planOpenAiTabsForHouse(tabs, existing);
      if (!plan.candidates.length) {
        await refresh();
        return;
      }

      const origins = [...new Set(plan.candidates.map((item) => `${item.origin}/*`))];
      const granted = await chrome.permissions.request({ origins });
      if (!granted) throw new Error("未授予这些 AI 标签页的访问权限；没有任何席位被加入。 ");

      const joined: ExtensionSeat[] = [];
      const failures: string[] = [];
      for (const candidate of plan.candidates) {
        try {
          await ensureBridge(candidate.tabId);
          joined.push({
            seatId: `extension:${candidate.providerId}:${candidate.tabId}`,
            tabId: candidate.tabId,
            url: candidate.url,
            origin: candidate.origin,
            hostname: candidate.hostname,
            providerId: candidate.providerId,
            providerName: candidate.providerName,
            delegationId: candidate.delegationId,
            delegationName: candidate.delegationName,
            startUrl: candidate.startUrl,
            createdByChatChat: false,
          });
        } catch (caught) {
          failures.push(`${candidate.providerName}: ${message(caught)}`);
        }
      }

      if (!joined.length) {
        throw new Error(failures[0] ?? "没有标签页成功建立 ChatChat bridge。");
      }

      const current = await loadSeats();
      const existingIds = new Set(current.map((seat) => seat.tabId));
      const merged = [...current, ...joined.filter((seat) => !existingIds.has(seat.tabId))];
      const store = chrome.storage.session ?? chrome.storage.local;
      await store.set({ [SEATS_KEY]: merged });

      detail.className = "summon-detail summon-result";
      detail.textContent = failures.length
        ? `✓ 已召集 ${joined.length} 席；${failures.length} 席 bridge 失败。刷新后请逐代表团验证。`
        : `✓ 已召集 ${joined.length} 个真实标签页席位。刷新后请逐代表团 Test + Gate。`;
      button.textContent = "已召集";
      window.setTimeout(() => location.reload(), 900);
    } catch (caught) {
      detail.className = "summon-detail summon-error";
      detail.textContent = message(caught);
      button.disabled = false;
      button.textContent = "重试召集";
    }
  });

  await refresh();
}

async function queryTabs(): Promise<SummonBrowserTab[]> {
  return (await chrome.tabs.query({})) as SummonBrowserTab[];
}

async function loadSeats(): Promise<ExtensionSeat[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(SEATS_KEY);
  return Array.isArray(state[SEATS_KEY]) ? state[SEATS_KEY] : [];
}

async function ensureBridge(tabId: number) {
  try {
    await ping(tabId);
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    await sleep(80);
    await ping(tabId);
  }
}

async function ping(tabId: number) {
  const response = (await chrome.tabs.sendMessage(tabId, {
    __chatchat: true,
    type: "PING",
  })) as BridgeResponse;
  if (!response?.ok) throw new Error(response?.error || "Provider tab did not answer ChatChat.");
}

function whenDomReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
