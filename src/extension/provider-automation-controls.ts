import { recordBrowserAuthorityAction } from "./browser-authority-store.js";
import { providerTabOwnership } from "./provider-tab-boundary.js";
import { setProviderAutomationProtected } from "./provider-automation-protection.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
let refreshQueued = false;

if (document.documentElement.dataset.surface === "web-app") {
  install();
}

function install() {
  chrome.storage?.onChanged?.addListener?.((changes: Record<string, unknown>) => {
    if (PARTICIPANTS_KEY in changes) scheduleRefresh();
  });
  new MutationObserver(scheduleRefresh).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["lang", "data-seat-id"],
  });
  window.addEventListener("chatchat:browser-authority-updated", scheduleRefresh);
  scheduleRefresh();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  window.requestAnimationFrame(() => {
    refreshQueued = false;
    void refresh();
  });
}

async function refresh() {
  const store = chrome.storage.session ?? chrome.storage.local;
  let stored: Record<string, unknown>;
  try {
    stored = await store.get(PARTICIPANTS_KEY);
  } catch {
    return;
  }
  const participants = Array.isArray(stored?.[PARTICIPANTS_KEY])
    ? stored[PARTICIPANTS_KEY] as Array<{
        seatId?: string;
        providerName?: string;
        createdByChatChat?: boolean;
        automationProtected?: boolean;
      }>
    : [];
  const bySeat = new Map(
    participants
      .filter((participant) => typeof participant?.seatId === "string")
      .map((participant) => [participant.seatId!, participant] as const),
  );
  const zh = document.documentElement.lang.toLocaleLowerCase().startsWith("zh");

  for (const row of document.querySelectorAll<HTMLElement>(".participant-row[data-seat-id]")) {
    const participant = row.dataset.seatId ? bySeat.get(row.dataset.seatId) : undefined;
    const actions = row.querySelector<HTMLElement>(".participant-row-actions");
    if (!actions) continue;
    const existing = actions.querySelector<HTMLButtonElement>(".automation-protection-toggle");
    if (!participant || participant.createdByChatChat !== true || !participant.seatId || !participant.providerName) {
      existing?.remove();
      continue;
    }

    const ownership = providerTabOwnership({
      seatId: participant.seatId,
      createdByChatChat: true,
      automationProtected: participant.automationProtected === true,
    });
    const protectedState = ownership === "protected";
    const button = existing ?? document.createElement("button");
    if (!existing) {
      button.type = "button";
      button.className = "automation-protection-toggle";
      actions.prepend(button);
    }
    button.dataset.automationProtection = protectedState ? "protected" : "managed";
    button.classList.toggle("is-protected", protectedState);
    button.textContent = protectedState
      ? (zh ? "允许自动化" : "Allow automation")
      : (zh ? "收回自动化" : "Protect");
    button.title = protectedState
      ? (zh
          ? "仅对这个 ChatChat 创建的标签页重新开放受限自动准备、登录恢复与一次性自愈。"
          : "Restore bounded automatic preparation, login resume, and one-shot self-healing for this ChatChat-created tab only.")
      : (zh
          ? "不关闭标签页、不删除席位；立即停止后台恢复、新会议自动导航和自愈导航。"
          : "Keep the tab and seat, but immediately stop background resume, fresh-session navigation, and self-heal navigation.");
    button.onclick = () => void toggleProtection(participant.seatId!, participant.providerName!, !protectedState, button);
  }
}

async function toggleProtection(
  seatId: string,
  providerName: string,
  nextProtected: boolean,
  button: HTMLButtonElement,
) {
  button.disabled = true;
  try {
    const result = await setProviderAutomationProtected(seatId, nextProtected);
    if (!result.changed && result.reason === "not_chatchat_created") return;
    if (result.changed) {
      await recordBrowserAuthorityAction({
        seatId,
        providerName,
        action: nextProtected ? "automation_protected" : "automation_restored",
        trigger: "explicit_user",
        reason: nextProtected ? "user_protection" : "user_restored_automation",
      });
    }
    document.documentElement.dataset.chatchatLastAutomationProtection = nextProtected ? "protected" : "managed";
    window.dispatchEvent(new CustomEvent("chatchat:browser-authority-updated"));
  } finally {
    button.disabled = false;
    scheduleRefresh();
  }
}
