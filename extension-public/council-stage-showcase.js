(() => {
  const params = new URLSearchParams(location.search);
  const proofNeedsAudit = params.get("showcase") === "consultation"
    || params.has("memory-proof")
    || params.has("payload-proof")
    || params.get("audit-proof") === "open";

  document.addEventListener("DOMContentLoaded", () => {
    const drawer = document.getElementById("council-audit-drawer");
    if (!(drawer instanceof HTMLDetailsElement)) return;
    if (proofNeedsAudit) drawer.open = true;
    document.documentElement.dataset.chatchatAuditDrawer = proofNeedsAudit ? "proof-open" : "collapsed";
  }, { once: true });
})();
