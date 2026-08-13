import { CouncilOrchestrator } from "../core/orchestrator.js";
import type { CouncilParticipant } from "../core/types.js";
import {
  assignHouseCommittees,
  committeeComposition,
  recommendedCommitteeIds,
  type CommitteePlan,
} from "../house/committees.js";
import { insertCommitteePromptBlock } from "../house/committee-prompt.js";

declare const chrome: any;

const SEATS_KEY = "chatchat.extension.seats.v1";
const MODE_KEY = "chatchat.extension.parliament-mode.v1";
const PATCH_MARKER = "__CHATCHAT_COMMITTEE_PARLIAMENT_V1__";
const PANEL_ID = "chatchat-committee-parliament";
const STYLE_ID = "chatchat-committee-parliament-style";
const FORCE_COMMITTEE_SHOWCASE =
  new URLSearchParams(location.search).get("committee") === "1";

type ParliamentMode = "free" | "committee";

interface StoredSeat {
  seatId: string;
  tabId: number;
  providerId: string;
  providerName: string;
  delegationId: string;
  delegationName: string;
}

const runtime = globalThis as typeof globalThis & Record<string, unknown>;
let mode: ParliamentMode = FORCE_COMMITTEE_SHOWCASE ? "committee" : "free";
let armed = false;
let activePlan: CommitteePlan | null = null;
let assignmentByActor = new Map<string, CouncilParticipant>();

if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  void hydrateMode();
  installCouncilLifecycle();
  installPromptBridge();
  installUiCompanion();
}

async function hydrateMode() {
  if (FORCE_COMMITTEE_SHOWCASE) {
    mode = "committee";
    renderPanel();
    return;
  }
  try {
    const state = await chrome.storage.local.get(MODE_KEY);
    mode = state[MODE_KEY] === "committee" ? "committee" : "free";
    renderPanel();
  } catch {
    mode = "free";
  }
}

function installCouncilLifecycle() {
  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = async function committeeAwareRun(
    this: CouncilOrchestrator,
    ...args: Parameters<CouncilOrchestrator["run"]>
  ): ReturnType<CouncilOrchestrator["run"]> {
    await prepareAssignments();
    armed = true;
    renderPanel();
    try {
      return await originalRun.apply(this, args);
    } finally {
      armed = false;
      renderPanel();
    }
  } as CouncilOrchestrator["run"];
}

/**
 * Browser transport boundary hook.
 *
 * We modify only ChatChat-owned RUN_SPEECH payloads while an actual Council
 * is executing. Test Speech and Council Gate happen outside this lifecycle and
 * therefore remain committee-free validation steps.
 */
function installPromptBridge() {
  const tabs = chrome?.tabs;
  if (!tabs?.sendMessage) return;
  const original = tabs.sendMessage.bind(tabs);
  tabs.sendMessage = async function committeeAwareSendMessage(
    tabId: number,
    payload: unknown,
    ...rest: unknown[]
  ) {
    if (armed && isCouncilSpeechPayload(payload)) {
      const actorId = actorIdFromPrompt(payload.prompt);
      const participant = actorId
        ? assignmentByActor.get(actorId) ?? minimalParticipant(actorId)
        : null;
      if (participant) {
        payload = {
          ...payload,
          prompt: insertCommitteePromptBlock(payload.prompt, participant),
        };
      }
    }
    return original(tabId, payload, ...rest);
  };
}

async function prepareAssignments(): Promise<void> {
  assignmentByActor = new Map();
  activePlan = null;
  if (mode !== "committee") return;

  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(SEATS_KEY);
  const seats = Array.isArray(state[SEATS_KEY])
    ? (state[SEATS_KEY] as StoredSeat[])
    : [];
  if (!seats.length) return;

  const participants = participantsFromSeats(seats);
  activePlan = assignHouseCommittees(
    participants,
    recommendedCommitteeIds(participants.length),
  );
  for (const assignment of activePlan.assignments) {
    assignmentByActor.set(assignment.participant.id, {
      ...assignment.participant,
      committeeId: assignment.committee.id,
      committeeName: assignment.committee.name,
      committeeTask: assignment.committee.task,
    });
  }
  window.dispatchEvent(
    new CustomEvent("chatchat:committee-plan", {
      detail: {
        mode,
        assignments: activePlan.assignments.map((item) => ({
          actorId: item.participant.id,
          committeeId: item.committee.id,
          committeeName: item.committee.name,
        })),
      },
    }),
  );
}

