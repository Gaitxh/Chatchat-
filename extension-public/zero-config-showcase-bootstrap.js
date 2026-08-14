(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "zero-config") return;

  const locale = params.get("lang") === "zh" ? "zh-CN" : "en";
  const LOCALE_KEY = "chatchat.locale.v1";
  const memoryLocal = { [LOCALE_KEY]: locale };
  const memorySession = {};
  const onUpdatedListeners = new Set();
  const tabs = new Map();

  document.documentElement.lang = locale;

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
      async set(values) {
        Object.assign(memory, values);
      },
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
      async query() { return [...tabs.values()].map((tab) => ({ ...tab })); },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown zero-config showcase tab ${tabId}`);
        return { ...tab };
      },
      async create({ url, active }) {
        const id = 800 + tabs.size;
        const tab = { id, url, title: "AI · zero-config showcase", active: Boolean(active), status: "complete" };
        tabs.set(id, tab);
        queueMicrotask(() => {
          for (const listener of onUpdatedListeners) listener(id, { status: "complete" }, { ...tab });
        });
        return { ...tab };
      },
      async update(tabId, changes) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`Unknown zero-config showcase tab ${tabId}`);
        Object.assign(tab, changes);
        return { ...tab };
      },
      async remove(tabId) { tabs.delete(tabId); },
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      async sendMessage() {
        return { ok: false, error: "Zero-config showcase does not run provider turns." };
      },
    },
    runtime: {
      getURL(path) { return new URL(path, location.href).toString(); },
      async sendMessage() { return { ok: false, error: "No source verification in zero-config showcase." }; },
    },
  };
})();