(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "consultation" || !window.chrome?.storage) return;

  const PENDING_KEY = "chatchat.investigation.pending.v1";
  const area = window.chrome.storage.session ?? window.chrome.storage.local;
  const stagedAt = new Date().toISOString();

  const pending = {
    parentSessionId: "showcase-parent-session",
    parentProposalPreview: "Should ChatChat remain a compact Side Panel only, or grow into a full browser consultation room?",
    parentOutcome: "Web + Extension",
    parentMode: "explore",
    moveId: "next:showcase:stress-test-evidence-revision",
    moveKind: "retest_revision",
    modeHint: "stress_test",
    labelEn: "Stress-test the evidence-driven revision",
    labelZhCN: "复核这次由证据触发的改口",
    stagedProposalPreview: "Re-check whether the cited browser-permission evidence really supports extension-first as the product core.",
    stagedAt,
  };

  void area.set({ [PENDING_KEY]: pending });
})();