function participantsFromSeats(seats: readonly StoredSeat[]): CouncilParticipant[] {
  const groups = new Map<string, StoredSeat[]>();
  for (const seat of seats) {
    const current = groups.get(seat.delegationId) ?? [];
    current.push(seat);
    groups.set(seat.delegationId, current);
  }
  return seats.map((seat) => {
    const group = [...(groups.get(seat.delegationId) ?? [seat])].sort(
      (a, b) => a.tabId - b.tabId,
    );
    const seatIndex = group.findIndex((candidate) => candidate.seatId === seat.seatId) + 1;
    return {
      id: seat.seatId,
      name: `${seat.providerName} · ${String(seatIndex).padStart(2, "0")}`,
      provider: seat.providerId,
      role: "Browser Tab Delegate",
      delegationId: seat.delegationId,
      delegationName: seat.delegationName,
      seatIndex,
      seatCount: group.length,
    };
  });
}

function isCouncilSpeechPayload(
  payload: unknown,
): payload is Record<string, unknown> & { prompt: string } {
  if (!payload || typeof payload !== "object") return false;
  const item = payload as Record<string, unknown>;
  return (
    item.__chatchat === true &&
    item.type === "RUN_SPEECH" &&
    typeof item.prompt === "string" &&
    item.prompt.includes("KING_QUESTION_JSON:") &&
    item.prompt.includes("YOUR_ACTOR_ID:")
  );
}

function actorIdFromPrompt(prompt: string): string | null {
  const match = prompt.match(/^YOUR_ACTOR_ID:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

function minimalParticipant(actorId: string): CouncilParticipant {
  return { id: actorId, name: actorId, provider: "unknown" };
}

function installUiCompanion() {
  injectStyles();
  const mount = () => {
    const command = document.querySelector("form.command-card");
    if (!command || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "committee-parliament";
    command.parentElement?.insertBefore(panel, command);
    renderPanel();
  };
  mount();
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function renderPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  const composition = activePlan ? committeeComposition(activePlan) : [];
  panel.dataset.parliamentMode = mode;
  panel.dataset.committeeArmed = armed ? "true" : "false";
  panel.innerHTML = `
    <div class="committee-head">
      <div>
        <span>PARLIAMENT MODE</span>
        <strong>${mode === "committee" ? "🏛️ 委员会审议" : "🗣️ 自由议会"}</strong>
      </div>
      <div class="committee-toggle" role="group" aria-label="Parliament mode">
        <button type="button" data-mode="free" class="${mode === "free" ? "is-active" : ""}">自由</button>
        <button type="button" data-mode="committee" class="${mode === "committee" ? "is-active" : ""}">委员会</button>
      </div>
    </div>
    <p>${mode === "committee"
      ? "开廷时跨 Provider 混编调查维度：证据、安全、工程、成本、体验、反例、需求。委员会只规定调查什么，不规定支持谁。"
      : "所有席位直接进入同一议场；不附加调查任务。"}</p>
    ${mode === "committee"
      ? `<div class="committee-chips">${composition.length
          ? composition
              .filter((item) => item.seats > 0)
              .map(
                (item) =>
                  `<span title="${escapeHtml(item.committee.outputHint)}">${item.committee.icon} ${escapeHtml(item.committee.name.replace(" Committee", ""))} · ${item.seats}</span>`,
              )
              .join("")
          : `<span>${armed ? "正在分配委员会…" : "开廷时按实际 House 席位自动混编"}</span>`}</div>`
      : ""}
    <small>委员会成员仍可反驳本委员会和本 Provider；最终表态仍是一席一票。</small>
  `;
  panel.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.mode === "committee" ? "committee" : "free";
      void setMode(next);
    });
  });
}

async function setMode(next: ParliamentMode) {
  if (armed || FORCE_COMMITTEE_SHOWCASE) return;
  mode = next;
  activePlan = null;
  assignmentByActor = new Map();
  await chrome.storage.local.set({ [MODE_KEY]: mode });
  renderPanel();
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .committee-parliament{margin:0 12px 12px;padding:13px 14px;border:1px solid #d9ebe3;border-radius:16px;background:linear-gradient(180deg,#fbfffd,#f4fbf7);box-shadow:0 8px 24px rgba(31,73,55,.05);font-family:inherit;color:#173c2d}
    .committee-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.committee-head>div:first-child{display:flex;flex-direction:column;gap:2px}.committee-head span{font-size:9px;letter-spacing:.13em;color:#779487}.committee-head strong{font-size:14px}.committee-toggle{display:flex;padding:2px;border:1px solid #cfe2d9;border-radius:10px;background:#fff}.committee-toggle button{border:0;background:transparent;border-radius:8px;padding:5px 8px;font-size:11px;color:#698176;cursor:pointer}.committee-toggle button.is-active{background:#173c2d;color:#fff}.committee-parliament p{margin:9px 0 7px;font-size:11px;line-height:1.55;color:#526c61}.committee-parliament small{font-size:9px;line-height:1.5;color:#82968d}.committee-chips{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.committee-chips span{padding:4px 7px;border-radius:999px;background:#eaf6f0;color:#315f4b;font-size:9px;font-weight:650}
  `;
  document.head.append(style);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
