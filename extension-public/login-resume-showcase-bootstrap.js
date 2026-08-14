(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-resume") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const journey = params.get("journey") === "login" ? "login" : "auto";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const GUIDE_DONE_KEY = "chatchat.first-consultation-guide.done.v1";

  document.documentElement.lang = locale;

  const participants = [
    {
      seatId: "extension:openai-chatgpt:201",
      participantId: "extension:openai-chatgpt:201",
      tabId: 201,
      url: "https://chatgpt.com/auth/login",
      origin: "https://chatgpt.com",
      hostname: "chatgpt.com",
      providerId: "openai-chatgpt",
      providerName: "ChatGPT",
      startUrl: "https://chatgpt.com/",
      createdByChatChat: true,
    },
    {
      seatId: "extension:anthropic-claude:202",
      participantId: "extension:anthropic-claude:202",
      tabId: 202,
      url: "https://claude.ai/",
      origin: "https://claude.ai",
      hostname: "claude.ai",
      providerId: "anthropic-claude",
      providerName: "Claude",
      startUrl: "https://claude.ai/",
      createdByChatChat: true,
    },
  ];

  const recipes = Object.fromEntries(participants.map((participant) => [
    participant.origin,
    {
      profileId: participant.origin,
      composerSelector: "[data-chatchat-demo=composer]",
      sendSelector: "[data-chatchat-demo=send]",
      responseSelector: "[data-chatchat-demo=response]",
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    },
  ]));

  const memoryLocal = {
    [RECIPES_KEY]: recipes,
    [LOCALE_KEY]: locale,
    [GUIDE_DONE_KEY]: true,
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: participants,
    [CONNECTIONS_KEY]: {
      [participants[0].seatId]: { state: "failed", automatic: true, detail: "Provider is waiting for sign in." },
      [participants[1].seatId]: { state: "ready", automatic: true, verifiedAt: "2026-08-14T00:00:00.000Z" },
    },
  };

  const storageListeners = new Set();
  const tabUpdatedListeners = new Set();
  let loginComplete = false;

  function area(memory, areaName) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
        return Object.fromEntries(list.map((key) => [key, memory[key]]));
      },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: memory[key], newValue: value };
          memory[key] = value;
        }
        for (const listener of storageListeners) listener(changes, areaName);
      },
      async remove(keys) {
        const changes = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          changes[key] = { oldValue: memory[key], newValue: undefined };
          delete memory[key];
        }
        for (const listener of storageListeners) listener(changes, areaName);
      },
    };
  }

  const tabs = new Map([
    [201, { id: 201, url: "https://chatgpt.com/auth/login", title: "Log in | ChatGPT", active: false, status: "complete" }],
    [202, { id: 202, url: "https://claude.ai/", title: "Claude", active: false, status: "complete" }],
  ]);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const structuredReady = () => `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{ kind: "argument", stance: "READY", content: "Structured consultation protocol accepted.", confidence: 0.99 }] })}</CHATCHAT_COUNCIL_JSON>`;

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
      async executeScript() { return []; },
    },
    runtime: {
      getURL(path) { return `chrome-extension://chatchat-showcase/${path}`; },
      async sendMessage() { return { ok: false, error: "No runtime tool call is expected in login showcase." }; },
    },
    tabs: {
      async query(query) {
        const values = [...tabs.values()];
        if (query?.active) return values.filter((tab) => tab.active);
        return values.map((tab) => ({ ...tab }));
      },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown showcase tab ${tabId}`);
        return { ...tab };
      },
      async update(tabId, changes) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown showcase tab ${tabId}`);
        if (changes.active) {
          for (const item of tabs.values()) item.active = false;
          tab.active = true;
        }
        if (changes.url) tab.url = changes.url;
        return { ...tab };
      },
      async create({ url, active }) {
        const id = 900 + tabs.size;
        const tab = { id, url, title: "AI · showcase", active: Boolean(active), status: "complete" };
        tabs.set(id, tab);
        return { ...tab };
      },
      async remove(tabId) { tabs.delete(tabId); },
      onUpdated: {
        addListener(listener) { tabUpdatedListeners.add(listener); },
        removeListener(listener) { tabUpdatedListeners.delete(listener); },
      },
      async sendMessage(tabId, payload) {
        if (!payload?.__chatchat) return { ok: false, error: "Not a ChatChat bridge message." };
        const tab = tabs.get(tabId);
        if (!tab) return { ok: false, error: "Unknown showcase tab." };

        if (payload.type === "PING") return { ok: true, result: { url: tab.url, title: tab.title, readyState: "complete" } };
        if (payload.type === "PROBE") {
          return {
            ok: true,
            result: {
              url: tab.url,
              origin: new URL(tab.url).origin,
              hostname: new URL(tab.url).hostname,
              title: tab.title,
              readyState: "complete",
              inputs: tabId === 201 && !loginComplete ? 2 : 1,
              buttons: 3,
              assistantCandidates: 0,
            },
          };
        }
        if (payload.type === "AWAIT_RECIPE") return { ok: true, result: { ready: true, elapsedMs: 20 } };
        if (payload.type === "AUTO_SETUP") return { ok: false, error: "Showcase uses a pre-existing complete automatic recipe." };
        if (payload.type === "RUN_SPEECH") {
          if (tabId === 201 && !loginComplete) {
            return { ok: false, error: "Provider is waiting for sign in." };
          }
          await delay(520);
          const prompt = String(payload.prompt ?? "");
          if (/Protocol handshake only/i.test(prompt)) {
            return { ok: true, result: { responseText: structuredReady(), elapsedMs: 520, responseCount: 1 } };
          }
          return { ok: true, result: { responseText: "CHATCHAT_READY", elapsedMs: 520, responseCount: 1 } };
        }
        return { ok: false, error: `Unsupported showcase bridge command: ${payload.type}` };
      },
    },
  };

  if (journey === "auto") {
    window.setTimeout(() => {
      loginComplete = true;
      const tab = tabs.get(201);
      if (!tab) return;
      tab.url = "https://chatgpt.com/";
      tab.title = "ChatGPT";
      tab.status = "complete";
      for (const listener of tabUpdatedListeners) {
        listener(201, { url: tab.url, status: "complete" }, { ...tab });
      }
    }, 2600);
  }
})();
