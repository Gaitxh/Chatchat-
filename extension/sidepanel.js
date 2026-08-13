import {
  PROVIDERS,
  delegationId,
  detectProvider,
  permissionPattern,
} from "./catalog.js";
import { runCouncil, verifyCouncilGate } from "./council.js";

const STORAGE_KEY = "chatchat:extension:delegations:v1";
const TEMP_TABS_KEY = "chatchat:extension:temporary-tabs:v1";
const MAX_SEATS_PER_DELEGATION = 8;
const MAX_TOTAL_SEATS = 24;
const DEFAULT_QUESTION =
  "如果一个新产品既要 local-first、跨平台，又要让普通用户轻松使用，它最应该优先牺牲什么、坚持什么？";
const TEST_SPEECH =
  "ChatChat connection test. Reply with one short sentence confirming this page can receive a normal message. Do not include private account information.";

const extensionRuntime = Boolean(
  globalThis.chrome?.runtime?.id &&
    chrome.storage?.local &&
    chrome.permissions &&
    chrome.scripting,
);
const forceDemo = new URLSearchParams(location.search).has("demo");

const state = {
  delegations: [],
  question: DEFAULT_QUESTION,
  phase: "idle",
  events: [],
  report: null,
  running: false,
  expandedId: null,
  currentAdvisors: [],
};

const ui = {
  question: document.querySelector("#questionInput"),
  houseSummary: document.querySelector("#houseSummary"),
  modeBadge: document.querySelector("#modeBadge"),
  convene: document.querySelector("#conveneButton"),
  phaseRail: document.querySelector("#phaseRail"),
  addToggle: document.querySelector("#addToggle"),
  addPanel: document.querySelector("#addPanel"),
  providerPresets: document.querySelector("#providerPresets"),
  providerUrl: document.querySelector("#providerUrlInput"),
  addProvider: document.querySelector("#addProviderButton"),
  emptyAdd: document.querySelector("#emptyAddButton"),
  delegationList: document.querySelector("#delegationList"),
  emptyHouse: document.querySelector("#emptyHouse"),
  debateSection: document.querySelector("#debateSection"),
  eventCount: document.querySelector("#eventCount"),
  eventFeed: document.querySelector("#eventFeed"),
  reportSection: document.querySelector("#reportSection"),
  reportStance: document.querySelector("#reportStance"),
  reportConsensus: document.querySelector("#reportConsensus"),
  delegationResults: document.querySelector("#delegationResults"),
  minorityReport: document.querySelector("#minorityReport"),
  toast: document.querySelector("#toast"),
};

void init();

async function init() {
  wireEvents();
  renderPresets();

  if (!extensionRuntime || forceDemo) {
    Object.assign(state, demoState());
    render();
    if (!extensionRuntime && !forceDemo) {
      toast(
        "当前是普通网页预览。加载为 Chrome 扩展后，才会启用真实 AI 标签页连接。",
        false,
        5200,
      );
    }
    return;
  }

  await cleanupOrphanTabs();
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const saved = stored[STORAGE_KEY];
  if (saved && Array.isArray(saved.delegations)) {
    state.delegations = saved.delegations.map((item) =>
      normalizeDelegation({
        ...item,
        // Test/Gate are runtime evidence. Do not silently trust yesterday's
        // remote page after a browser/extension restart.
        testPassed: false,
        gatePassed: false,
        labTabId: null,
      }),
    );
    state.question =
      typeof saved.question === "string" && saved.question.trim()
        ? saved.question
        : DEFAULT_QUESTION;
  }
  await refreshRuntimeState();
  await persist();
  render();
}

function wireEvents() {
  ui.question.addEventListener("input", () => {
    state.question = ui.question.value;
    void persist();
  });
  ui.addToggle.addEventListener("click", () => toggleAddPanel());
  ui.emptyAdd.addEventListener("click", () => toggleAddPanel(true));
  ui.addProvider.addEventListener("click", () => void addProviderFromInput());
  ui.providerUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void addProviderFromInput();
  });
  ui.providerPresets.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-provider-url]");
    if (!button) return;
    ui.providerUrl.value = button.dataset.providerUrl;
    void addProviderFromInput();
  });
  ui.delegationList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-id]");
    if (!button) return;
    void handleDelegationAction(button.dataset.action, button.dataset.id);
  });
  ui.convene.addEventListener("click", () => void convene());
}

