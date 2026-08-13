(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "committee") return;

  // This marker is test-only evidence that the deterministic Committee
  // showcase entry point was selected. Product assertions below still verify
  // the actual rendered Parliament mode, committee labels and House verdict.
  document.documentElement.dataset.chatchatCommitteeShowcase = "booted";

  // Rewrite early so the existing deterministic 10-seat House bootstrap runs.
  history.replaceState(null, "", `${location.pathname}?showcase=1&committee=1`);

  // Classic head scripts execute before this timer, so showcase-bootstrap.js
  // has installed the fake Chromium APIs by the time we persist the preference.
  setTimeout(() => {
    const key = "chatchat.extension.parliament-mode.v1";
    const storage = globalThis.chrome?.storage?.local;
    if (!storage?.set) return;
    void storage.set({ [key]: "committee" });
  }, 0);
})();
