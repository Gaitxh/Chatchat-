(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "login-resume") return;

  const journey = params.get("journey") === "login" ? "login" : "auto";
  const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
  let sawLogin = false;
  let sawRecovering = false;
  let checkingReady = false;

  function inspectDom() {
    const root = document.documentElement;
    if (document.querySelector('[data-connection-experience="login_required"]')) {
      sawLogin = true;
      root.dataset.chatchatLoginRequiredShowcase = "complete";
    }
    if (document.querySelector('[data-connection-experience="recovering"]')) {
      sawRecovering = true;
      root.dataset.chatchatLoginRecoveringShowcase = "complete";
    }
    if (journey === "auto" && sawLogin && sawRecovering && !checkingReady) void checkReady();
  }

  async function checkReady() {
    checkingReady = true;
    try {
      const store = window.chrome?.storage?.session ?? window.chrome?.storage?.local;
      const value = await store?.get(CONNECTIONS_KEY);
      const connections = value?.[CONNECTIONS_KEY];
      const rows = connections && typeof connections === "object" ? Object.values(connections) : [];
      const allReady = rows.length >= 2 && rows.every((row) => row?.state === "ready");
      const assistantGone = !document.querySelector(".connection-assistant");
      if (allReady && assistantGone) {
        document.documentElement.dataset.chatchatLoginResumeShowcase = "complete";
        observer.disconnect();
        window.clearInterval(poll);
        return;
      }
    } catch {
      // Keep observing; the product UI remains the source of truth.
    }
    checkingReady = false;
  }

  const observer = new MutationObserver(inspectDom);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  const poll = window.setInterval(() => {
    inspectDom();
    if (journey === "auto" && sawLogin && sawRecovering) void checkReady();
  }, 120);
  window.addEventListener("DOMContentLoaded", inspectDom, { once: true });
  inspectDom();
})();