function renderPresets() {
  ui.providerPresets.innerHTML = PROVIDERS.map(
    (provider) =>
      `<button class="preset-chip" type="button" data-provider-url="${escapeHtml(provider.startUrl)}">${escapeHtml(provider.shortName)}</button>`,
  ).join("");
}

function toggleAddPanel(forceOpen) {
  const next = forceOpen ?? ui.addPanel.hidden;
  ui.addPanel.hidden = !next;
  if (next) window.setTimeout(() => ui.providerUrl.focus(), 0);
}

async function addProviderFromInput() {
  try {
    const provider = detectProvider(ui.providerUrl.value);
    const id = delegationId(provider);
    const existing = state.delegations.find((item) => item.id === id);
    if (existing) {
      state.expandedId = existing.id;
      render();
      toast(`${existing.shortName} 已在议会中。直接增加席位即可。`);
      return;
    }

    state.delegations.push(
      normalizeDelegation({
        id,
        providerId: provider.id,
        name: provider.name,
        shortName: provider.shortName,
        monogram: provider.monogram,
        startUrl: provider.startUrl,
        inputUrl: provider.inputUrl,
        origin: provider.origin,
        host: provider.host,
        kind: provider.kind,
        seatCount: 1,
        permissionGranted: false,
        labTabId: null,
        recipe: { composer: "", send: "", response: "" },
        testPassed: false,
        gatePassed: false,
      }),
    );
    state.expandedId = id;
    ui.providerUrl.value = "";
    ui.addPanel.hidden = true;
    await persist();
    render();
    toast(`${provider.shortName} 已加入。点“设置”完成一次 Teach / Test / Gate。`);
  } catch (error) {
    toast(errorMessage(error), true);
  }
}

async function handleDelegationAction(action, id) {
  if (state.running) return;
  const delegation = state.delegations.find((item) => item.id === id);
  if (!delegation) return;

  try {
    switch (action) {
      case "toggle-setup":
        state.expandedId = state.expandedId === id ? null : id;
        render();
        break;
      case "remove":
        if (delegation.labTabId && extensionRuntime) {
          await safeRemoveTabs([delegation.labTabId]);
        }
        state.delegations = state.delegations.filter((item) => item.id !== id);
        if (state.expandedId === id) state.expandedId = null;
        await persist();
        render();
        break;
      case "seat-down":
        await setSeatCount(delegation, delegation.seatCount - 1);
        break;
      case "seat-up":
        await setSeatCount(delegation, delegation.seatCount + 1);
        break;
      case "connect":
        await connectDelegation(delegation);
        break;
      case "teach-composer":
        await teach(delegation, "composer");
        break;
      case "teach-send":
        await teach(delegation, "send");
        break;
      case "teach-response":
        await teach(delegation, "response");
        break;
      case "test":
        await testSpeech(delegation);
        break;
      case "gate":
        await openCouncilGate(delegation);
        break;
    }
  } catch (error) {
    toast(errorMessage(error), true, 7000);
  }
}

async function setSeatCount(delegation, count) {
  const next = clamp(count, 1, MAX_SEATS_PER_DELEGATION);
  const others = totalSeats() - delegation.seatCount;
  if (others + next > MAX_TOTAL_SEATS) {
    throw new Error(`众议院当前最多 ${MAX_TOTAL_SEATS} 个席位。`);
  }
  delegation.seatCount = next;
  await persist();
  render();
}

async function connectDelegation(delegation) {
  requireExtensionRuntime();
  await ensurePermission(delegation);
  const tab = await ensureLabTab(delegation, true);
  delegation.permissionGranted = true;
  delegation.labTabId = tab.id;
  await persist();
  render();
  toast(
    `已打开 ${delegation.shortName} 设置页。它会直接复用当前 Chrome 的登录态；未登录时请在该页完成登录。`,
    false,
    6000,
  );
}

async function teach(delegation, role) {
  requireExtensionRuntime();
  await requireConnected(delegation);
  const tab = await ensureLabTab(delegation, true);
  toast(
    `Teach ${role}：请在 ${delegation.shortName} 页点击对应元素；Esc 取消。`,
    false,
    5200,
  );
  const result = await sendToTab(tab.id, {
    type: "CHATCHAT_TEACH",
    role,
  });
  delegation.recipe[role] = result.selector;
  delegation.testPassed = false;
  delegation.gatePassed = false;
  await persist();
  render();
  toast(`${delegation.shortName} · ${role} 已学会。`);
}

