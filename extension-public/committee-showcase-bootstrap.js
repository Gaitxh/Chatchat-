(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "committee") return;

  // Rewrite early so the existing deterministic 10-seat House bootstrap runs.
  history.replaceState(null, "", `${location.pathname}?showcase=1&committee=1`);

  // Classic head scripts execute before this timer, so showcase-bootstrap.js
  // has installed the fake Chromium APIs by the time we set the preference.
  setTimeout(() => {
    const key = "chatchat.extension.parliament-mode.v1";
    const storage = globalThis.chrome?.storage?.local;
    if (!storage?.set) return;
    void storage.set({ [key]: "committee" });
    document.documentElement.dataset.chatchatCommitteeShowcase = "booted";
  }, 0);
})();
