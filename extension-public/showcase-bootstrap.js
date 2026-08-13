(() => {
  const showcase = new URLSearchParams(location.search).get("showcase") === "1";
  if (!showcase || globalThis.chrome?.tabs?.query) return;

  const recipesKey = "chatchat.extension.recipes.v1";
  const seatsKey = "chatchat.extension.seats.v1";
  const now = new Date().toISOString();
  const seats = [
    seat(101, "openai-chatgpt", "ChatGPT", "https://chatgpt.com", "gpt", "GPT Delegation"),
    seat(102, "openai-chatgpt", "ChatGPT", "https://chatgpt.com", "gpt", "GPT Delegation"),
    seat(103, "openai-chatgpt", "ChatGPT", "https://chatgpt.com", "gpt", "GPT Delegation"),
    seat(104, "openai-chatgpt", "ChatGPT", "https://chatgpt.com", "gpt", "GPT Delegation"),
    seat(105, "openai-chatgpt", "ChatGPT", "https://chatgpt.com", "gpt", "GPT Delegation"),
    seat(201, "qwen-chat", "Qwen", "https://chat.qwen.ai", "qwen", "Qwen Delegation"),
    seat(202, "qwen-chat", "Qwen", "https://chat.qwen.ai", "qwen", "Qwen Delegation"),
    seat(203, "qwen-chat", "Qwen", "https://chat.qwen.ai", "qwen", "Qwen Delegation"),
    seat(204, "qwen-chat", "Qwen", "https://chat.qwen.ai", "qwen", "Qwen Delegation"),
    seat(205, "qwen-chat", "Qwen", "https://chat.qwen.ai", "qwen", "Qwen Delegation"),
  ];
  const tabs = new Map(
    seats.map((item) => [
      item.tabId,
      {
        id: item.tabId,
        url: item.url,
        title: `${item.providerName} · showcase`,
        status: "complete",
        active: item.tabId === 101,
      },
    ]),
  );
  const storage = {
    [recipesKey]: {
      "https://chatgpt.com": recipe("https://chatgpt.com"),
      "https://chat.qwen.ai": recipe("https://chat.qwen.ai"),
    },
  };
  const session = { [seatsKey]: seats };

  const showcaseChrome = {
    storage: {
      local: store(storage),
      session: store(session),
    },
    permissions: {
      contains: async () => true,
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
        const tab = {
          id,
          url,
          title: "Showcase seat",
          status: "complete",
          active: Boolean(active),
        };
        tabs.set(id, tab);
        return tab;
      },
      update: async (id, patch) => {
        const tab = tabs.get(id) ?? { id, status: "complete" };
        const next = { ...tab, ...patch, status: "complete" };
        tabs.set(id, next);
        return next;
      },
      sendMessage: async (id, message) => bridge(id, message),
      onUpdated: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  };

  // A normal Chrome page may expose a partial browser-owned `window.chrome`
  // object without extension APIs. Feature-detect tabs.query above, then fill
  // only the missing showcase APIs instead of assuming the global is writable.
  if (globalThis.chrome) Object.assign(globalThis.chrome, showcaseChrome);
  else globalThis.chrome = showcaseChrome;

  document.documentElement.dataset.chatchatExtensionShowcase = "booted";
  window.addEventListener("load", () => {
    const badge = document.createElement("div");
    badge.textContent = "DETERMINISTIC 10-SEAT HOUSE SHOWCASE · NO REAL PROVIDER";
    badge.style.cssText =
      "position:fixed;z-index:999999;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#173b32;color:#fff;font:700 8px system-ui;letter-spacing:.05em;opacity:.88;pointer-events:none";
    document.body.appendChild(badge);
    void autoRun();
  });

  function seat(
    tabId,
    providerId,
    providerName,
    origin,
    delegationId,
    delegationName,
  ) {
    return {
      seatId: `extension:${providerId}:${tabId}`,
      tabId,
      url: `${origin}/`,
      origin,
      hostname: new URL(origin).hostname,
      providerId,
      providerName,
      delegationId,
      delegationName,
      startUrl: `${origin}/`,
      createdByChatChat: true,
    };
  }

  function recipe(profileId) {
    return {
      profileId,
      composerSelector: "#composer",
      sendSelector: "#send",
      responseSelector: "[data-message-author-role='assistant']",
      createdAt: now,
      updatedAt: now,
    };
  }

  function store(target) {
    return {
      get: async (key) => ({ [key]: target[key] }),
      set: async (values) => Object.assign(target, values),
      remove: async (key) => delete target[key],
    };
  }

  async function bridge(tabId, message) {
    if (!message?.__chatchat) return undefined;
    if (message.type === "PING") {
      const tab = tabs.get(tabId);
      return {
        ok: true,
        result: {
          url: tab?.url,
          origin: tab ? new URL(tab.url).origin : "",
          title: tab?.title,
          readyState: "complete",
        },
      };
    }
    if (message.type === "AWAIT_RECIPE") {
      return { ok: true, result: { ready: true, elapsedMs: 12 } };
    }
    if (message.type === "RUN_SPEECH") {
      if (String(message.prompt).includes("CHATCHAT_READY")) {
        return {
          ok: true,
          result: { responseText: "CHATCHAT_READY", elapsedMs: 120 },
        };
      }
      if (String(message.prompt).includes("stance is exactly READY")) {
        return {
          ok: true,
          result: {
            responseText:
              '<CHATCHAT_COUNCIL_JSON>{"contributions":[{"kind":"argument","stance":"READY","content":"Structured Council protocol ready.","confidence":1}]}</CHATCHAT_COUNCIL_JSON>',
            elapsedMs: 150,
          },
        };
      }
      return {
        ok: true,
        result: {
          responseText: councilResponse(String(message.prompt), tabId),
          elapsedMs: 360,
        },
      };
    }
    if (message.type === "PROBE") {
      return {
        ok: true,
        result: { inputs: 1, buttons: 3, assistantCandidates: 1 },
      };
    }
    return {
      ok: false,
      error: `Unsupported showcase message ${message.type}`,
    };
  }

  function councilResponse(prompt, tabId) {
    const phase = line(prompt, "PHASE:") || "sealed";
    const actorId = line(prompt, "YOUR_ACTOR_ID:");
    const publicEvents = jsonLine(prompt, "COUNCIL_EVENTS_JSON:") ?? [];
    const ownEvents = jsonLine(prompt, "YOUR_PRIOR_EVENTS_JSON:") ?? [];
    const initial = initialStance(tabId);
    const final = finalStance(tabId);
    let contributions;

    if (phase === "sealed") {
      contributions = [
        {
          kind: "argument",
          stance: initial,
          content: `${actorId} independently opens for ${initial}.`,
          confidence:
            initial === "Tauri" ? 0.76 : initial === "Electron" ? 0.66 : 0.46,
        },
      ];
    } else if (phase === "debate" && tabId === 102) {
      const previous = ownEvents.find((event) => event.kind === "argument");
      const cause =
        publicEvents.find(
          (event) =>
            event.actorId.includes("qwen") &&
            event.kind === "argument" &&
            event.stance === "Tauri",
        ) ??
        publicEvents.find(
          (event) =>
            event.actorId !== actorId &&
            event.kind === "argument" &&
            event.stance === "Tauri",
        );
      contributions = [
        {
          kind: "revision",
          previousEventId: previous?.id,
          stance: "Tauri",
          content:
            "I cross the aisle after another delegation made the local-first constraint more persuasive.",
          confidence: 0.78,
          causedBy: cause ? [cause.id] : [],
        },
      ];
    } else if (phase === "debate") {
      const target =
        publicEvents.find(
          (event) =>
            event.actorId !== actorId &&
            event.kind === "argument" &&
            event.stance !== initial,
        ) ??
        publicEvents.find(
          (event) => event.actorId !== actorId && event.kind === "argument",
        );
      contributions = target
        ? [
            {
              kind: "challenge",
              targetEventId: target.id,
              content: `I challenge the opposing ${target.stance} argument while keeping an independent seat.`,
            },
          ]
        : [
            {
              kind: "uncertain",
              content: "No opposing event is available yet.",
              confidence: 0.4,
            },
          ];
    } else {
      contributions = [
        {
          kind: "final_position",
          stance: final,
          content: `Final showcase vote: ${final}.`,
          confidence:
            final === "Tauri" ? 0.8 : final === "Electron" ? 0.68 : 0.45,
          caveats:
            final === "Tauri"
              ? ["Keep Provider compatibility as a release gate."]
              : final === "Electron"
                ? ["Revisit after more runtime evidence."]
                : ["Evidence remains insufficient for a decisive final vote."],
        },
      ];
    }

    return `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions })}</CHATCHAT_COUNCIL_JSON>`;
  }

  function initialStance(tabId) {
    if (tabId === 102 || tabId === 104 || tabId === 202 || tabId === 204) {
      return "Electron";
    }
    if (tabId === 205) return "Uncertain";
    return "Tauri";
  }

  function finalStance(tabId) {
    // GPT-02 explicitly crosses the aisle during debate.
    if (tabId === 104 || tabId === 202 || tabId === 204) return "Electron";
    if (tabId === 205) return "Uncertain";
    return "Tauri";
  }

  function line(prompt, prefix) {
    return (
      prompt
        .split("\n")
        .find((value) => value.startsWith(prefix))
        ?.slice(prefix.length)
        .trim() ?? ""
    );
  }

  function jsonLine(prompt, prefix) {
    const value = line(prompt, prefix);
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitEnabled(selector, index = 0, timeout = 12_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const elements = [...document.querySelectorAll(selector)];
      const element = elements[index];
      if (element && !element.disabled) return element;
      await sleep(80);
    }
    throw new Error(`Showcase could not find enabled ${selector} at ${index}`);
  }

  async function autoRun() {
    try {
      // Each button now verifies every tab in that delegation independently:
      // Test Speech + structured Council Gate per seat.
      const firstVerify = await waitEnabled(".teach-actions button:last-child", 0);
      firstVerify.click();
      await sleep(1200);
      const secondVerify = await waitEnabled(".teach-actions button:last-child", 1);
      secondVerify.click();
      await sleep(1500);
      const convene = await waitEnabled(".convene-button", 0);
      convene.click();
    } catch (error) {
      console.warn("ChatChat extension showcase auto-run failed", error);
    }
  }
})();
