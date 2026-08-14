(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation") return;

  const tabs = window.chrome?.tabs;
  if (!tabs?.sendMessage) return;
  const originalSendMessage = tabs.sendMessage.bind(tabs);

  tabs.sendMessage = async (tabId, payload) => {
    const response = await originalSendMessage(tabId, payload);
    if (!response?.ok || payload?.type !== "RUN_SPEECH" || !response.result?.responseText) return response;

    const prompt = String(payload.prompt ?? "");
    if (!/PHASE:\s*debate/i.test(prompt)) return response;
    const round = Number(match(prompt, /ROUND:\s*(\d+)/i) ?? "0");
    if (!round) return response;

    const envelope = parseEnvelope(response.result.responseText);
    if (!envelope) return response;

    if (round === 2 && tabId === 102) {
      envelope.contributions.push({
        kind: "question",
        targetActorId: "extension:openai-chatgpt:101",
        content: "If the extension becomes invisible, how should the Web Room recover when ChatGPT needs the user to log in again?",
      });
      return withEnvelope(response, envelope);
    }

    if (round >= 3 && tabId === 101) {
      const publicEvents = parseJsonField(prompt, "CONSULTATION_EVENTS_JSON") ?? [];
      const directQuestion = [...publicEvents].reverse().find((event) =>
        event.kind === "question"
        && event.targetActorId === "extension:openai-chatgpt:101"
        && /anthropic-claude/.test(event.actorId),
      );
      if (!directQuestion?.id) return response;

      // Yield across two paint opportunities. This lets the real React surface
      // commit the explicit "responding" lifecycle without timer or MessageChannel
      // tasks that can stall Chromium's --virtual-time-budget test mode.
      await nextPaint();
      await nextPaint();
      envelope.contributions.push({
        kind: "argument",
        stance: "Web + Extension",
        content: "The Web Room should surface only the recovery moment: open the provider login, detect readiness, and automatically resume the same consultation. The extension remains plumbing rather than a settings workflow.",
        confidence: 0.87,
        replyToEventId: directQuestion.id,
      });
      return withEnvelope(response, envelope);
    }

    return response;
  };

  function parseEnvelope(raw) {
    const text = String(raw).trim();
    const open = "<CHATCHAT_COUNCIL_JSON>";
    const close = "</CHATCHAT_COUNCIL_JSON>";
    const start = text.indexOf(open);
    const end = text.indexOf(close);
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start + open.length, end).trim());
      if (!parsed || !Array.isArray(parsed.contributions)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function withEnvelope(response, envelope) {
    return {
      ...response,
      result: {
        ...response.result,
        responseText: `<CHATCHAT_COUNCIL_JSON>${JSON.stringify(envelope)}</CHATCHAT_COUNCIL_JSON>`,
      },
    };
  }

  function parseJsonField(prompt, field) {
    const prefix = `${field}: `;
    const line = prompt.split("\n").find((item) => item.startsWith(prefix));
    if (!line) return null;
    try { return JSON.parse(line.slice(prefix.length)); } catch { return null; }
  }

  function match(value, pattern) {
    return value.match(pattern)?.[1] ?? null;
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
})();
