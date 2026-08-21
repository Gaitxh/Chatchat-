(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "invite-ai") return;

  const zh = params.get("lang") === "zh";
  const custom = params.get("target") === "custom";
  const TARGET_URL = custom ? "https://council-lab.example/" : "https://claude.ai/";
  const TARGET_HOST = custom ? "council-lab.example" : "claude.ai";
  const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
  const RECIPES_KEY = "chatchat.extension.recipes.v1";

  document.documentElement.dataset.chatchatInviteAiTarget = custom ? "custom" : "known";
  void verify();

  async function verify() {
    const entry = await waitFor(() => {
      const candidate = document.querySelector('.participants-card > .url-opener[data-chatchat-invite-ai="true"]');
      return candidate instanceof HTMLElement && isVisible(candidate) ? candidate : null;
    });
    if (!entry) return fail("Invite AI entry never became visible.");

    const label = entry.querySelector("label")?.textContent?.trim() ?? "";
    const input = entry.querySelector("input");
    const button = entry.querySelector("button");
    const expectedLabel = zh ? "＋ 邀请 AI" : "+ Invite AI";
    const expectedAction = zh ? "邀请入席" : "Invite";
    const expectedPlaceholder = zh ? "粘贴任意 AI 网站 URL" : "Paste any AI website URL";
    if (label !== expectedLabel) return fail(`Unexpected Invite AI label: ${label}`);
    if (!(input instanceof HTMLInputElement)) return fail("Invite AI input is missing.");
    if (!(button instanceof HTMLButtonElement)) return fail("Invite AI action is missing.");
    if (input.placeholder !== expectedPlaceholder) return fail(`Unexpected Invite AI placeholder: ${input.placeholder}`);
    if (button.textContent?.trim() !== expectedAction) return fail(`Unexpected Invite AI action: ${button.textContent}`);

    for (const selector of [
      ".participants-card > .participant-actions",
      ".participants-card > .discovered-section",
      ".quick-open",
    ]) {
      const control = document.querySelector(selector);
      if (control instanceof HTMLElement && isVisible(control)) {
        return fail(`Advanced team plumbing leaked into the novice Invite AI surface: ${selector}`);
      }
    }

    setReactInputValue(input, TARGET_URL);
    await waitFor(() => input.value === TARGET_URL && !button.disabled ? button : null, 4_000);
    button.click();
    document.documentElement.dataset.chatchatInviteAiClicked = "true";

    const readyRow = await waitFor(() => {
      const rows = [...document.querySelectorAll(".participant-row")];
      return rows.find((row) => {
        const host = row.querySelector(".participant-main > small")?.textContent?.trim();
        return host === TARGET_HOST
          && row.classList.contains("connection-ready")
          && row.classList.contains("is-ready");
      }) ?? null;
    }, 18_000);
    if (!(readyRow instanceof HTMLElement)) return fail(`Invited ${TARGET_HOST} seat never reached READY.`);

    const sessionStore = window.chrome.storage.session ?? window.chrome.storage.local;
    const stored = await sessionStore.get(PARTICIPANTS_KEY);
    const participants = Array.isArray(stored?.[PARTICIPANTS_KEY]) ? stored[PARTICIPANTS_KEY] : [];
    const invited = participants.find((participant) => participant?.hostname === TARGET_HOST);
    if (!invited?.createdByChatChat) return fail("Invited AI did not become a ChatChat-owned clean consultation seat.");
    if (document.documentElement.dataset.chatchatInviteAiCreatedCount !== "1") {
      return fail(`Invite AI should open exactly one Provider tab; saw ${document.documentElement.dataset.chatchatInviteAiCreatedCount ?? "0"}.`);
    }
    if (!isVisible(entry)) return fail("Invite AI entry disappeared after a successful invitation.");

    if (custom) {
      if (invited.providerId !== "custom") return fail(`Unknown URL should use custom provider identity; got ${String(invited.providerId)}.`);
      const expectedOrigin = new URL(TARGET_URL).origin;
      if (invited.origin !== expectedOrigin) return fail(`Unexpected custom origin: ${String(invited.origin)}.`);
      if (document.documentElement.dataset.chatchatInviteAiAutoSetupCount !== "1") {
        return fail(`Custom URL must run AUTO_SETUP exactly once; saw ${document.documentElement.dataset.chatchatInviteAiAutoSetupCount ?? "0"}.`);
      }
      if (document.documentElement.dataset.chatchatInviteAiAutoSetupProfile !== expectedOrigin) {
        return fail(`AUTO_SETUP profile must be the custom origin; got ${document.documentElement.dataset.chatchatInviteAiAutoSetupProfile ?? "missing"}.`);
      }
      const local = await window.chrome.storage.local.get(RECIPES_KEY);
      const recipe = local?.[RECIPES_KEY]?.[expectedOrigin];
      if (!recipe?.composerSelector || !recipe?.sendSelector || !recipe?.responseSelector) {
        return fail("Custom URL AUTO_SETUP did not persist a complete browser recipe.");
      }
      document.documentElement.dataset.chatchatInviteAiCustomRecipe = "complete";
    }

    document.documentElement.dataset.chatchatInviteAiProviderId = String(invited.providerId ?? "unknown");
    document.documentElement.dataset.chatchatInviteAiReadySeat = String(invited.seatId ?? "ready");
    document.documentElement.dataset.chatchatInviteAiShowcase = "complete";
  }

  async function waitFor(read, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = read();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0.01
      && rect.width > 2
      && rect.height > 2;
  }

  function fail(message) {
    document.documentElement.dataset.chatchatInviteAiShowcase = "failed";
    document.documentElement.dataset.chatchatInviteAiDebug = message;
    console.error(`Invite AI showcase failed: ${message}`);
  }
})();