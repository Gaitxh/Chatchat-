import {
  planOpenAiTabsForHouse,
  type SummonBrowserTab,
  type SummonCandidate,
  type SummonExistingSeat,
} from "./summon-plan.js";
import {
  DEFAULT_ONBOARDING_STATE,
  deriveOnboardingAct,
  firstCouncilCelebration,
  selectedOriginPatterns,
  validationProgress,
  type OnboardingDelegationReadiness,
  type OnboardingRuntimeSummary,
  type PersistedRoyalOnboardingState,
  type RoyalOnboardingAct,
} from "./onboarding-model.js";

declare const chrome: any;

const ONBOARDING_KEY = "chatchat.extension.onboarding.v1";
const SEATS_KEY = "chatchat.extension.seats.v1";
const HOST_ID = "chatchat-royal-onboarding";
const REOPEN_ID = "chatchat-royal-onboarding-reopen";
const ACTIVE_CLASS = "chatchat-onboarding-active";
const SHOWCASE = new URLSearchParams(location.search).get("onboarding") === "1";
const SHOWCASE_ACT = new URLSearchParams(location.search).get("onboardingAct") ?? "scan";

interface StoredSeat extends SummonExistingSeat {
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

let persisted: PersistedRoyalOnboardingState = { ...DEFAULT_ONBOARDING_STATE };
let visible = false;
let candidates: SummonCandidate[] = [];
let selectedTabIds = new Set<number>();
let status = "";
let runtimeSummary: OnboardingRuntimeSummary = emptyRuntimeSummary();
let lastRuntimeSignature = "";
let observer: MutationObserver | null = null;
let firstQuestion =
  "ChatChat 这个开源 AI 议会项目下一步最应该优先做什么？请从用户价值、工程风险、增长传播和隐私四个角度互相质询，并在证据改变判断时明确改口。";

void bootRoyalOnboarding();

async function bootRoyalOnboarding() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.tabs) return;
  await whenDomReady();
  persisted = SHOWCASE ? showcasePersistedState() : await loadPersistedState();
  visible = SHOWCASE || !persisted.completed;
  runtimeSummary = SHOWCASE ? showcaseRuntimeSummary() : readRuntimeSummary();
  lastRuntimeSignature = JSON.stringify(runtimeSummary);
  if (visible && persisted.act === 2) await scanCandidates();
  mountReopenControl();
  mountGuide();
  observeRuntimeTruth();
}

