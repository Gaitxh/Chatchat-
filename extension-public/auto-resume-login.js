(() => {
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  const RETRY_EVENT = "chatchat:connection-retry-requested";
  const lastRetry = new Map();

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "complete" && !changeInfo.url) return;
    setTimeout(() => void requestRetry(tabId), 1000);
  });

  async function requestRetry(tabId) {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get([PARTICIPANTS_KEY, CONNECTIONS_KEY]);
    const participants = Array.isArray(stored[PARTICIPANTS_KEY])
      ? stored[PARTICIPANTS_KEY]
      : [];
    const participant = participants.find((item) => item?.tabId === tabId);
    if (!participant?.seatId) return;

    const connections = stored[CONNECTIONS_KEY] ?? {};
    const state = connections[participant.seatId]?.state;
    if (state === "ready" || state === "connecting") return;

    const previous = lastRetry.get(participant.seatId) ?? 0;
    if (Date.now() - previous < 8000) return;
    lastRetry.set(participant.seatId, Date.now());

    window.dispatchEvent(new CustomEvent(RETRY_EVENT, {
      detail: {
        seatId: participant.seatId,
        reason: "provider-tab-loaded",
      },
    }));
  }
})();