async function testSpeech(delegation) {
  requireExtensionRuntime();
  assertRecipe(delegation);
  await requireConnected(delegation);
  const tab = await ensureLabTab(delegation, false);
  const result = await sendToTab(tab.id, {
    type: "CHATCHAT_TEST",
    recipe: delegation.recipe,
    message: TEST_SPEECH,
    timeoutMs: 90000,
  });
  delegation.testPassed = true;
  delegation.gatePassed = false;
  delegation.lastTestMs = result.elapsedMs;
  await persist();
  render();
  toast(`${delegation.shortName} Test Speech 通过。下一步 Council Gate。`);
}

async function openCouncilGate(delegation) {
  requireExtensionRuntime();
  assertRecipe(delegation);
  if (!delegation.testPassed) {
    throw new Error("先完成一次 Test Speech，再打开 Council Gate。");
  }
  await requireConnected(delegation);
  const tab = await ensureLabTab(delegation, false);
  const advisor = {
    id: `${delegation.id}:gate`,
    name: `${delegation.shortName} Gate`,
    providerId: delegation.providerId,
    delegationId: delegation.id,
    delegationName: delegation.shortName,
    tabId: tab.id,
    recipe: delegation.recipe,
  };

  await verifyCouncilGate(advisor, async (_advisor, prompt) => {
    const result = await sendToTab(tab.id, {
      type: "CHATCHAT_TURN",
      recipe: delegation.recipe,
      prompt,
      timeoutMs: 120000,
    });
    return result.text;
  });

  delegation.gatePassed = true;
  await persist();
  render();
  toast(`${delegation.shortName} 已通过 Council Gate，可以入席。`);
}

async function convene() {
  if (state.running) return;
  try {
    requireExtensionRuntime();
    const ready = state.delegations.filter(
      (delegation) =>
        delegation.gatePassed &&
        delegation.permissionGranted &&
        recipeComplete(delegation.recipe),
    );
    const readySeats = ready.reduce((sum, item) => sum + item.seatCount, 0);
    if (readySeats < 2) {
      throw new Error(
        "至少需要 2 个已通过 Council Gate 的独立席位。一个 Provider 党团也可以拥有多个席位。",
      );
    }

    state.running = true;
    state.phase = "preparing";
    state.events = [];
    state.report = null;
    state.currentAdvisors = [];
    render();

    const advisors = await prepareHouseSeats(ready);
    state.currentAdvisors = advisors;
    state.phase = "sealed";
    render();

    const report = await runCouncil({
      advisors,
      question: state.question,
      sendTurn: async (advisor, prompt) => {
        const result = await sendToTab(advisor.tabId, {
          type: "CHATCHAT_TURN",
          recipe: advisor.recipe,
          prompt,
          timeoutMs: 120000,
        });
        return result.text;
      },
      onPhase: async ({ phase }) => {
        state.phase = phase;
        renderPhase();
      },
      onEvent: async (_event, events) => {
        state.events = events;
        renderEvents();
      },
    });

    state.report = report;
    state.events = report.events;
    state.phase = "complete";
    render();
  } catch (error) {
    state.phase = "error";
    toast(errorMessage(error), true, 8500);
    render();
  } finally {
    state.running = false;
    await cleanupOrphanTabs();
    render();
  }
}

