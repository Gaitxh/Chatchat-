(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "invite-ai" || params.get("authority-proof") !== "revocable") return;

  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const RECEIPTS_KEY = "chatchat.browser-authority.receipts.v1";
  let started = false;

  const maybeStart = () => {
    if (started) return;
    if (document.documentElement.dataset.chatchatInviteAiShowcase !== "complete") return;
    started = true;
    void run().catch((error) => {
      document.documentElement.dataset.chatchatRevocableAuthorityShowcase = "failed";
      document.documentElement.dataset.chatchatRevocableAuthorityError = String(error?.message ?? error).slice(0, 180);
    });
  };

  if (!maybeStart()) {
    const observer = new MutationObserver(() => {
      maybeStart();
      if (started) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  async function run() {
    const initial = await currentCustomParticipant();
    if (!initial) throw new Error("Invited custom Provider seat is missing.");
    const row = await waitFor(() => rowForSeat(initial.seatId));
    const protect = await waitFor(() => row.querySelector('.automation-protection-toggle[data-automation-protection="managed"]'));
    protect.click();

    await waitFor(async () => {
      const participant = await participantBySeat(initial.seatId);
      const summary = document.querySelector('[data-browser-authority-summary="ready"]');
      return participant?.automationProtected === true
        && row.getAttribute("data-tab-ownership") === "protected"
        && summary?.getAttribute("data-browser-authority-managed") === "1"
        && summary?.getAttribute("data-browser-authority-protected") === "1"
        ? true
        : null;
    });
    document.documentElement.dataset.chatchatRevocableProtectState = "protected";

    const blockedBefore = Number(document.documentElement.dataset.chatchatAuthorityBlockedAutomaticRetries ?? "0");
    window.dispatchEvent(new CustomEvent("chatchat:connection-retry-requested", {
      detail: { seatId: initial.seatId, reason: "provider-tab-loaded" },
    }));
    await waitFor(() => {
      const blocked = Number(document.documentElement.dataset.chatchatAuthorityBlockedAutomaticRetries ?? "0");
      return blocked > blockedBefore ? blocked : null;
    });
    document.documentElement.dataset.chatchatRevocableBackgroundRetry = "blocked";

    const claim = await chrome.runtime.sendMessage({
      type: "CLAIM_PROVIDER_SELF_HEALING",
      seatId: initial.seatId,
      tabId: initial.tabId,
    });
    if (claim?.claimed !== false) throw new Error("Protected seat unexpectedly retained self-heal claim authority.");
    document.documentElement.dataset.chatchatRevocableSelfHealClaim = "denied";

    const textarea = await waitFor(() => document.querySelector(".proposal-card textarea"));
    setNativeValue(textarea, "Verify that a protected AI seat remains usable without background navigation authority.");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    const start = await waitFor(() => {
      const button = document.querySelector(".start-button");
      return button && !button.disabled ? button : null;
    });
    start.click();

    await waitFor(() => {
      const counts = navigationCounts();
      return Number(counts["701"] ?? 0) >= 1 ? counts : null;
    });
    // Let the first sealed preparation settle while protection remains active.
    await delay(1_400);
    const countsBeforeRestore = navigationCounts();
    const protectedNavigationCount = Number(countsBeforeRestore[String(initial.tabId)] ?? 0);
    const managedNavigationCount = Number(countsBeforeRestore["701"] ?? 0);
    if (protectedNavigationCount !== 0) {
      throw new Error(`Protected custom seat was automatically navigated ${protectedNavigationCount} time(s).`);
    }
    if (managedNavigationCount < 1) throw new Error("Managed comparison seat never performed fresh-session navigation.");
    document.documentElement.dataset.chatchatRevocableProtectedNavigationCount = String(protectedNavigationCount);
    document.documentElement.dataset.chatchatRevocableManagedNavigationCount = String(managedNavigationCount);

    const allow = await waitFor(() => row.querySelector('.automation-protection-toggle[data-automation-protection="protected"]'));
    allow.click();
    await waitFor(async () => {
      const participant = await participantBySeat(initial.seatId);
      const summary = document.querySelector('[data-browser-authority-summary="ready"]');
      return participant?.automationProtected === false
        && row.getAttribute("data-tab-ownership") === "managed"
        && summary?.getAttribute("data-browser-authority-managed") === "2"
        && summary?.getAttribute("data-browser-authority-protected") === "0"
        ? true
        : null;
    });

    const receipts = await waitFor(async () => {
      const stored = await chrome.storage.session.get(RECEIPTS_KEY);
      const list = stored?.[RECEIPTS_KEY];
      if (!Array.isArray(list)) return null;
      const protectedReceipt = list.some((receipt) => receipt?.seatId === initial.seatId && receipt?.action === "automation_protected" && receipt?.trigger === "explicit_user");
      const restoredReceipt = list.some((receipt) => receipt?.seatId === initial.seatId && receipt?.action === "automation_restored" && receipt?.trigger === "explicit_user");
      return protectedReceipt && restoredReceipt ? list : null;
    });
    document.documentElement.dataset.chatchatRevocableProtectReceipt = receipts.some((receipt) => receipt.action === "automation_protected") ? "complete" : "missing";
    document.documentElement.dataset.chatchatRevocableRestoreReceipt = receipts.some((receipt) => receipt.action === "automation_restored") ? "complete" : "missing";
    document.documentElement.dataset.chatchatRevocableFinalState = "managed";
    document.documentElement.dataset.chatchatRevocableAuthorityShowcase = "complete";
  }

  async function currentCustomParticipant() {
    const stored = await chrome.storage.session.get(PARTICIPANTS_KEY);
    return (stored?.[PARTICIPANTS_KEY] ?? []).find((participant) => participant?.providerId === "custom") ?? null;
  }

  async function participantBySeat(seatId) {
    const stored = await chrome.storage.session.get(PARTICIPANTS_KEY);
    return (stored?.[PARTICIPANTS_KEY] ?? []).find((participant) => participant?.seatId === seatId) ?? null;
  }

  function rowForSeat(seatId) {
    return [...document.querySelectorAll(".participant-row[data-seat-id]")]
      .find((candidate) => candidate.getAttribute("data-seat-id") === seatId) ?? null;
  }

  function navigationCounts() {
    try {
      return JSON.parse(document.documentElement.dataset.chatchatInviteAiNavigationCounts ?? "{}");
    } catch {
      return {};
    }
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    descriptor?.set?.call(element, value);
  }

  async function waitFor(find, timeoutMs = 18_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = await find();
      if (value) return value;
      await delay(50);
    }
    throw new Error("Revocable authority proof timed out waiting for the expected state.");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();