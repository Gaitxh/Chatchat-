(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-concierge") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
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
  const onUpdatedListeners = new Set();
  const tab = {
    id: 501,
    url: participant.url,
    title: locale === "zh-CN" ? "登录 Claude" : "Log in to Claude",
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
      async contains() { return true; },
      async request() { return true; },
    },
    scripting: {
      async executeScript() {
        return [{
          result: {
            passwordInputs: 1,
            loginControls: 2,
            composerCandidates: 0,
          },
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
        if (payload?.type === "AUTO_SETUP" || payload?.type === "RUN_SPEECH") {
          return { ok: false, error: "Provider is waiting for login." };
        }
        if (payload?.type === "AWAIT_RECIPE") {
          return { ok: false, error: "Provider is waiting for login." };
        }
        return { ok: true, result: {} };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "Not used in Login Concierge showcase." }; },
    },
  };
})();