async function prepareHouseSeats(delegations) {
  await cleanupOrphanTabs();
  const seatSpecs = [];
  for (const delegation of delegations) {
    await ensurePermission(delegation);
    for (let index = 0; index < delegation.seatCount; index += 1) {
      seatSpecs.push({ delegation, index });
    }
  }

  if (seatSpecs.length > MAX_TOTAL_SEATS) {
    throw new Error(`席位数超过 ${MAX_TOTAL_SEATS} 的安全上限。`);
  }

  const advisors = [];
  const temporaryTabIds = [];
  try {
    for (const spec of seatSpecs) {
      const { delegation, index } = spec;
      const tab = await chrome.tabs.create({
        url: freshStartUrl(delegation),
        active: false,
      });
      if (typeof tab.id !== "number") throw new Error("Chrome did not return a tab id.");
      temporaryTabIds.push(tab.id);
      await setTemporaryTabIds(temporaryTabIds);
      await waitForTabComplete(tab.id, 35000);
      await ensureContentScript(tab.id);
      const check = await sendToTab(tab.id, {
        type: "CHATCHAT_CHECK_RECIPE",
        recipe: delegation.recipe,
      });
      if (!check.ready) {
        throw new Error(
          `${delegation.shortName}-${index + 1} 的 fresh session 与已教 Recipe 不匹配。请重新 Teach。`,
        );
      }

      advisors.push({
        id: `${delegation.id}:seat:${index + 1}:${crypto.randomUUID().slice(0, 6)}`,
        name: `${delegation.shortName}-${index + 1}`,
        providerId: delegation.providerId,
        delegationId: delegation.id,
        delegationName: delegation.shortName,
        seatIndex: index + 1,
        tabId: tab.id,
        recipe: delegation.recipe,
      });
    }
  } catch (error) {
    await safeRemoveTabs(temporaryTabIds);
    await setTemporaryTabIds([]);
    throw error;
  }

  return advisors;
}

async function refreshRuntimeState() {
  if (!extensionRuntime) return;
  for (const delegation of state.delegations) {
    delegation.permissionGranted = await chrome.permissions.contains({
      origins: [permissionPattern(freshStartUrl(delegation))],
    });
    if (delegation.labTabId) {
      const tab = await safeGetTab(delegation.labTabId);
      if (!tab) delegation.labTabId = null;
    }
  }
}

async function requireConnected(delegation) {
  if (!delegation.permissionGranted) await ensurePermission(delegation);
  await ensureLabTab(delegation, false);
}

async function ensurePermission(delegation) {
  const pattern = permissionPattern(freshStartUrl(delegation));
  const contains = await chrome.permissions.contains({ origins: [pattern] });
  if (!contains) {
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error(`你没有授予 ${delegation.host} 的页面权限。`);
  }
  delegation.permissionGranted = true;
}

async function ensureLabTab(delegation, activate) {
  if (delegation.labTabId) {
    const existing = await safeGetTab(delegation.labTabId);
    if (existing) {
      if (activate) await chrome.tabs.update(existing.id, { active: true });
      await waitForTabComplete(existing.id, 30000);
      await ensureContentScript(existing.id);
      return existing;
    }
  }

  const tab = await chrome.tabs.create({
    url: freshStartUrl(delegation),
    active: activate,
  });
  if (typeof tab.id !== "number") throw new Error("Chrome did not return a tab id.");
  delegation.labTabId = tab.id;
  await waitForTabComplete(tab.id, 30000);
  await ensureContentScript(tab.id);
  await persist();
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
  } catch (error) {
    throw new Error(`无法注入 ChatChat bridge：${errorMessage(error)}`);
  }
}

async function sendToTab(tabId, message) {
  await ensureContentScript(tabId);
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.ok) throw new Error(response?.error || "Provider page did not respond.");
  return response.result;
}

async function waitForTabComplete(tabId, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await safeGetTab(tabId);
    if (!tab) throw new Error("AI tab was closed while ChatChat was preparing it.");
    if (tab.status === "complete") return tab;
    await sleep(250);
  }
  throw new Error("AI page took too long to load.");
}

async function cleanupOrphanTabs() {
  if (!extensionRuntime) return;
  const stored = await chrome.storage.local.get(TEMP_TABS_KEY);
  const ids = Array.isArray(stored[TEMP_TABS_KEY])
    ? stored[TEMP_TABS_KEY].filter(Number.isInteger)
    : [];
  await safeRemoveTabs(ids);
  await setTemporaryTabIds([]);
}

async function setTemporaryTabIds(ids) {
  if (!extensionRuntime) return;
  await chrome.storage.local.set({ [TEMP_TABS_KEY]: ids });
}

async function safeRemoveTabs(ids) {
  for (const id of ids) {
    try {
      await chrome.tabs.remove(id);
    } catch {
      // Tab already closed by the user.
    }
  }
}

async function safeGetTab(id) {
  try {
    return await chrome.tabs.get(id);
  } catch {
    return null;
  }
}

