(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("payload-proof") !== "repair") return;

  const tabs = window.chrome?.tabs;
  if (!tabs?.sendMessage) return;
  const originalSendMessage = tabs.sendMessage.bind(tabs);
  let corrupted = false;

  // Test fixture only: corrupt one first-attempt Provider response so the real
  // BrowserConsultationAgent must execute its existing repair path. We do not
  // modify the outgoing Prompt, snapshot, memory metadata or the repair Prompt.
  // The production payload-integrity model must prove both attempts carried the
  // same serialized public meeting deck.
  tabs.sendMessage = async (tabId, payload, ...rest) => {
    const response = await originalSendMessage(tabId, payload, ...rest);
    if (
      corrupted
      || tabId !== 101
      || payload?.type !== "RUN_SPEECH"
      || !response?.ok
      || typeof response.result?.responseText !== "string"
    ) return response;

    const prompt = String(payload.prompt ?? "");
    const phase = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase();
    const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
    const repairAttempt = /\nREPAIR ATTEMPT:\s*/i.test(prompt);
    if (phase !== "debate" || round !== 2 || repairAttempt) return response;

    corrupted = true;
    return {
      ...response,
      result: {
        ...response.result,
        // Valid transport, invalid structured consultation response. This must
        // trigger the real parser → repair_requested → second RUN_SPEECH path.
        responseText: "<CHATCHAT_COUNCIL_JSON>{\"contributions\":[{\"kind\":\"challenge\"}]}</CHATCHAT_COUNCIL_JSON>",
      },
    };
  };
})();
