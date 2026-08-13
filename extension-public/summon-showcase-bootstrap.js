(() => {
  const showcase = new URLSearchParams(location.search).get("showcase") === "summon";
  if (!showcase || globalThis.chrome?.tabs?.query) return;

  const seatsKey = "chatchat.extension.seats.v1";
  const tabs = new Map([
    tab(101, "https://chatgpt.com/", "ChatGPT"),
    tab(102, "https://gemini.google.com/app?hl=zh", "Gemini"),
    tab(103, "https://chat.deepseek.com/", "DeepSeek"),
    tab(104, "https://yuanbao.tencent.com/chat/demo", "Yuanbao · 元宝"),
    tab(105, "https://tongyi.aliyun.com/", "Tongyi · 通义"),
    tab(106, "https://grok.com/", "Grok"),
    tab(107, "https://chat.qwen.ai/", "Qwen"),
  ]);
  const localState = {};
  const sessionState = { [seatsKey]: [] };

  const showcaseChrome = {
    storage: {
      local: store(localState),
      session: store(sessionState),
    },
    permissions: {
      contains: async () => false,
      request: async () => true,
    },
    scripting: {
      executeScript: async () => [],
    },
    tabs: {
      query: async () => [...tabs.values()],
      get: async (id) => tabs.get(id),
      create: async ({ url, active }) => {
        const id = 900 + tabs.size;
        const next = tab(id, url, "Showcase AI");
        next.active = Boolean(active);
        tabs.set(id, next);
        return next;
      },
      update: async (id, patch) => {
        const current = tabs.get(id) ?? { id, status: "complete" };
        const next = { ...current, ...patch, status: "complete" };
        tabs.set(id, next);
        return next;
      },
      sendMessage: async (id, message) => {
        if (!message?.__chatchat || message.type !== "PING") {
          return { ok: false, error: "Summon showcase supports PING only." };
        }
        const current = tabs.get(id);
        return {
          ok: true,
          result: {
            url: current?.url,
            origin: current?.url ? new URL(current.url).origin : "",
            title: current?.title,
            readyState: "complete",
          },
        };
      },
      onUpdated: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  };

  if (globalThis.chrome) Object.assign(globalThis.chrome, showcaseChrome);
  else globalThis.chrome = showcaseChrome;

  document.documentElement.dataset.chatchatSummonShowcase = "booted";
  window.addEventListener("load", () => {
    const badge = document.createElement("div");
    badge.textContent = "DETERMINISTIC SUMMON SHOWCASE · 7 OPEN AI TABS · NO REAL ACCOUNT";
    badge.style.cssText =
      "position:fixed;z-index:999999;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#173b32;color:#fff;font:700 8px system-ui;letter-spacing:.05em;opacity:.88;pointer-events:none";
    document.body.appendChild(badge);
  });

  function tab(id, url, title) {
    return { id, url, title, status: "complete", active: id === 101 };
  }

  function store(target) {
    return {
      get: async (key) => ({ [key]: target[key] }),
      set: async (values) => Object.assign(target, values),
      remove: async (key) => delete target[key],
    };
  }
})();