function freshStartUrl(delegation) {
  return delegation.kind === "custom"
    ? delegation.inputUrl || delegation.startUrl
    : delegation.startUrl;
}

function normalizeDelegation(input) {
  return {
    id: String(input.id),
    providerId: String(input.providerId),
    name: String(input.name),
    shortName: String(input.shortName || input.name),
    monogram: String(input.monogram || "AI"),
    startUrl: String(input.startUrl),
    inputUrl: String(input.inputUrl || input.startUrl),
    origin: String(input.origin || new URL(input.startUrl).origin),
    host: String(input.host || new URL(input.startUrl).hostname),
    kind: input.kind === "custom" ? "custom" : "known",
    seatCount: clamp(Number(input.seatCount || 1), 1, MAX_SEATS_PER_DELEGATION),
    permissionGranted: Boolean(input.permissionGranted),
    labTabId: Number.isInteger(input.labTabId) ? input.labTabId : null,
    recipe: {
      composer: String(input.recipe?.composer || ""),
      send: String(input.recipe?.send || ""),
      response: String(input.recipe?.response || ""),
    },
    testPassed: Boolean(input.testPassed),
    gatePassed: Boolean(input.gatePassed),
    lastTestMs: Number.isFinite(input.lastTestMs) ? input.lastTestMs : null,
  };
}

async function persist() {
  if (!extensionRuntime || forceDemo) return;
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      question: state.question,
      delegations: state.delegations.map((item) => ({
        ...item,
        labTabId: item.labTabId,
      })),
    },
  });
}

function render() {
  ui.question.value = state.question;
  const seats = totalSeats();
  const readySeats = readySeatCount();
  const isHouse = seats > 4 || state.delegations.some((item) => item.seatCount > 1);
  ui.houseSummary.textContent = `${state.delegations.length} delegations · ${seats} seats`;
  ui.modeBadge.textContent = isHouse ? `AI House · ${seats} seats` : `Roundtable · ${seats} seats`;
  ui.modeBadge.classList.toggle("is-house", isHouse);
  ui.convene.disabled = state.running || readySeats < 2 || !state.question.trim();
  ui.convene.textContent = state.running ? phaseButtonCopy(state.phase) : isHouse ? "召开众议院" : "开廷";
  ui.emptyHouse.hidden = state.delegations.length > 0;
  ui.delegationList.hidden = state.delegations.length === 0;
  renderDelegations();
  renderPhase();
  renderEvents();
  renderReport();
}

function renderDelegations() {
  ui.delegationList.innerHTML = state.delegations
    .map((delegation) => delegationHtml(delegation))
    .join("");
}

function delegationHtml(delegation) {
  const recipeCount = [
    delegation.recipe.composer,
    delegation.recipe.send,
    delegation.recipe.response,
  ].filter(Boolean).length;
  const ready = delegation.gatePassed;
  const status = ready
    ? { className: "is-ready", text: "Council ready" }
    : delegation.permissionGranted
      ? { className: "is-warning", text: `${recipeCount}/3 taught` }
      : { className: "", text: "Needs setup" };
  const expanded = state.expandedId === delegation.id;
  const disabled = state.running ? "disabled" : "";

  return `
    <article class="delegation-card">
      <div class="delegation-main">
        <div class="delegation-avatar">${escapeHtml(delegation.monogram)}</div>
        <div class="delegation-copy">
          <strong>${escapeHtml(delegation.name)}</strong>
          <span>${escapeHtml(delegation.host)} · <span class="status-dot ${status.className}">${status.text}</span></span>
        </div>
        <div class="seat-stepper" title="Independent seats in this delegation">
          <button class="seat-button" data-action="seat-down" data-id="${escapeHtml(delegation.id)}" ${disabled}>−</button>
          <div class="seat-count"><strong>× ${delegation.seatCount}</strong><span>seats</span></div>
          <button class="seat-button" data-action="seat-up" data-id="${escapeHtml(delegation.id)}" ${disabled}>+</button>
        </div>
      </div>
      <div class="delegation-footer">
        <small>${delegation.seatCount > 1 ? `${delegation.shortName}-1 … ${delegation.shortName}-${delegation.seatCount} · independent sessions` : "1 independent session"}</small>
        <div class="command-actions">
          <button class="text-button" data-action="toggle-setup" data-id="${escapeHtml(delegation.id)}" ${disabled}>${expanded ? "收起" : "设置"}</button>
          <button class="text-button" data-action="remove" data-id="${escapeHtml(delegation.id)}" ${disabled}>移除</button>
        </div>
      </div>
      ${expanded ? setupHtml(delegation, recipeCount, disabled) : ""}
    </article>`;
}

