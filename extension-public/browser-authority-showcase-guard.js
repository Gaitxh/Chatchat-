(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || params.get("authority-proof") !== "protected") return;

  const seatId = "extension:openai-chatgpt:101";
  let dispatched = false;
  const inspect = () => {
    const summary = document.querySelector('[data-browser-authority-summary="ready"]');
    if (!summary) return false;
    if (summary.getAttribute("data-browser-authority-protected") !== "3") return false;
    if (summary.getAttribute("data-browser-authority-managed") !== "0") return false;

    if (!dispatched) {
      dispatched = true;
      window.dispatchEvent(new CustomEvent("chatchat:connection-retry-requested", {
        detail: { seatId, reason: "provider-tab-loaded" },
      }));
      setTimeout(inspect, 60);
      return false;
    }

    const blocked = Number(document.documentElement.dataset.chatchatAuthorityBlockedAutomaticRetries ?? "0");
    if (blocked < 1) return false;
    document.documentElement.dataset.chatchatBrowserAuthorityProtectedProof = "complete";
    return true;
  };

  if (inspect()) return;
  const observer = new MutationObserver(() => {
    if (!inspect()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
})();
