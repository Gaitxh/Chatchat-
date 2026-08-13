(() => {
  const showcase = new URLSearchParams(location.search).get("showcase") === "recipe";
  if (!showcase || globalThis.chrome?.storage?.session) return;

  const seatsKey = "chatchat.extension.seats.v1";
  const recipesKey = "chatchat.extension.recipes.v1";
  const tab = {
    id: 201,
    url: "https://chatgpt.com/",
    title: "ChatGPT · Recipe Showcase",
    status: "complete",
    active: true,
  };
  const origin = "https://chatgpt.com";
  const localState = {
    [recipesKey]: {
      [origin]: {
        profileId: origin,
        composerSelector: "textarea[data-testid='prompt-textarea']",
        sendSelector: "button[aria-label='Send message']",
        responseSelector: "[data-message-author-role='assistant']",
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    },
  };
  const sessionState = {
    [seatsKey]: [
      {
        seatId: "extension:openai-chatgpt:201",
        tabId: 201,
        url: tab.url,
        origin,
        hostname: "chatgpt.com",
        providerId: "openai-chatgpt",
        providerName: "ChatGPT",
        delegationId: "openai-chatgpt@https://chatgpt.com",
        delegationName: "ChatGPT Delegation",
        startUrl: "https://chatgpt.com",
        createdByChatChat: false,
      },
    ],
  };

  const showcaseChrome = {
    storage: {
      local: store(localState),
      session: store(sessionState),
    },
    permissions: {
      contains: async () => true,
      request: async () => true,
    },
    scripting: {
      executeScript: async () => [],
    },
    tabs: {
      query: async (query) => query?.active ? [tab] : [tab],
      get: async (id) => id === tab.id ? tab : undefined,
      create: async ({ url, active }) => ({ ...tab, id: 202, url, active: Boolean(active) }),
      update: async (_id, patch) => ({ ...tab, ...patch }),
      sendMessage: async (_id, message) => {
        if (message?.__chatchat && message.type === "PING") {
          return {
            ok: true,
            result: {
              url: tab.url,
              origin,
              title: tab.title,
              readyState: "complete",
            },
          };
        }
        return { ok: false, error: "Recipe showcase only supports PING." };
      },
      onUpdated: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  };

  if (globalThis.chrome) Object.assign(globalThis.chrome, showcaseChrome);
  else globalThis.chrome = showcaseChrome;

  document.documentElement.dataset.chatchatRecipeShowcase = "booted";
  window.addEventListener("load", () => {
    const badge = document.createElement("div");
    badge.textContent = "DETERMINISTIC RECIPE SHOWCASE · MAP ONLY · TEST/GATE NOT IMPORTED";
    badge.style.cssText =
      "position:fixed;z-index:999999;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#6a5225;color:#fff;font:700 8px system-ui;letter-spacing:.05em;opacity:.9;pointer-events:none";
    document.body.appendChild(badge);
  });

  function store(target) {
    return {
      get: async (key) => ({ [key]: target[key] }),
      set: async (values) => Object.assign(target, values),
      remove: async (key) => delete target[key],
    };
  }
})();
