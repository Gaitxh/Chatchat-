(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("fairness-proof") !== "overfull") return;

  const tabs = window.chrome?.tabs;
  if (!tabs?.sendMessage) return;
  const originalSendMessage = tabs.sendMessage.bind(tabs);
  const FAIRNESS_MARKER = "MEMORY_FAIRNESS_OVERFULL_R2";

  // This fixture can only contribute ordinary structured Provider output. It
  // never writes the success marker or fairness DOM. Production orchestration,
  // context selection, Prompt construction, actual-Prompt observation and the
  // Fairness model must independently make the browser guard pass.
  tabs.sendMessage = async (tabId, payload, ...rest) => {
    const response = await originalSendMessage(tabId, payload, ...rest);
    if (!response?.ok || payload?.type !== "RUN_SPEECH" || !response.result?.responseText) return response;
    const prompt = String(payload.prompt ?? "");
    if (/\nREPAIR ATTEMPT:\s*/i.test(prompt)) return response;
    const phase = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "";
    const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
    if (phase !== "debate" || round !== 2) return response;

    const envelope = parseEnvelope(response.result.responseText);
    if (!envelope) return response;
    const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? `actor-${tabId}`;
    const stance = tabId === 101 ? "Browser Extension" : tabId === 102 ? "Web UI" : "Web + Extension";

    // The normal showcase already contributes one valid R2 event per seat.
    // Add five more so each equal seat contributes exactly six public events.
    // Blackboard publishes participant blocks in configured seat order, which
    // reproduces the historical publication-tail bias under the old slice(-12).
    for (let index = 1; index <= 5; index += 1) {
      envelope.contributions.push({
        kind: "argument",
        stance,
        content: `${FAIRNESS_MARKER}_${actorId}_${index}: equal-seat public point ${index}; publication order must not decide whether this actor remains represented next round.`,
        confidence: 0.62 + index * 0.01,
      });
    }
    return withEnvelope(response, envelope);
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
      return parsed && Array.isArray(parsed.contributions) ? parsed : null;
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
})();