function setupHtml(delegation, recipeCount, disabled) {
  return `
    <div class="setup-panel">
      <p class="setup-help">浏览器插件直接复用你当前 Chrome 的网站登录态。只在你点击连接时申请 ${escapeHtml(delegation.host)} 权限。</p>
      <div class="setup-row">
        <button class="setup-button ${delegation.permissionGranted ? "is-done" : ""}" data-action="connect" data-id="${escapeHtml(delegation.id)}" ${disabled}>${delegation.permissionGranted ? "✓ 已授权" : "1 · 连接"}</button>
        <button class="setup-button ${delegation.recipe.composer ? "is-done" : ""}" data-action="teach-composer" data-id="${escapeHtml(delegation.id)}" ${disabled}>Composer</button>
        <button class="setup-button ${delegation.recipe.send ? "is-done" : ""}" data-action="teach-send" data-id="${escapeHtml(delegation.id)}" ${disabled}>Send</button>
        <button class="setup-button ${delegation.recipe.response ? "is-done" : ""}" data-action="teach-response" data-id="${escapeHtml(delegation.id)}" ${disabled}>Response</button>
      </div>
      <div class="setup-row">
        <button class="setup-button ${delegation.testPassed ? "is-done" : ""}" data-action="test" data-id="${escapeHtml(delegation.id)}" ${disabled || recipeCount < 3 ? "disabled" : ""}>${delegation.testPassed ? "✓ Test" : "2 · Test Speech"}</button>
        <button class="setup-button ${delegation.gatePassed ? "is-done" : ""}" data-action="gate" data-id="${escapeHtml(delegation.id)}" ${disabled || !delegation.testPassed ? "disabled" : ""}>${delegation.gatePassed ? "✓ Council Ready" : "3 · Council Gate"}</button>
      </div>
      <p class="house-disclaimer">多席位共享同一模型/账号身份，但每个席位使用独立临时 tab 与独立对话。它们是独立采样，不是独立模型来源，也不会被要求为同党团站队。</p>
    </div>`;
}

function renderPhase() {
  const order = ["sealed", "debate", "final"];
  const current = order.indexOf(state.phase);
  for (const node of ui.phaseRail.querySelectorAll("span[data-phase]")) {
    const index = order.indexOf(node.dataset.phase);
    node.classList.toggle("is-active", index === current);
    node.classList.toggle("is-done", current > index || state.phase === "complete");
  }
}

