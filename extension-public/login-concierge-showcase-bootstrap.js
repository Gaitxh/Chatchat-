(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-concierge") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const journey = params.get("journey") === "resume" ? "resume" : "static";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const participant = {
    seatId: "extension:anthropic-claude:501",
    participantId: "extension:anthropic-claude:501",
    tabId: 501,
    providerId: "anthropic-claude",
    providerName: "Claude",
    origin: "https://claude.ai",
    url: "https://claude.ai/login?returnTo=%2Fnew",
    hostname: "claude.ai",
    startUrl: "https://claude.ai/",
    createdByChatChat: true,
  };

  document.documentElement.lang = locale;

  const memoryLocal = {
    [LOCALE_KEY]: locale,
    [RECIPES_KEY]: {},
    "chatchat.first-consultation-guide.done.v1": true,
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: [participant],
    [CONNECTIONS_KEY]: {
      [participant.seatId]: {
        state: "failed",
        automatic: true,
        detail: "Provider page is waiting for authentication.",
      },
    },
  };
  const storageListeners = new Set();
  const onUpdatedListeners = new Set();
  const tab = {
    id: 501,
    url: participant.url,
    title: locale === "zh-CN" ? "登录 Claude" : "Log in to Claude",
    active: false,
    status: "complete",
  };
  let loginComplete = false;

  function area(memory, areaName) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys)
          ? keys
          : typeof keys === "string"
            ? [keys]
            : Object.keys(keys);
        return Object.fromEntries(list.map((key) => [key, memory[key]]));
      },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          const oldValue = memory[key];
          memory[key] = value;
          if (oldValue !== value) changes[key] = { oldValue, newValue: value };
        }
        if (Object.keys(changes).length) {
          for (const listener of storageListeners) listener(changes, areaName);
        }
      },
      async remove(keys) {
        const changes = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (!(key in memory)) continue;
          changes[key] = { oldValue: memory[key], newValue: undefined };
          delete memory[key];
        }
        if (Object.keys(changes).length) {
          for (const listener of storageListeners) listener(changes, areaName);
        }
      },
    };
  }

  const recipe = {
    profileId: participant.origin,
    composerSelector: "[data-chatchat-demo=composer]",
    sendSelector: "[data-chatchat-demo=send]",
    responseSelector: "[data-chatchat-demo=response]",
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
  };

  const structuredReady = () => `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({
    contributions: [{
      kind: "argument",
      stance: "READY",
      content: "Structured consultation protocol accepted after login.",
      confidence: 0.99,
    }],
  })}</CHATCHAT_COUNCIL_JSON>`;

  window.chrome = {
    storage: {
      local: area(memoryLocal, "local"),
      session: area(memorySession, "session"),
      onChanged: {
        addListener(listener) { storageListeners.add(listener); },
        removeListener(listener) { storageListeners.delete(listener); },
      },
    },
    permissions: {
      async contains() { return true; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() {
        return [{
          result: loginComplete
            ? { passwordInputs: 0, loginControls: 0, composerCandidates: 1 }
            : { passwordInputs: 1, loginControls: 2, composerCandidates: 0 },
        }];
      },
    },
    tabs: {
      async query() { return [{ ...tab }]; },
      async get(tabId) {
        if (tabId !== tab.id) throw new Error(`Unknown Login Concierge showcase tab ${tabId}`);
        return { ...tab };
      },
      async update(tabId, changes) {
        if (tabId !== tab.id) throw new Error(`Unknown Login Concierge showcase tab ${tabId}`);
        Object.assign(tab, changes);
        return { ...tab };
      },
      async create({ url, active }) {
        return { id: 502, url, active: Boolean(active), status: "complete" };
      },
      async remove() {},
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      async sendMessage(_tabId, payload) {
        if (payload?.type === "PING") {
          return { ok: true, result: { url: tab.url, title: tab.title, readyState: "complete" } };
        }
        if (!loginComplete && (payload?.type === "AUTO_SETUP" || payload?.type === "RUN_SPEECH" || payload?.type === "AWAIT_RECIPE")) {
          return { ok: false, error: "Provider is waiting for login." };
        }
        if (payload?.type === "AUTO_SETUP") {
          await delay(240);
          return {
            ok: true,
            result: {
              recipe,
              responseText: "CHATCHAT_READY",
              elapsedMs: 240,
              diagnostics: { mode: "synthetic-post-login-automatic" },
            },
          };
        }
        if (payload?.type === "RUN_SPEECH") {
          await delay(280);
          const prompt = String(payload.prompt ?? "");
          return {
            ok: true,
            result: {
              responseText: /Protocol handshake only/i.test(prompt) ? structuredReady() : "CHATCHAT_READY",
              elapsedMs: 280,
              responseCount: 1,
            },
          };
        }
        if (payload?.type === "AWAIT_RECIPE") {
          return { ok: true, result: { ready: true, elapsedMs: 20 } };
        }
        return { ok: true, result: {} };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "Not used in Login Concierge showcase." }; },
    },
  };

  if (journey === "resume") void simulateLoginAfterConciergeAppears();

  async function simulateLoginAfterConciergeAppears() {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      if (document.querySelector(".participant-row.connection-needs-login")) {
        document.documentElement.dataset.chatchatLoginJourneySawPrompt = "true";
        await delay(350);
        loginComplete = true;
        tab.url = "https://claude.ai/new";
        tab.title = "Claude";
        participant.url = tab.url;
        for (const listener of onUpdatedListeners) {
          listener(tab.id, { url: tab.url, status: "complete" }, { ...tab });
        }
        return;
      }
      await delay(50);
    }
    document.documentElement.dataset.chatchatLoginJourneyBootstrap = "failed-no-login-prompt";
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
