(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "room-keeper") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const LOCALE_KEY = "chatchat.locale.v1";
  const live = {
    seatId: "extension:openai-chatgpt:601",
    participantId: "extension:openai-chatgpt:601",
    tabId: 601,
    providerId: "openai-chatgpt",
    providerName: "ChatGPT",
    origin: "https://chatgpt.com",
    url: "https://chatgpt.com/",
    hostname: "chatgpt.com",
    startUrl: "https://chatgpt.com/",
    createdByChatChat: true,
  };
  const staleClaude = {
    seatId: "extension:anthropic-claude:602",
    participantId: "extension:anthropic-claude:602",
    tabId: 602,
    providerId: "anthropic-claude",
    providerName: "Claude",
    origin: "https://claude.ai",
    url: "https://claude.ai/",
    hostname: "claude.ai",
    startUrl: "https://claude.ai/",
    createdByChatChat: true,
  };
  const staleGemini = {
    seatId: "extension:google-gemini:603",
    participantId: "extension:google-gemini:603",
    tabId: 603,
    providerId: "google-gemini",
    providerName: "Gemini",
    origin: "https://gemini.google.com",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    startUrl: "https://gemini.google.com/app",
    createdByChatChat: true,
  };

  document.documentElement.lang = locale;

  const memoryLocal = {
    [LOCALE_KEY]: locale,
    [RECIPES_KEY]: {
      [live.origin]: {
        profileId: live.origin,
        composerSelector: "[data-demo=composer]",
        sendSelector: "[data-demo=send]",
        responseSelector: "[data-demo=response]",
        createdAt: "2026-08-14T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      },
    },
    "chatchat.first-consultation-guide.done.v1": true,
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: [live, staleClaude, staleGemini],
    [CONNECTIONS_KEY]: {
      [live.seatId]: { state: "ready", automatic: true, verifiedAt: "2026-08-14T00:00:00.000Z" },
      [staleClaude.seatId]: { state: "ready", automatic: true },
      [staleGemini.seatId]: { state: "ready", automatic: true },
    },
  };
  const onUpdatedListeners = new Set();
  const onRemovedListeners = new Set();
  const liveTab = {
    id: live.tabId,
    url: live.url,
    title: "ChatGPT · Room Keeper showcase",
    active: false,
    status: "complete",
  };

  function area(memory) {
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
      async set(values) { Object.assign(memory, values); },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
      },
    };
  }

  window.chrome = {
    storage: {
      local: area(memoryLocal),
      session: area(memorySession),
    },
    permissions: {
      async contains() { return false; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() { return []; },
    },
    tabs: {
      async query() { return [{ ...liveTab }]; },
      async get(tabId) {
        if (tabId === liveTab.id) return { ...liveTab };
        throw new Error(`Room Keeper showcase tab ${tabId} is stale.`);
      },
      async create({ url, active }) {
        return { id: 700, url, active: Boolean(active), status: "complete" };
      },
      async update(tabId, changes) {
        if (tabId !== liveTab.id) throw new Error(`Unknown Room Keeper tab ${tabId}`);
        Object.assign(liveTab, changes);
        return { ...liveTab };
      },
      async remove(tabId) {
        for (const listener of onRemovedListeners) listener(tabId, { windowId: 1, isWindowClosing: false });
      },
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      onRemoved: {
        addListener(listener) { onRemovedListeners.add(listener); },
        removeListener(listener) { onRemovedListeners.delete(listener); },
      },
      async sendMessage() { return { ok: true, result: { ready: true } }; },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "Not used in Room Keeper showcase." }; },
    },
  };
})();