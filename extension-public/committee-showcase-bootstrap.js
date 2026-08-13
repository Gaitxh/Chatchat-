(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "committee") return;

  // Reuse the mature deterministic 10-seat House bootstrap, then preselect the
  // public Committee Parliament preference before module scripts hydrate.
  history.replaceState(null, "", `${location.pathname}?showcase=1&committee=1`);

  queueMicrotask(() => {
    const key = "chatchat.extension.parliament-mode.v1";
    const storage = globalThis.chrome?.storage?.local;
    if (!storage?.set) return;
    void storage.set({ [key]: "committee" });
    document.documentElement.dataset.chatchatCommitteeShowcase = "booted";
  });
})();
