(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const locale = params.get("lang") === "en" ? "en" : "zh-CN";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const LOCALE_KEY = "chatchat.locale.v1";

  const participantRows = [
    {
      seatId: "extension:openai-chatgpt:101",
      participantId: "extension:openai-chatgpt:101",
      tabId: 101,
      url: "https://chatgpt.com/",
      origin: "https://chatgpt.com",
      hostname: "chatgpt.com",
      providerId: "openai-chatgpt",
      providerName: "ChatGPT",
      startUrl: "https://chatgpt.com/",
      createdByChatChat: false,
    },
    {
      seatId: "extension:anthropic-claude:102",
      participantId: "extension:anthropic-claude:102",
      tabId: 102,
      url: "https://claude.ai/",
      origin: "https://claude.ai",
      hostname: "claude.ai",
      providerId: "anthropic-claude",
      providerName: "Claude",
      startUrl: "https://claude.ai/",
      createdByChatChat: false,
    },
    {
      seatId: "extension:google-gemini:103",
      participantId: "extension:google-gemini:103",
      tabId: 103,
      url: "https://gemini.google.com/app",
      origin: "https://gemini.google.com",
      hostname: "gemini.google.com",
      providerId: "google-gemini",
      providerName: "Gemini",
      startUrl: "https://gemini.google.com/app",
      createdByChatChat: false,
    },
  ];

  const recipes = Object.fromEntries(
    participantRows.map((participant) => [
      participant.origin,
      {
        profileId: participant.origin,
        composerSelector: "[data-chatchat-demo=composer]",
        sendSelector: "[data-chatchat-demo=send]",
        responseSelector: "[data-chatchat-demo=response]",
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    ]),
  );

  const memoryLocal = {
    [RECIPES_KEY]: recipes,
    [LOCALE_KEY]: locale,
  };
  const memorySession = {
    [PARTICIPANTS_KEY]: participantRows,
  };

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

  const tabs = new Map(participantRows.map((participant) => [
    participant.tabId,
    {
      id: participant.tabId,
      url: participant.url,
      title: `${participant.providerName} · demo`,
      active: participant.tabId === 101,
      status: "complete",
    },
  ]));

  const onUpdatedListeners = new Set();

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
    tabs: {
      async query(query) {
        const values = [...tabs.values()];
        if (query?.active) return values.filter((tab) => tab.active);
        return values;
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
        if (changes.url) {
          tab.url = changes.url;
          tab.status = "complete";
          queueMicrotask(() => {
            for (const listener of onUpdatedListeners) listener(tabId, { status: "complete" }, { ...tab });
          });
        }
        return { ...tab };
      },
      async create({ url, active }) {
        const id = 900 + tabs.size;
        const tab = { id, url, title: "AI · demo", active: Boolean(active), status: "complete" };
        if (active) for (const item of tabs.values()) item.active = false;
        tabs.set(id, tab);
        return { ...tab };
      },
      onUpdated: {
        addListener(listener) { onUpdatedListeners.add(listener); },
        removeListener(listener) { onUpdatedListeners.delete(listener); },
      },
      async sendMessage(tabId, payload) {
        if (!payload?.__chatchat) return { ok: false, error: "Not a ChatChat message" };
        if (payload.type === "PING") return { ok: true, result: { ready: true } };
        if (payload.type === "AWAIT_RECIPE") return { ok: true, result: { ready: true } };
        if (payload.type === "TEACH") {
          return {
            ok: true,
            result: {
              role: payload.role,
              selector: `[data-chatchat-demo=${payload.role}]`,
              capturedAt: new Date().toISOString(),
            },
          };
        }
        if (payload.type === "RUN_SPEECH") {
          return { ok: true, result: speechFor(tabId, String(payload.prompt ?? "")) };
        }
        return { ok: false, error: `Unsupported showcase bridge command: ${payload.type}` };
      },
    },
  };

  function speechFor(tabId, prompt) {
    if (/connection test/i.test(prompt)) {
      return { responseText: "CHATCHAT_READY", elapsedMs: 320, responseCount: 1 };
    }
    if (/Protocol handshake only/i.test(prompt)) {
      return structured([
        { kind: "argument", stance: "READY", content: "Structured consultation protocol accepted.", confidence: 0.99 },
      ]);
    }

    const phase = match(prompt, /PHASE:\s*(sealed|debate|final)/i)?.toLowerCase() ?? "sealed";
    const actorId = match(prompt, /YOUR_ACTOR_ID:\s*([^\n]+)/) ?? `actor-${tabId}`;
    const publicEvents = parseJsonField(prompt, "COUNCIL_EVENTS_JSON") ?? parseJsonField(prompt, "CONSULTATION_EVENTS_JSON") ?? [];
    const ownEvents = parseJsonField(prompt, "YOUR_PRIOR_EVENTS_JSON") ?? [];
    const peer = publicEvents.find((event) => event.actorId !== actorId) ?? publicEvents[0];
    const own = ownEvents.find((event) => event.actorId === actorId) ?? ownEvents[0];

    if (phase === "sealed") {
      if (tabId === 101) return structured([{ kind: "argument", stance: "Browser Extension", content: "The extension reaches users where their logged-in AI tabs already live, minimizing setup and preserving local control.", confidence: 0.78 }]);
      if (tabId === 102) return structured([{ kind: "argument", stance: "Web + Extension", content: "A public web experience improves discovery, while the extension can handle authenticated AI tabs. I would design both around one shared protocol.", confidence: 0.72 }]);
      return structured([{ kind: "argument", stance: "Browser Extension", content: "The extension is the strongest first product because optional per-site permissions and local browser sessions match the privacy story.", confidence: 0.81 }]);
    }

    if (phase === "debate") {
      if (tabId === 102 && own?.id && peer?.id) {
        return structured([{ kind: "revision", previousEventId: own.id, stance: "Browser Extension", content: "I revise toward Browser Extension first. The shared protocol can still power a later web demo, but authenticated tab coordination is the differentiator.", confidence: 0.83, causedBy: [peer.id] }]);
      }
      if (peer?.id) {
        return structured([{ kind: "challenge", targetEventId: peer.id, content: "What evidence supports this priority, and what failure mode would make the opposite sequencing better?" }]);
      }
      return structured([{ kind: "question", content: "Which assumption in the current proposal is least supported by evidence?" }]);
    }

    return structured([{
      kind: "final_position",
      stance: "Browser Extension",
      content: tabId === 102
        ? "Browser Extension first, with a lightweight public web demo later. The extension owns the unique logged-in multi-AI workflow."
        : "Prioritize the browser extension and make the web experience a frictionless demonstration layer rather than a second product core.",
      confidence: tabId === 103 ? 0.88 : 0.85,
      caveats: tabId === 102 ? ["A web demo still matters for sharing and onboarding."] : [],
    }]);
  }

  function structured(contributions) {
    return {
      responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions })}</CHATCHAT_COUNCIL_JSON>`,
      elapsedMs: 420,
      responseCount: 1,
    };
  }

  function match(text, expression) {
    const value = text.match(expression)?.[1];
    return value ? value.trim() : null;
  }

  function parseJsonField(text, label) {
    const prefix = `${label}: `;
    const line = text.split("\n").find((item) => item.startsWith(prefix));
    if (!line) return null;
    try { return JSON.parse(line.slice(prefix.length)); } catch { return null; }
  }

  async function driveShowcase() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const buttons = [...document.querySelectorAll(".verify-button")];
      if (buttons.length >= 3) {
        for (const button of buttons) {
          if (!button.classList.contains("is-ready")) {
            button.click();
            await delay(700);
          }
        }
        await delay(600);
        document.querySelector(".start-button")?.click();
        document.documentElement.dataset.chatchatConsultationShowcase = "running";
        await delay(2800);
        document.documentElement.dataset.chatchatConsultationShowcase = "complete";
        return;
      }
      await delay(100);
    }
    document.documentElement.dataset.chatchatConsultationShowcase = "failed";
  }

  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  window.addEventListener("DOMContentLoaded", () => void driveShowcase(), { once: true });
})();