function renderEvents() {
  ui.debateSection.hidden = state.events.length === 0 && !state.running;
  ui.eventCount.textContent = String(state.events.length);
  const advisors = new Map(state.currentAdvisors.map((item) => [item.id, item]));
  ui.eventFeed.innerHTML = state.events
    .slice(-40)
    .map((event) => {
      const actor = advisors.get(event.actorId);
      const name = actor?.name || event.actorId;
      const label = eventLabel(event.kind);
      const content = event.content || event.claim || "";
      return `
        <article class="event-item">
          <header>
            <span class="event-icon">${eventIcon(event.kind)}</span>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(label)}</span>
            <small>R${event.round}</small>
          </header>
          <p>${escapeHtml(clip(content, 380))}</p>
          ${event.kind === "revision" ? `<div class="changed-mind">↻ CHANGED MIND → ${escapeHtml(event.stance)}</div>` : ""}
        </article>`;
    })
    .join("");
  if (state.running && ui.eventFeed.lastElementChild) {
    ui.eventFeed.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function renderReport() {
  const report = state.report;
  ui.reportSection.hidden = !report;
  if (!report) return;

  ui.reportStance.textContent = report.consensusStance || "No consensus";
  ui.reportConsensus.textContent = `${Math.round(report.consensusRatio * 100)}%`;
  ui.delegationResults.innerHTML = report.delegationSummary
    .map((group) => {
      const stanceCounts = countStances(group.positions);
      const summary = stanceCounts.length
        ? stanceCounts.map(([stance, count]) => `${count}× ${stance}`).join(" · ")
        : "No final position";
      return `
        <div class="delegation-result">
          <div><strong>${escapeHtml(group.name)}</strong><span>${escapeHtml(summary)} · ${group.seats} seats</span></div>
          <div class="cohesion">${Math.round(group.cohesion * 100)}% cohesion</div>
        </div>`;
    })
    .join("");

  if (report.disagreements.length) {
    ui.minorityReport.hidden = false;
    ui.minorityReport.innerHTML = `<strong>Minority Report</strong><br>${report.disagreements
      .map(
        (item) =>
          `${escapeHtml(item.participant.name)} → <b>${escapeHtml(item.stance)}</b>`,
      )
      .join("<br>")}`;
  } else {
    ui.minorityReport.hidden = true;
    ui.minorityReport.textContent = "";
  }
}

function demoState() {
  const gpt = normalizeDelegation({
    id: "delegation:openai-chatgpt",
    providerId: "openai-chatgpt",
    name: "ChatGPT",
    shortName: "GPT",
    monogram: "G",
    startUrl: "https://chatgpt.com/",
    inputUrl: "https://chatgpt.com/",
    host: "chatgpt.com",
    kind: "known",
    seatCount: 5,
    permissionGranted: true,
    recipe: { composer: "#prompt", send: "button", response: ".answer" },
    testPassed: true,
    gatePassed: true,
  });
  const qwen = normalizeDelegation({
    id: "delegation:alibaba-tongyi",
    providerId: "alibaba-tongyi",
    name: "Qwen / Tongyi · 通义",
    shortName: "Qwen",
    monogram: "Q",
    startUrl: "https://tongyi.aliyun.com/",
    inputUrl: "https://tongyi.aliyun.com/",
    host: "tongyi.aliyun.com",
    kind: "known",
    seatCount: 5,
    permissionGranted: true,
    recipe: { composer: "#prompt", send: "button", response: ".answer" },
    testPassed: true,
    gatePassed: true,
  });
  return {
    delegations: [gpt, qwen],
    question: DEFAULT_QUESTION,
    phase: "idle",
    events: [],
    report: null,
    running: false,
    expandedId: null,
    currentAdvisors: [],
  };
}

function countStances(stances) {
  const counts = new Map();
  for (const stance of stances) counts.set(stance, (counts.get(stance) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function readySeatCount() {
  return state.delegations
    .filter((item) => item.gatePassed && item.permissionGranted && recipeComplete(item.recipe))
    .reduce((sum, item) => sum + item.seatCount, 0);
}

function totalSeats() {
  return state.delegations.reduce((sum, item) => sum + item.seatCount, 0);
}

function recipeComplete(recipe) {
  return Boolean(recipe?.composer && recipe?.send && recipe?.response);
}

function assertRecipe(delegation) {
  if (!recipeComplete(delegation.recipe)) {
    throw new Error("先 Teach Composer / Send / Response 三个表面。");
  }
}

function requireExtensionRuntime() {
  if (!extensionRuntime || forceDemo) {
    throw new Error("真实 AI 标签页连接只在已加载的 Chrome 扩展中可用。");
  }
}

function phaseButtonCopy(phase) {
  switch (phase) {
    case "preparing":
      return "召集议员…";
    case "sealed":
      return "独立思考…";
    case "debate":
      return "廷议中…";
    case "final":
      return "表决中…";
    default:
      return "进行中…";
  }
}

function eventIcon(kind) {
  return {
    argument: "●",
    challenge: "↗",
    evidence: "◇",
    support: "+",
    defense: "▣",
    revision: "↻",
    concede: "↓",
    question: "?",
    uncertain: "~",
    final_position: "✓",
  }[kind] || "·";
}

function eventLabel(kind) {
  return {
    argument: "立场",
    challenge: "质询",
    evidence: "证据",
    support: "支持",
    defense: "答辩",
    revision: "改口",
    concede: "让步",
    question: "提问",
    uncertain: "保留",
    final_position: "最终表态",
  }[kind] || kind;
}

function toast(message, isError = false, duration = 3400) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("is-error", isError);
  ui.toast.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    ui.toast.hidden = true;
  }, duration);
}

function errorMessage(error) {
  return String(error instanceof Error ? error.message : error);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function clip(value, max) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
