(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "onboarding") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  document.documentElement.lang = locale;
  const memoryLocal = { "chatchat.locale.v1": locale };
  const memorySession = {};

  function area(memory) {
    return {
      async get(keys) {
        if (keys == null) return { ...memory };
        const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
        return Object.fromEntries(list.map((key) => [key, memory[key]]));
      },
      async set(values) { Object.assign(memory, values); },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
      },
    };
  }

  const listeners = new Set();
  let nextTabId = 500;

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
      async executeScript() { return []; },
    },
    runtime: {
      getURL(path) { return `chrome-extension://chatchat-showcase/${path}`; },
      async sendMessage() { return { ok: false, error: "No evidence tool call in onboarding showcase." }; },
    },
    tabs: {
      async query() { return []; },
      async get(tabId) { return { id: tabId, url: "https://example.com/", status: "complete" }; },
      async create({ url, active }) {
        nextTabId += 1;
        return { id: nextTabId, url, active: Boolean(active), status: "complete" };
      },
      async update(tabId, changes) { return { id: tabId, url: changes.url ?? "https://example.com/", active: Boolean(changes.active), status: "complete" }; },
      async remove() {},
      async sendMessage() { return { ok: false, error: "Provider bridge is intentionally idle in onboarding showcase." }; },
      onUpdated: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
      },
    },
  };
})();
