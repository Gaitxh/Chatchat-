export {};

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const AUDIT_ROOT_IDS = [
  "browser-authority-root",
  "execution-provenance-root",
  "provider-memory-root",
  "meeting-integrity-root",
  "relationship-summary-root",
  "conflict-board-root",
  "evidence-root",
  "source-observation-root",
  "investigation-trail-root",
  "consultation-history-root",
] as const;
const PUBLIC_STAGE_ROOT_IDS = [
  "extension-root",
  "consultation-theater-root",
  "council-verdict-root",
  "final-position-floor-root",
  "consultation-receipt-root",
] as const;

let scheduled = false;
let userToggledAudit = false;

install();

function install() {
  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["lang", "data-seat-id"],
  });

  for (const eventName of [
    "chatchat:consultation-live",
    "chatchat:consultation-complete",
    "chatchat:consultation-open-archive",
    "chatchat:automatic-team-assembled",
  ]) {
    window.addEventListener(eventName, () => scheduleRefresh());
  }

  scheduleRefresh();
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    void refreshHierarchy();
  });
}

async function refreshHierarchy() {
  const app = document.querySelector(".consultation-app");
  const vault = document.getElementById("chatchat-audit-vault");
  const vaultBody = document.querySelector("#chatchat-audit-vault .chatchat-audit-vault-body");
  if (!(app instanceof HTMLElement) || !(vault instanceof HTMLDetailsElement) || !(vaultBody instanceof HTMLElement)) return;

  document.documentElement.dataset.chatchatStageHierarchy = "council-first";
  for (const rootId of PUBLIC_STAGE_ROOT_IDS) {
    const root = document.getElementById(rootId);
    if (root instanceof HTMLElement) root.dataset.chatchatVisualLayer = "stage";
  }

  if (vault.parentElement !== app) app.append(vault);
  for (const rootId of AUDIT_ROOT_IDS) {
    const root = document.getElementById(rootId);
    if (!(root instanceof HTMLElement)) continue;
    root.dataset.chatchatVisualLayer = "audit";
    if (root.parentElement !== vaultBody) vaultBody.append(root);
  }

  const proofOpen = auditProofNeedsVisiblePanels();
  if (proofOpen) vault.open = true;
  else if (!userToggledAudit) vault.open = false;
  vault.dataset.chatchatAuditVault = vault.open ? "open" : "closed";
  localizeAuditSummary(vault);
  installAuditToggleReceipt(vault, proofOpen);
  await decorateProviderOwnership();
}

function installAuditToggleReceipt(vault: HTMLDetailsElement, proofOpen: boolean) {
  if (vault.dataset.chatchatToggleWired === "true") return;
  vault.dataset.chatchatToggleWired = "true";
  vault.addEventListener("toggle", () => {
    if (!proofOpen) userToggledAudit = true;
    vault.dataset.chatchatAuditVault = vault.open ? "open" : "closed";
    localizeAuditSummary(vault);
  });
}

function auditProofNeedsVisiblePanels(): boolean {
  const params = new URLSearchParams(location.search);
  return params.get("audit") === "open"
    || params.has("memory-proof")
    || params.has("payload-proof");
}

function localizeAuditSummary(vault: HTMLDetailsElement) {
  const zh = document.documentElement.lang.toLocaleLowerCase().startsWith("zh");
  setText(vault.querySelector<HTMLElement>("[data-audit-title]"), zh ? "审计与证据" : "Audit & evidence");
  setText(
    vault.querySelector<HTMLElement>("[data-audit-body]"),
    zh
      ? "默认收起协议、内存、执行与历史细节。需要核查时再展开；不会改变会议结果。"
      : "Protocol, memory, execution and history details stay quiet by default. Open them when you want to audit the meeting.",
  );
  setText(
    vault.querySelector<HTMLElement>("[data-audit-action]"),
    zh ? (vault.open ? "收起" : "展开审计") : (vault.open ? "Close" : "Open audit"),
  );
}

async function decorateProviderOwnership() {
  const store = chrome?.storage?.session ?? chrome?.storage?.local;
  if (!store?.get) return;
  let stored: Record<string, unknown>;
  try {
    stored = await store.get(PARTICIPANTS_KEY);
  } catch {
    return;
  }
  const participants = Array.isArray(stored?.[PARTICIPANTS_KEY])
    ? (stored[PARTICIPANTS_KEY] as Array<{ seatId?: string; createdByChatChat?: boolean }>)
    : [];
  const ownership = new Map(
    participants
      .filter((participant) => typeof participant?.seatId === "string")
      .map((participant) => [participant.seatId!, participant.createdByChatChat === true]),
  );
  const zh = document.documentElement.lang.toLocaleLowerCase().startsWith("zh");

  for (const row of document.querySelectorAll<HTMLElement>(".participant-row[data-seat-id]")) {
    const seatId = row.dataset.seatId;
    if (!seatId || !ownership.has(seatId)) continue;
    const managed = ownership.get(seatId) === true;
    row.dataset.tabOwnership = managed ? "managed" : "user-owned";
    const titleLine = row.querySelector<HTMLElement>(".participant-title-line");
    if (!titleLine) continue;
    let chip = titleLine.querySelector<HTMLElement>(".automation-boundary-chip");
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "automation-boundary-chip";
      titleLine.append(chip);
    }
    chip.classList.toggle("is-managed", managed);
    chip.classList.toggle("is-user-owned", !managed);
    setText(chip, managed ? (zh ? "托管席位" : "Managed") : (zh ? "你的标签页" : "Your tab"));
    const title = managed
      ? (zh ? "ChatChat 创建的干净标签页：允许自动准备与一次性恢复。" : "ChatChat-created clean tab: automatic preparation and bounded recovery are allowed.")
      : (zh ? "用户自己的标签页：ChatChat 不会在后台自动导航或重置。" : "Your existing tab: ChatChat will not navigate or reset it in the background.");
    if (chip.title !== title) chip.title = title;
  }
}

function setText(element: HTMLElement | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}
