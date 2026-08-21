import { participantRowMap } from "./participant-row-identity.js";
import { providerTabOwnership } from "./provider-tab-boundary.js";

declare const chrome: any;

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const OWNERSHIP_BADGE = "provider-tab-ownership-badge";

interface OwnershipParticipant {
  seatId: string;
  hostname?: string;
  origin?: string;
  providerName?: string;
  createdByChatChat?: boolean;
}

let participants: OwnershipParticipant[] = [];
let syncing = false;
let scheduled = false;

void refreshParticipants();

const observer = new MutationObserver(() => scheduleDecorate());
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["lang"],
});

chrome.storage?.onChanged?.addListener((changes: Record<string, unknown>, areaName: string) => {
  if (areaName !== "session" && areaName !== "local") return;
  if (!Object.prototype.hasOwnProperty.call(changes, PARTICIPANTS_KEY)) return;
  void refreshParticipants();
});

async function refreshParticipants() {
  if (syncing) return;
  syncing = true;
  try {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get(PARTICIPANTS_KEY);
    participants = Array.isArray(stored?.[PARTICIPANTS_KEY])
      ? (stored[PARTICIPANTS_KEY] as OwnershipParticipant[])
      : [];
    decorate();
  } finally {
    syncing = false;
  }
}

function scheduleDecorate() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    decorate();
  });
}

function decorate() {
  if (!participants.length) return;
  const rows = participantRowMap(participants);
  const zh = document.documentElement.lang.toLocaleLowerCase().startsWith("zh");

  for (const participant of participants) {
    const row = rows.get(participant.seatId);
    const titleLine = row?.querySelector<HTMLElement>(".participant-title-line");
    if (!row || !titleLine) continue;

    const ownership = providerTabOwnership(participant);
    row.dataset.providerTabOwnership = ownership;

    let badge = titleLine.querySelector<HTMLElement>(`[data-${OWNERSHIP_BADGE}]`);
    if (!badge) {
      badge = document.createElement("span");
      badge.dataset[camelDataName(OWNERSHIP_BADGE)] = "true";
      titleLine.append(badge);
    }

    const className = `provider-tab-ownership-badge ownership-${ownership}`;
    const label = ownership === "managed"
      ? (zh ? "托管标签页" : "Managed tab")
      : (zh ? "你的标签页" : "Your tab");
    const title = ownership === "managed"
      ? (zh
        ? "这是 ChatChat 创建的干净 AI 标签页；ChatChat 只会在受限自动连接/恢复流程中导航它。"
        : "This clean AI tab was created by ChatChat; bounded automatic connection/recovery may navigate it.")
      : (zh
        ? "这是你的标签页；ChatChat 不会在后台自动导航或恢复它。"
        : "This is your tab; ChatChat will not automatically navigate or resume it in the background.");

    if (badge.className !== className) badge.className = className;
    if (badge.textContent !== label) badge.textContent = label;
    if (badge.title !== title) badge.title = title;
  }
}

function camelDataName(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