function mountGuide() {
  const attach = () => {
    if (!visible) {
      document.body.classList.remove(ACTIVE_CLASS);
      document.getElementById(HOST_ID)?.remove();
      return;
    }
    document.body.classList.add(ACTIVE_CLASS);
    if (document.getElementById(HOST_ID)) {
      renderGuide();
      return;
    }
    const header = document.querySelector(".side-header");
    if (!header) return;
    const host = document.createElement("section");
    host.id = HOST_ID;
    host.className = "royal-onboarding";
    header.insertAdjacentElement("afterend", host);
    renderGuide();
  };
  attach();
  const mountObserver = new MutationObserver(() => {
    if (visible && !document.getElementById(HOST_ID)) attach();
  });
  mountObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function mountReopenControl() {
  const mount = () => {
    if (document.getElementById(REOPEN_ID)) return;
    const footer = document.querySelector(".side-footer");
    if (!footer) return;
    const button = document.createElement("button");
    button.id = REOPEN_ID;
    button.type = "button";
    button.textContent = "👑 新手向导";
    button.style.cssText =
      "border:0;border-radius:999px;padding:5px 8px;background:#eef6f2;color:#315d4b;font:700 9px system-ui;cursor:pointer";
    button.addEventListener("click", async () => {
      persisted = { ...DEFAULT_ONBOARDING_STATE };
      visible = true;
      status = "";
      await savePersistedState();
      runtimeSummary = readRuntimeSummary();
      renderGuide();
      document.getElementById(HOST_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    footer.prepend(button);
  };
  mount();
  const reopenObserver = new MutationObserver(mount);
  reopenObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function observeRuntimeTruth() {
  observer?.disconnect();
  let queued = false;
  observer = new MutationObserver(() => {
    if (queued || SHOWCASE) return;
    queued = true;
    queueMicrotask(async () => {
      queued = false;
      const next = readRuntimeSummary();
      const signature = JSON.stringify(next);
      if (signature === lastRuntimeSignature) return;
      lastRuntimeSignature = signature;
      runtimeSummary = next;
      const derived = deriveOnboardingAct(persisted, runtimeSummary);
      if (derived !== persisted.act) {
        persisted = { ...persisted, act: derived };
        if (derived === 7) persisted.completed = true;
        await savePersistedState();
      }
      renderGuide();
    });
  });
  const app = document.querySelector(".side-app") ?? document.body;
  observer.observe(app, { childList: true, subtree: true, characterData: true });
}

function renderGuide() {
  if (!visible) {
    mountGuide();
    return;
  }
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  const runtimeAct = SHOWCASE
    ? showcaseActNumber()
    : deriveOnboardingAct(persisted, runtimeSummary);
  if (runtimeAct !== persisted.act && !SHOWCASE) persisted = { ...persisted, act: runtimeAct };

  host.dataset.onboardingAct = String(runtimeAct);
  host.dataset.onboardingTrust = "gates-required";
  host.dataset.onboardingReadySeats = String(runtimeSummary.readySeatCount);
  host.innerHTML = `
    ${styles()}
    <div class="royal-progress">${progressHtml(runtimeAct)}</div>
    ${SHOWCASE ? `<div class="royal-showcase">DETERMINISTIC ONBOARDING SHOWCASE · NO REAL ACCOUNT</div>` : ""}
    ${actHtml(runtimeAct)}
  `;
  wireGuide(runtimeAct);
}

function actHtml(act: RoyalOnboardingAct): string {
  if (act === 1) {
    return `
      <div class="royal-hero">
        <span>ACT I · WELCOME, YOUR MAJESTY</span>
        <h2>👑 先把你的 AI 们召进宫。</h2>
        <p>ChatChat 直接使用这个浏览器里已经登录的 AI 标签页。你只下令一次，Round 2 以后由它们自己议。</p>
        <div class="royal-trust">
          <b>LOCAL-FIRST</b>
          <span>没有 ChatChat 中转服务器 · 不需要粘贴密码或 Cookie</span>
        </div>
        <div class="royal-actions">
          <button type="button" class="royal-primary" data-action="find">🔭 FIND MY AIs</button>
          <button type="button" data-action="dismiss">稍后再说</button>
        </div>
      </div>
    `;
  }

  if (act === 2) {
    const groups = groupCandidates(candidates);
    return `
      <div class="royal-head">
        <div><span>ACT II · FIND YOUR ADVISORS</span><h2>🔭 浏览器里发现了这些 AI</h2></div>
        <button type="button" data-action="rescan">重新扫描</button>
      </div>
      <p class="royal-copy">这里只列出 ChatChat catalog 已识别的已打开 AI 页面。勾选并确认前，不会申请站点权限，也不会自动入席。</p>
      <div class="candidate-groups">
        ${groups.length
          ? groups.map(candidateGroupHtml).join("")
          : `<div class="royal-empty"><b>还没发现可召集的已知 AI 标签页。</b><span>先在浏览器里打开并登录 ChatGPT、Gemini、DeepSeek、Claude、Grok、元宝、Qwen/通义等，再回来扫描。</span></div>`}
      </div>
      <div class="royal-actions">
        <button type="button" data-action="back">← 返回</button>
        <button type="button" class="royal-primary" data-action="summon" ${selectedTabIds.size ? "" : "disabled"}>🪑 召集 ${selectedTabIds.size} 席</button>
      </div>
      ${status ? `<div class="royal-status">${escapeHtml(status)}</div>` : ""}
    `;
  }

  if (act === 3) {
    return `
      <div class="royal-hero compact">
        <span>ACT III · SUMMONING</span>
        <h2>🪑 正在给诸卿安排席位…</h2>
        <p>${escapeHtml(status || "只会请求你刚才选中的 Provider origin 权限。新席位仍然是 UNVERIFIED。")}</p>
        <div class="royal-loader"><i></i><i></i><i></i></div>
      </div>
    `;
  }

  if (act === 4) {
    return `
      <div class="royal-head">
        <div><span>ACT IV · TEACH & VALIDATE</span><h2>🧩 教会 ChatChat 怎么和它们说话</h2></div>
        <b class="ready-badge">${runtimeSummary.readySeatCount}/${runtimeSummary.seatCount} READY</b>
      </div>
      <p class="royal-copy">Recipe 可以帮助同一 Provider 找到输入/发送/回答位置，但 <strong>Test Speech + Council Gate 必须每个 tab 独立通过</strong>。</p>
      <div class="validation-board">${validationBoardHtml(runtimeSummary.delegations)}</div>
      <div class="royal-actions">
        <button type="button" data-action="validation">打开现有验证区 ↓</button>
        <button type="button" data-action="refresh">刷新进度</button>
      </div>
      <small class="royal-rule">识别 ≠ 登录 ≠ Recipe ≠ Test ≠ Gate ≠ READY</small>
    `;
  }

  if (act === 5) {
    return `
      <div class="royal-head">
        <div><span>ACT V · ADMIT THE HOUSE</span><h2>⚖️ 已有 ${runtimeSummary.readySeatCount} 个真实席位可以开廷</h2></div>
        <b class="ready-badge is-pass">HOUSE READY</b>
      </div>
      <div class="validation-board">${validationBoardHtml(runtimeSummary.delegations)}</div>
      <div class="mode-choice">
        <button type="button" data-mode="free"><b>🗣️ 自由议会</b><span>所有席位直接同场讨论</span></button>
        <button type="button" data-mode="committee"><b>🏛️ 委员会审议</b><span>跨 Provider 混编证据 / 工程 / 反例等调查维度</span></button>
      </div>
      <div class="royal-actions">
        <button type="button" class="royal-primary" data-action="first-council">🔥 准备第一次 Council</button>
      </div>
    `;
  }

  if (act === 6) {
    const running = Boolean(document.querySelector(".stage-pill.stage-sealed,.stage-pill.stage-debate,.stage-pill.stage-final"));
    return `
      <div class="royal-head">
        <div><span>ACT VI · FIRST COUNCIL</span><h2>🔥 国王只需要下令一次。</h2></div>
        <b class="ready-badge is-pass">${runtimeSummary.readySeatCount} REAL SEATS</b>
      </div>
      <p class="royal-copy">问题可以改。开廷后向导不会替你发 Round 2；现有 CouncilOrchestrator 会自动完成 sealed → debate → final。</p>
      <textarea class="royal-question" rows="5">${escapeHtml(firstQuestion)}</textarea>
      <div class="royal-actions">
        <button type="button" data-action="back-ready">← 席位检查</button>
        <button type="button" class="royal-primary" data-action="convene" ${running ? "disabled" : ""}>${running ? "廷议进行中…" : "👑 CONVENE MY FIRST COUNCIL"}</button>
      </div>
      ${status ? `<div class="royal-status">${escapeHtml(status)}</div>` : ""}
    `;
  }

  const celebration = firstCouncilCelebration(runtimeSummary);
  return `
    <div class="royal-hero complete">
      <span>ACT VII · YOUR FIRST COUNCIL</span>
      <h2>👑 第一场廷议完成。</h2>
      <p>你只下令了一次。剩下的争论、质询和最终表态都由议会自己完成。</p>
      <div class="celebration-metrics">
        <div><b>${celebration.structuredEvents}</b><span>结构化事件</span></div>
        <div><b>${celebration.changedMinds}</b><span>公开改口</span></div>
        <div><b>${celebration.minorityOpinionPresent ? "YES" : "NO"}</b><span>少数意见</span></div>
      </div>
      <div class="royal-actions">
        <button type="button" data-action="replay">🎭 WATCH REPLAY</button>
        <button type="button" class="royal-primary" data-action="finish">继续当国王 →</button>
      </div>
      <small class="royal-rule">这些数字来自当前真实 Council DOM / Blackboard Theater 状态，不是庆祝文案随便编的。</small>
    </div>
  `;
}

function wireGuide(act: RoyalOnboardingAct) {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  host.querySelector('[data-action="find"]')?.addEventListener("click", async () => {
    persisted = { ...persisted, act: 2, dismissed: false };
    status = "";
    await savePersistedState();
    await scanCandidates();
    renderGuide();
  });
  host.querySelector('[data-action="dismiss"]')?.addEventListener("click", async () => {
    persisted = { ...persisted, dismissed: true };
    visible = false;
    await savePersistedState();
    renderGuide();
  });
  host.querySelector('[data-action="back"]')?.addEventListener("click", async () => {
    persisted = { ...persisted, act: 1 };
    await savePersistedState();
    renderGuide();
  });
  host.querySelector('[data-action="rescan"]')?.addEventListener("click", async () => {
    await scanCandidates();
    renderGuide();
  });
  host.querySelectorAll<HTMLInputElement>('input[data-candidate-tab]').forEach((input) => {
    input.addEventListener("change", () => {
      const tabId = Number(input.dataset.candidateTab);
      if (input.checked) selectedTabIds.add(tabId);
      else selectedTabIds.delete(tabId);
      renderGuide();
    });
  });
  host.querySelector('[data-action="summon"]')?.addEventListener("click", () => void summonSelected());
  host.querySelector('[data-action="validation"]')?.addEventListener("click", () => {
    const advanced = document.querySelector<HTMLDetailsElement>("details.advanced-card");
    if (!advanced) return;
    advanced.open = true;
    advanced.scrollIntoView({ behavior: "smooth", block: "start" });
    advanced.animate(
      [
        { boxShadow: "0 0 0 0 rgba(47,122,91,0)" },
        { boxShadow: "0 0 0 4px rgba(47,122,91,.2)" },
        { boxShadow: "0 0 0 0 rgba(47,122,91,0)" },
      ],
      { duration: 1200 },
    );
  });
  host.querySelector('[data-action="refresh"]')?.addEventListener("click", () => {
    runtimeSummary = readRuntimeSummary();
    renderGuide();
  });
  host.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      const target = document.querySelector<HTMLButtonElement>(
        `#chatchat-committee-parliament button[data-mode="${mode}"]`,
      );
      target?.click();
      status = mode === "committee" ? "已选择委员会审议。" : "已选择自由议会。";
      renderGuide();
    });
  });
  host.querySelector('[data-action="first-council"]')?.addEventListener("click", async () => {
    persisted = { ...persisted, act: 6 };
    await savePersistedState();
    renderGuide();
  });
  host.querySelector<HTMLTextAreaElement>(".royal-question")?.addEventListener("input", (event) => {
    firstQuestion = (event.currentTarget as HTMLTextAreaElement).value;
  });
  host.querySelector('[data-action="back-ready"]')?.addEventListener("click", async () => {
    persisted = { ...persisted, act: 5 };
    await savePersistedState();
    renderGuide();
  });
  host.querySelector('[data-action="convene"]')?.addEventListener("click", () => void conveneFirstCouncil());
  host.querySelector('[data-action="replay"]')?.addEventListener("click", () => {
    document.getElementById("chatchat-browser-council-theater")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
  host.querySelector('[data-action="finish"]')?.addEventListener("click", async () => {
    persisted = { version: 1, completed: true, act: 7, dismissed: true };
    visible = false;
    await savePersistedState();
    renderGuide();
    document.querySelector<HTMLTextAreaElement>(".command-card textarea")?.focus();
  });
}

async function scanCandidates() {
  status = "正在扫描已打开的 catalog AI 标签页…";
  try {
    const [tabs, seats] = await Promise.all([queryTabs(), loadSeats()]);
    const plan = planOpenAiTabsForHouse(tabs, seats);
    candidates = plan.candidates;
    selectedTabIds = new Set(candidates.map((candidate) => candidate.tabId));
    status = candidates.length
      ? `发现 ${candidates.length} 个可选标签页。未知/自定义站点仍需手动单独入席。`
      : "没有发现新的 catalog AI 标签页。";
  } catch (caught) {
    candidates = [];
    selectedTabIds.clear();
    status = message(caught);
  }
}

async function summonSelected() {
  const selected = candidates.filter((candidate) => selectedTabIds.has(candidate.tabId));
  if (!selected.length) return;
  persisted = { ...persisted, act: 3 };
  status = `准备召集 ${selected.length} 席…`;
  await savePersistedState();
  renderGuide();

  try {
    const origins = selectedOriginPatterns(selected, selectedTabIds);
    const granted = await chrome.permissions.request({ origins });
    if (!granted) throw new Error("没有授予选中 AI 站点的权限；没有席位被加入。 ");

    const joined: StoredSeat[] = [];
    const failures: string[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      const candidate = selected[index]!;
      status = `正在连接 ${candidate.providerName} · ${index + 1}/${selected.length}`;
      renderGuide();
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

    if (!joined.length) throw new Error(failures[0] ?? "没有标签页成功建立 ChatChat bridge。 ");
    const current = await loadSeats();
    const currentTabs = new Set(current.map((seat) => seat.tabId));
    const merged = [...current, ...joined.filter((seat) => !currentTabs.has(seat.tabId))];
    const store = chrome.storage.session ?? chrome.storage.local;
    await store.set({ [SEATS_KEY]: merged });
    persisted = { ...persisted, act: 4 };
    status = failures.length
      ? `已召集 ${joined.length} 席；${failures.length} 席 bridge 失败。下一步逐代表团 Teach + Test + Gate。`
      : `已召集 ${joined.length} 席。下一步逐代表团 Teach + Test + Gate。`;
    await savePersistedState();
    if (!SHOWCASE) location.reload();
    else renderGuide();
  } catch (caught) {
    persisted = { ...persisted, act: 2 };
    status = message(caught);
    await savePersistedState();
    renderGuide();
  }
}

async function conveneFirstCouncil() {
  if (runtimeSummary.readySeatCount < 2) {
    status = "至少需要 2 个独立标签页席位通过 Test + Gate。";
    renderGuide();
    return;
  }
  const form = document.querySelector<HTMLFormElement>("form.command-card");
  const textarea = form?.querySelector<HTMLTextAreaElement>("textarea");
  if (!form || !textarea) {
    status = "King's Command 表单尚未准备好。";
    renderGuide();
    return;
  }

  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, firstQuestion);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  status = "御令已装填，正在开廷…";
  renderGuide();
  await sleep(120);
  form.requestSubmit();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function readRuntimeSummary(): OnboardingRuntimeSummary {
  const delegations: OnboardingDelegationReadiness[] = [];
  document.querySelectorAll<HTMLElement>(".delegation-row").forEach((row, index) => {
    const providerName = row.querySelector(".delegate-main strong")?.textContent?.trim() || `Delegation ${index + 1}`;
    const detail = row.querySelector(".delegate-main span")?.textContent ?? "";
    const match = detail.match(/(\d+)\/3 taught\s*·\s*(\d+)\/(\d+) ready/i);
    if (!match) return;
    delegations.push({
      delegationId: providerName.toLocaleLowerCase().replace(/\s+/g, "-"),
      providerName,
      recipeProgress: Number(match[1]),
      readyCount: Number(match[2]),
      seatCount: Number(match[3]),
    });
  });
  const seatCount = delegations.reduce((sum, item) => sum + item.seatCount, 0);
  const readySeatCount = delegations.reduce((sum, item) => sum + item.readyCount, 0);
  const theater = document.getElementById("chatchat-browser-council-theater");
  const eventCount = Number(theater?.dataset.theaterTotalEvents ?? 0) ||
    document.querySelectorAll(".event-mini-list .mini-event").length;
  const changedText = document.querySelector(".changed-note")?.textContent ?? "";
  const revisionCount = Number(changedText.match(/(\d+)/)?.[1] ?? 0);
  return {
    seatCount,
    readySeatCount,
    delegations,
    councilComplete: Boolean(document.querySelector(".result-card")),
    eventCount,
    revisionCount,
    minorityOpinionPresent: Boolean(document.querySelector(".minority-note")),
  };
}

function showcaseRuntimeSummary(): OnboardingRuntimeSummary {
  if (SHOWCASE_ACT === "validation") {
    return {
      seatCount: 4,
      readySeatCount: 1,
      councilComplete: false,
      eventCount: 0,
      revisionCount: 0,
      minorityOpinionPresent: false,
      delegations: [
        { delegationId: "chatgpt", providerName: "ChatGPT", recipeProgress: 3, seatCount: 2, readyCount: 1 },
        { delegationId: "gemini", providerName: "Gemini", recipeProgress: 2, seatCount: 1, readyCount: 0 },
        { delegationId: "deepseek", providerName: "DeepSeek", recipeProgress: 0, seatCount: 1, readyCount: 0 },
      ],
    };
  }
  if (SHOWCASE_ACT === "ready") {
    return {
      seatCount: 4,
      readySeatCount: 3,
      councilComplete: false,
      eventCount: 0,
      revisionCount: 0,
      minorityOpinionPresent: false,
      delegations: [
        { delegationId: "chatgpt", providerName: "ChatGPT", recipeProgress: 3, seatCount: 2, readyCount: 2 },
        { delegationId: "gemini", providerName: "Gemini", recipeProgress: 3, seatCount: 1, readyCount: 1 },
        { delegationId: "deepseek", providerName: "DeepSeek", recipeProgress: 2, seatCount: 1, readyCount: 0 },
      ],
    };
  }
  if (SHOWCASE_ACT === "complete") {
    return {
      seatCount: 4,
      readySeatCount: 3,
      councilComplete: true,
      eventCount: 17,
      revisionCount: 1,
      minorityOpinionPresent: true,
      delegations: [
        { delegationId: "chatgpt", providerName: "ChatGPT", recipeProgress: 3, seatCount: 2, readyCount: 2 },
        { delegationId: "gemini", providerName: "Gemini", recipeProgress: 3, seatCount: 1, readyCount: 1 },
        { delegationId: "deepseek", providerName: "DeepSeek", recipeProgress: 2, seatCount: 1, readyCount: 0 },
      ],
    };
  }
  return emptyRuntimeSummary();
}

function showcasePersistedState(): PersistedRoyalOnboardingState {
  const act = showcaseActNumber();
  return { version: 1, completed: act === 7, act, dismissed: false };
}

function showcaseActNumber(): RoyalOnboardingAct {
  if (SHOWCASE_ACT === "validation") return 4;
  if (SHOWCASE_ACT === "ready") return 5;
  if (SHOWCASE_ACT === "first-council") return 6;
  if (SHOWCASE_ACT === "complete") return 7;
  return 2;
}

function candidateGroupHtml(group: { providerName: string; candidates: SummonCandidate[] }): string {
  const selected = group.candidates.filter((item) => selectedTabIds.has(item.tabId)).length;
  return `
    <div class="candidate-group">
      <div class="candidate-head"><strong>${escapeHtml(group.providerName)}</strong><span>${selected}/${group.candidates.length} selected</span></div>
      ${group.candidates.map((candidate) => `
        <label class="candidate-row">
          <input type="checkbox" data-candidate-tab="${candidate.tabId}" ${selectedTabIds.has(candidate.tabId) ? "checked" : ""} />
          <span><b>${escapeHtml(candidate.providerName)}</b><small>${escapeHtml(candidate.hostname)}</small></span>
          <em>UNVERIFIED</em>
        </label>
      `).join("")}
    </div>
  `;
}

function groupCandidates(values: readonly SummonCandidate[]) {
  const groups = new Map<string, SummonCandidate[]>();
  for (const candidate of values) {
    const current = groups.get(candidate.providerName) ?? [];
    current.push(candidate);
    groups.set(candidate.providerName, current);
  }
  return [...groups.entries()].map(([providerName, group]) => ({ providerName, candidates: group }));
}

function validationBoardHtml(delegations: readonly OnboardingDelegationReadiness[]): string {
  if (!delegations.length) {
    return `<div class="royal-empty"><b>等待 Side Panel 恢复席位状态…</b><span>如果刚刚完成召集，刷新页面即可进入验证。</span></div>`;
  }
  return delegations.map((delegation) => {
    const progress = validationProgress(delegation);
    return `
      <div class="validation-row">
        <div><strong>${escapeHtml(delegation.providerName)}</strong><span>Recipe ${delegation.recipeProgress}/3 · ${delegation.readyCount}/${delegation.seatCount} READY</span></div>
        <div class="validation-meter"><i style="width:${progress}%"></i></div>
        <b>${progress}%</b>
      </div>
    `;
  }).join("");
}

function progressHtml(act: RoyalOnboardingAct): string {
  const steps = [
    [1, "欢迎"], [2, "发现"], [3, "召集"], [4, "验证"], [5, "入院"], [6, "开廷"], [7, "完成"],
  ] as const;
  return steps.map(([step, label]) => `
    <div class="royal-step ${step === act ? "is-active" : step < act ? "is-done" : ""}">
      <i>${step < act ? "✓" : step}</i><span>${label}</span>
    </div>
  `).join("");
}

function styles(): string {
  return `<style>
    body.${ACTIVE_CLASS} #chatchat-summon-house{display:none!important}.royal-onboarding{margin:10px 12px 12px;padding:14px;border:1px solid #d8e9e1;border-radius:18px;background:linear-gradient(155deg,#fffefa,#f3faf6 72%);box-shadow:0 14px 34px rgba(31,72,55,.08);color:#173c2d;font-family:inherit;position:relative;z-index:8}.royal-progress{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:12px}.royal-step{display:flex;flex-direction:column;align-items:center;gap:3px;color:#9aacA4;font-size:7px}.royal-step i{font-style:normal;width:18px;height:18px;border-radius:999px;display:grid;place-items:center;background:#edf2ef;font-size:8px;font-weight:800}.royal-step.is-active{color:#1d5b43}.royal-step.is-active i{background:#1b4c39;color:white;box-shadow:0 0 0 3px #e0f0e8}.royal-step.is-done{color:#5b806f}.royal-step.is-done i{background:#dcefe5;color:#216548}.royal-showcase{margin:-4px 0 10px;padding:5px 7px;border-radius:8px;background:#f0edff;color:#6559a4;font-size:7px;font-weight:800;letter-spacing:.07em;text-align:center}.royal-hero>span,.royal-head>div>span{font-size:8px;letter-spacing:.13em;color:#799184;font-weight:800}.royal-hero h2,.royal-head h2{margin:3px 0 7px;font-size:17px;line-height:1.15}.royal-hero p,.royal-copy{margin:0 0 10px;font-size:10px;line-height:1.55;color:#5c7168}.royal-hero.compact{text-align:center;padding:5px}.royal-hero.complete{text-align:left}.royal-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.royal-head>button{border:0;background:transparent;color:#527365;font-size:9px;cursor:pointer}.royal-trust{padding:9px;border-radius:11px;background:#edf7f2;display:flex;flex-direction:column;gap:2px}.royal-trust b{font-size:8px;color:#25654c}.royal-trust span{font-size:9px;color:#60796e}.royal-actions{display:flex;gap:6px;margin-top:11px}.royal-actions button{flex:1;border:1px solid #d5e2dc;border-radius:10px;padding:9px 8px;background:#fff;color:#36594a;font:700 9px system-ui;cursor:pointer}.royal-actions button.royal-primary{background:#173f31;color:#fff;border-color:#173f31}.royal-actions button:disabled{opacity:.45;cursor:not-allowed}.candidate-groups,.validation-board{display:flex;flex-direction:column;gap:7px}.candidate-group{padding:8px;border:1px solid #e1eae6;border-radius:11px;background:#fff}.candidate-head{display:flex;justify-content:space-between;margin-bottom:5px}.candidate-head strong{font-size:10px}.candidate-head span{font-size:8px;color:#82938c}.candidate-row{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:5px;padding:5px 2px;border-top:1px solid #f0f3f2;cursor:pointer}.candidate-row:first-of-type{border-top:0}.candidate-row span b{display:block;font-size:9px}.candidate-row span small{display:block;font-size:8px;color:#8b9993}.candidate-row em{font-style:normal;font-size:7px;font-weight:800;color:#9a6b38;background:#fff3e3;border-radius:999px;padding:3px 5px}.royal-status{margin-top:7px;padding:7px 8px;border-radius:9px;background:#eef5f1;color:#476a5b;font-size:8px;line-height:1.4}.royal-empty{padding:12px;border:1px dashed #cadbd3;border-radius:11px;text-align:center;color:#657d72}.royal-empty b,.royal-empty span{display:block;font-size:9px}.royal-empty span{margin-top:4px;font-size:8px}.royal-loader{display:flex;gap:5px;justify-content:center;margin:12px}.royal-loader i{width:7px;height:7px;border-radius:50%;background:#3d8063;animation:royal-pulse 1s infinite alternate}.royal-loader i:nth-child(2){animation-delay:.2s}.royal-loader i:nth-child(3){animation-delay:.4s}@keyframes royal-pulse{to{opacity:.25;transform:translateY(-3px)}}.ready-badge{font-size:8px;padding:5px 7px;border-radius:999px;background:#f1f3f2;color:#798b83}.ready-badge.is-pass{background:#def1e7;color:#1f6749}.validation-row{display:grid;grid-template-columns:minmax(0,1fr) 70px 32px;gap:6px;align-items:center;padding:7px 8px;border-radius:10px;background:#fff;border:1px solid #e1eae6}.validation-row strong{display:block;font-size:9px}.validation-row span{display:block;font-size:7px;color:#81928a}.validation-row>b{font-size:8px;color:#547565;text-align:right}.validation-meter{height:6px;border-radius:999px;background:#edf2ef;overflow:hidden}.validation-meter i{display:block;height:100%;background:#58a17f;border-radius:inherit}.royal-rule{display:block;margin-top:8px;color:#80938a;font-size:7px;text-align:center}.mode-choice{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.mode-choice button{border:1px solid #dde6e2;background:#fff;border-radius:11px;padding:9px;text-align:left;color:#315847;cursor:pointer}.mode-choice b,.mode-choice span{display:block}.mode-choice b{font-size:9px}.mode-choice span{margin-top:3px;font-size:7px;line-height:1.4;color:#7b8f86}.royal-question{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #d7e3dd;border-radius:11px;background:#fff;padding:9px;color:#294b3c;font:10px/1.5 system-ui;outline:none}.celebration-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:9px 0}.celebration-metrics div{padding:8px;border-radius:11px;background:#eef7f2;text-align:center}.celebration-metrics b,.celebration-metrics span{display:block}.celebration-metrics b{font-size:15px;color:#1f6448}.celebration-metrics span{font-size:7px;color:#758b80}.royal-onboarding #chatchat-royal-onboarding-reopen{display:none}
  </style>`;
}

async function queryTabs(): Promise<SummonBrowserTab[]> {
  return (await chrome.tabs.query({})) as SummonBrowserTab[];
}

async function loadSeats(): Promise<StoredSeat[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(SEATS_KEY);
  return Array.isArray(state[SEATS_KEY]) ? state[SEATS_KEY] : [];
}

async function ensureBridge(tabId: number) {
  try {
    await ping(tabId);
    return;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
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

async function loadPersistedState(): Promise<PersistedRoyalOnboardingState> {
  try {
    const state = await chrome.storage.local.get(ONBOARDING_KEY);
    const value = state[ONBOARDING_KEY];
    if (
      value?.version === 1 &&
      typeof value.completed === "boolean" &&
      Number.isInteger(value.act) && value.act >= 1 && value.act <= 7
    ) {
      return {
        version: 1,
        completed: value.completed,
        act: value.act,
        dismissed: Boolean(value.dismissed),
      };
    }
  } catch {
    // A broken onboarding preference must never block the Side Panel.
  }
  return { ...DEFAULT_ONBOARDING_STATE };
}

async function savePersistedState() {
  if (SHOWCASE) return;
  await chrome.storage.local.set({ [ONBOARDING_KEY]: persisted });
}

function emptyRuntimeSummary(): OnboardingRuntimeSummary {
  return {
    seatCount: 0,
    readySeatCount: 0,
    delegations: [],
    councilComplete: false,
    eventCount: 0,
    revisionCount: 0,
    minorityOpinionPresent: false,
  };
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
