import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";
import {
  buildCouncilInfluenceGraph,
  deriveCouncilAwards,
  type CouncilAward,
  type InfluenceEdge,
} from "../theater/influence.js";

const PATCH_MARKER = "__CHATCHAT_BROWSER_COUNCIL_THEATER_V1__";
const PANEL_ID = "chatchat-browser-council-theater";
const STYLE_ID = "chatchat-browser-council-theater-style";

type ReplaySpeed = "1x" | "2x" | "instant";

interface TheaterSnapshot {
  report: CouncilReport;
  events: CouncilEvent[];
  participants: CouncilParticipant[];
}

const runtime = globalThis as typeof globalThis & Record<string, unknown>;
let snapshot: TheaterSnapshot | null = null;
let cursor = 0;
let replaySpeed: ReplaySpeed = "2x";
let playing = false;
let selectedEventId: string | null = null;
let timer: number | null = null;

if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  installCouncilCapture();
  installTheaterMount();
}

function installCouncilCapture() {
  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = async function theaterAwareRun(
    this: CouncilOrchestrator,
    ...args: Parameters<CouncilOrchestrator["run"]>
  ): ReturnType<CouncilOrchestrator["run"]> {
    const result = await originalRun.apply(this, args);
    const participants = uniqueParticipants(
      result.report.positions.map((position) => position.participant),
    );
    snapshot = {
      report: result.report,
      events: [...result.blackboard.events],
      participants,
    };
    stopReplay();
    cursor = snapshot.events.length;
    selectedEventId = null;
    renderTheater();
    window.dispatchEvent(
      new CustomEvent("chatchat:browser-theater-ready", {
        detail: {
          sessionId: result.report.sessionId,
          eventCount: snapshot.events.length,
          participantCount: participants.length,
        },
      }),
    );
    return result;
  } as CouncilOrchestrator["run"];
}

function installTheaterMount() {
  injectStyles();
  const mount = () => {
    if (!snapshot) return;
    const resultCard = document.querySelector(".result-card");
    if (!resultCard) return;
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.className = "browser-theater";
      resultCard.insertAdjacentElement("afterend", panel);
    }
    renderTheater();
  };
  mount();
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function renderTheater() {
  const currentSnapshot = snapshot;
  if (!currentSnapshot) return;
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const total = currentSnapshot.events.length;
  cursor = Math.max(0, Math.min(cursor, total));
  const visibleEvents = currentSnapshot.events.slice(0, cursor);
  const graph = buildCouncilInfluenceGraph(
    currentSnapshot.participants,
    visibleEvents,
  );
  const fullGraph = buildCouncilInfluenceGraph(
    currentSnapshot.participants,
    currentSnapshot.events,
  );
  const awards = deriveCouncilAwards(
    graph,
    visibleEvents,
    cursor === total ? currentSnapshot.report : null,
  );
  const currentEvent = cursor > 0 ? currentSnapshot.events[cursor - 1] ?? null : null;
  const names = new Map(
    currentSnapshot.participants.map((participant) => [participant.id, participant.name]),
  );
  const strongEdges = graph.edges
    .filter((edge) => edge.strength === "strong")
    .slice(-6)
    .reverse();
  const interactionEdges = [...graph.aggregatedEdges]
    .filter((edge) => edge.strength === "interaction")
    .sort(
      (a, b) =>
        b.interactionCount - a.interactionCount ||
        a.sourceActorId.localeCompare(b.sourceActorId),
    )
    .slice(0, 6);
  const replayRows = visibleEvents.slice(Math.max(0, visibleEvents.length - 8));
  const stage = replayStage(currentEvent, visibleEvents);
  const changed = currentEvent?.kind === "revision"
    ? revisionMoment(currentEvent, currentSnapshot.events, names)
    : null;

  panel.dataset.theaterState = cursor === total ? "complete" : playing ? "replaying" : "paused";
  panel.dataset.theaterVisibleEvents = String(cursor);
  panel.dataset.theaterTotalEvents = String(total);
  panel.dataset.theaterStrongLinks = String(fullGraph.edges.filter((edge) => edge.strength === "strong").length);
  panel.dataset.theaterProviderCallsDuringReplay = "0";

  panel.innerHTML = `
    <header class="theater-head">
      <div>
        <span>COUNCIL THEATER · 议会剧场</span>
        <strong>谁推动了谁的立场？</strong>
      </div>
      <em>LOCAL REPLAY · 0 PROVIDER CALLS</em>
    </header>

    <div class="theater-live-summary">
      <div><span>当前舞台</span><b>${escapeHtml(stage)}</b></div>
      <div><span>事件</span><b>${cursor}/${total}</b></div>
      <div><span>强影响</span><b>${graph.edges.filter((edge) => edge.strength === "strong").length}</b></div>
      <div><span>互动</span><b>${graph.edges.filter((edge) => edge.strength === "interaction").length}</b></div>
    </div>

    ${changed ? `
      <div class="changed-mind-stage" data-theater-changed-mind="true">
        <b>🔄 CHANGED MIND</b>
        <strong>${escapeHtml(changed.actor)} · ${escapeHtml(changed.from)} → ${escapeHtml(changed.to)}</strong>
        <span>${escapeHtml(changed.cause)}</span>
      </div>
    ` : ""}

    <div class="theater-grid">
      <div class="theater-card">
        <span class="theater-kicker">EXPLICIT INFLUENCE</span>
        <h3>可追溯的“说服”</h3>
        <div class="strong-link-list">
          ${strongEdges.length
            ? strongEdges.map((edge) => strongEdgeHtml(edge, names)).join("")
            : `<p class="theater-empty">还没有 revision.causedBy / concede，所以这里不会假装有人被说服。</p>`}
        </div>
      </div>

      <div class="theater-card">
        <span class="theater-kicker">ATTEMPTED INFLUENCE</span>
        <h3>质询 / 举证 / 支持</h3>
        <div class="interaction-list">
          ${interactionEdges.length
            ? interactionEdges.map((edge) => interactionEdgeHtml(edge, names)).join("")
            : `<p class="theater-empty">回放推进到公开廷议后，互动边会在这里长出来。</p>`}
        </div>
      </div>
    </div>

    ${awards.length ? `
      <div class="theater-awards">
        ${awards.map((award) => awardHtml(award, names)).join("")}
      </div>
    ` : ""}

    <div class="replay-console">
      <div class="replay-head">
        <div>
          <span class="theater-kicker">COUNCIL REPLAY</span>
          <strong>史官回放 · 不重新请求 AI</strong>
        </div>
        <div class="replay-controls">
          <button type="button" data-theater-action="reset" title="回到事件 0">↺</button>
          <button type="button" data-theater-action="play" class="replay-play">${playing ? "Ⅱ" : "▶"}</button>
          ${(["1x", "2x", "instant"] as const).map((value) =>
            `<button type="button" data-theater-speed="${value}" class="${replaySpeed === value ? "is-active" : ""}">${value === "instant" ? "∞" : value}</button>`,
          ).join("")}
        </div>
      </div>
      <input class="replay-range" type="range" min="0" max="${total}" value="${cursor}" step="1" aria-label="Council replay event cursor" />
      <div class="replay-timeline">
        ${replayRows.length
          ? replayRows.map((event) => eventRowHtml(event, names, selectedEventId === event.id)).join("")
          : `<p class="theater-empty">事件 0 · 所有席位还在密室门外。</p>`}
      </div>
    </div>

    ${fullGraph.unresolvedReferences.length ? `
      <div class="theater-warning">⚠ ${fullGraph.unresolvedReferences.length} 个事件引用无法解析；ChatChat 没有为它们发明影响关系。</div>
    ` : ""}

    <footer class="theater-foot">
      <span>强影响只来自 <code>revision.causedBy</code> / <code>concede.targetEventId</code></span>
      <span>challenge / evidence / support 只算互动尝试</span>
      <span>奖项是事后 UI 统计，不反馈给模型</span>
    </footer>
  `;

  wireTheaterControls(panel, currentSnapshot);
}

function wireTheaterControls(panel: HTMLElement, currentSnapshot: TheaterSnapshot) {
  panel.querySelector<HTMLButtonElement>('[data-theater-action="play"]')?.addEventListener("click", () => {
    if (playing) {
      stopReplay();
      renderTheater();
      return;
    }
    if (cursor >= currentSnapshot.events.length) cursor = 0;
    playing = true;
    selectedEventId = null;
    scheduleReplayTick();
    renderTheater();
  });

  panel.querySelector<HTMLButtonElement>('[data-theater-action="reset"]')?.addEventListener("click", () => {
    stopReplay();
    cursor = 0;
    selectedEventId = null;
    renderTheater();
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-theater-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.theaterSpeed;
      if (next === "1x" || next === "2x" || next === "instant") {
        replaySpeed = next;
        if (playing) {
          clearReplayTimer();
          scheduleReplayTick();
        }
        renderTheater();
      }
    });
  });

  panel.querySelector<HTMLInputElement>(".replay-range")?.addEventListener("input", (event) => {
    stopReplay();
    cursor = Number((event.currentTarget as HTMLInputElement).value);
    selectedEventId = cursor > 0 ? currentSnapshot.events[cursor - 1]?.id ?? null : null;
    renderTheater();
  });

  panel.querySelectorAll<HTMLElement>("[data-theater-event]").forEach((element) => {
    element.addEventListener("click", () => {
      const id = element.dataset.theaterEvent;
      if (!id) return;
      const index = currentSnapshot.events.findIndex((event) => event.id === id);
      if (index < 0) return;
      stopReplay();
      cursor = index + 1;
      selectedEventId = id;
      renderTheater();
    });
  });
}

function scheduleReplayTick() {
  clearReplayTimer();
  if (!playing || !snapshot) return;
  const delay = replaySpeed === "1x" ? 1050 : replaySpeed === "2x" ? 480 : 55;
  timer = window.setTimeout(() => {
    if (!snapshot || !playing) return;
    if (cursor < snapshot.events.length) {
      cursor += 1;
      selectedEventId = snapshot.events[cursor - 1]?.id ?? null;
      renderTheater();
      scheduleReplayTick();
      return;
    }
    stopReplay();
    renderTheater();
  }, delay);
}

function stopReplay() {
  playing = false;
  clearReplayTimer();
}

function clearReplayTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function strongEdgeHtml(edge: InfluenceEdge, names: ReadonlyMap<string, string>): string {
  const source = names.get(edge.sourceActorId) ?? edge.sourceActorId;
  const target = names.get(edge.targetActorId) ?? edge.targetActorId;
  const detail = edge.kind === "revision"
    ? `🔄 ${edge.stanceTransition?.from ?? "?"} → ${edge.stanceTransition?.to ?? "?"}`
    : "🏳 明确让步";
  return `
    <button type="button" class="strong-link" data-theater-event="${escapeAttr(edge.sourceEventId)}">
      <span>${escapeHtml(source)}</span>
      <i>→</i>
      <span>${escapeHtml(target)}</span>
      <b>${escapeHtml(detail)}</b>
    </button>
  `;
}

function interactionEdgeHtml(
  edge: ReturnType<typeof buildCouncilInfluenceGraph>["aggregatedEdges"][number],
  names: ReadonlyMap<string, string>,
): string {
  const source = names.get(edge.sourceActorId) ?? edge.sourceActorId;
  const target = names.get(edge.targetActorId) ?? edge.targetActorId;
  const labels = [
    edge.kinds.challenge ? `⚔${edge.kinds.challenge}` : "",
    edge.kinds.evidence ? `📎${edge.kinds.evidence}` : "",
    edge.kinds.support ? `🤝${edge.kinds.support}` : "",
    edge.kinds.defense ? `🛡${edge.kinds.defense}` : "",
  ].filter(Boolean).join(" ");
  return `
    <button type="button" class="interaction-link" data-theater-event="${escapeAttr(edge.eventIds.at(-1) ?? "")}">
      <span>${escapeHtml(source)}</span><i>→</i><span>${escapeHtml(target)}</span><b>${labels}</b>
    </button>
  `;
}

function awardHtml(award: CouncilAward, names: ReadonlyMap<string, string>): string {
  const participant = names.get(award.participantId) ?? award.participantId;
  const provenance = award.provenanceEventIds.at(-1) ?? "";
  return `
    <button type="button" class="theater-award" data-theater-event="${escapeAttr(provenance)}">
      <b>${award.icon}</b>
      <span><strong>${escapeHtml(award.title)}</strong><small>${escapeHtml(participant)} · ${escapeHtml(award.detail)}</small></span>
    </button>
  `;
}

function eventRowHtml(
  event: CouncilEvent,
  names: ReadonlyMap<string, string>,
  selected: boolean,
): string {
  const actor = names.get(event.actorId) ?? event.actorId;
  const icon = eventIcon(event.kind);
  const content = eventText(event);
  const stance = eventStance(event);
  return `
    <button type="button" class="replay-event ${selected ? "is-selected" : ""} replay-${event.kind}" data-theater-event="${escapeAttr(event.id)}">
      <b>${icon}</b>
      <span>
        <strong>${escapeHtml(actor)} <em>${escapeHtml(event.kind.replaceAll("_", " "))}</em></strong>
        <small>${stance ? `${escapeHtml(stance)} · ` : ""}${escapeHtml(truncate(content, 150))}</small>
      </span>
      <i>R${event.round}</i>
    </button>
  `;
}

function revisionMoment(
  event: Extract<CouncilEvent, { kind: "revision" }>,
  events: readonly CouncilEvent[],
  names: ReadonlyMap<string, string>,
) {
  const previous = events.find((candidate) => candidate.id === event.previousEventId);
  const cause = (event.causedBy ?? [])
    .map((id) => events.find((candidate) => candidate.id === id))
    .find(Boolean);
  return {
    actor: names.get(event.actorId) ?? event.actorId,
    from: previous ? eventStance(previous) || "?" : "?",
    to: event.stance,
    cause: cause
      ? `because of ${names.get(cause.actorId) ?? cause.actorId} · ${cause.kind}`
      : "explicit revision; no external cause id supplied",
  };
}

function replayStage(
  current: CouncilEvent | null,
  visible: readonly CouncilEvent[],
): string {
  if (!current) return "BEFORE COUNCIL";
  if (current.kind === "final_position") return `FINAL · R${current.round}`;
  if (visible.some((event) => event.round > 1)) return `OPEN COUNCIL · R${current.round}`;
  return "SEALED · R1";
}

function eventIcon(kind: CouncilEvent["kind"]): string {
  const icons: Record<CouncilEvent["kind"], string> = {
    argument: "💬",
    challenge: "⚔️",
    evidence: "📎",
    support: "🤝",
    defense: "🛡️",
    revision: "🔄",
    concede: "🏳️",
    question: "❓",
    uncertain: "⚠️",
    final_position: "📜",
  };
  return icons[kind];
}

function eventText(event: CouncilEvent): string {
  if (event.kind === "evidence") return `${event.claim} — ${event.content}`;
  return event.content;
}

function eventStance(event: CouncilEvent): string | null {
  if (
    event.kind === "argument" ||
    event.kind === "revision" ||
    event.kind === "final_position"
  ) return event.stance;
  return null;
}

function uniqueParticipants(values: readonly CouncilParticipant[]): CouncilParticipant[] {
  const seen = new Set<string>();
  const result: CouncilParticipant[] = [];
  for (const participant of values) {
    if (seen.has(participant.id)) continue;
    seen.add(participant.id);
    result.push(participant);
  }
  return result;
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .browser-theater{margin:12px;padding:14px;border:1px solid #dbe7e2;border-radius:18px;background:linear-gradient(180deg,#fffefd 0%,#f7fbf9 100%);box-shadow:0 10px 30px rgba(32,67,53,.06);color:#153c2c;font-family:inherit}.theater-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.theater-head>div{display:flex;flex-direction:column;gap:2px}.theater-head span,.theater-kicker{font-size:9px;letter-spacing:.14em;color:#739083;font-weight:700}.theater-head strong{font-size:16px}.theater-head em{font-style:normal;font-size:8px;font-weight:800;color:#276a50;background:#e9f6ef;border-radius:999px;padding:5px 7px;white-space:nowrap}.theater-live-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:11px 0}.theater-live-summary>div{background:#f1f7f4;border-radius:10px;padding:7px}.theater-live-summary span{display:block;font-size:8px;color:#81958c}.theater-live-summary b{display:block;margin-top:2px;font-size:11px}.changed-mind-stage{margin:9px 0;padding:10px 11px;border-radius:12px;background:linear-gradient(120deg,#efeefe,#f7f4ff);border:1px solid #d9d6fa;display:flex;flex-direction:column;gap:2px}.changed-mind-stage>b{font-size:9px;color:#5d58a7;letter-spacing:.08em}.changed-mind-stage>strong{font-size:13px}.changed-mind-stage>span{font-size:9px;color:#706d96}.theater-grid{display:grid;grid-template-columns:1fr;gap:8px}.theater-card{padding:10px;border:1px solid #e1ebe7;border-radius:13px;background:#fff}.theater-card h3{font-size:12px;margin:2px 0 8px}.strong-link-list,.interaction-list{display:flex;flex-direction:column;gap:5px}.strong-link,.interaction-link{width:100%;border:0;background:#f6faf8;border-radius:9px;padding:7px 8px;display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);align-items:center;gap:3px;text-align:left;color:#244f3d;cursor:pointer}.strong-link{background:#f1f0fd;color:#494582}.strong-link span,.interaction-link span{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.strong-link i,.interaction-link i{text-align:center;font-style:normal}.strong-link b,.interaction-link b{grid-column:1/-1;font-size:9px}.theater-empty{font-size:9px;color:#8b9a93;line-height:1.5;margin:0}.theater-awards{display:flex;gap:6px;overflow-x:auto;margin:9px 0;padding-bottom:2px}.theater-award{flex:0 0 150px;border:1px solid #e3e9e6;background:#fff;border-radius:11px;padding:7px;display:flex;gap:7px;align-items:flex-start;text-align:left;color:#274d3d}.theater-award>b{font-size:17px}.theater-award span{min-width:0}.theater-award strong{display:block;font-size:9px}.theater-award small{display:block;font-size:8px;line-height:1.35;color:#7c8e86;margin-top:2px}.replay-console{margin-top:9px;padding:10px;border-radius:14px;background:#173d2e;color:#f4fbf7}.replay-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.replay-head>div:first-child{display:flex;flex-direction:column}.replay-head .theater-kicker{color:#9ac0af}.replay-head strong{font-size:11px}.replay-controls{display:flex;gap:3px}.replay-controls button{border:0;border-radius:7px;padding:5px 6px;background:#315846;color:#dcebe4;font-size:9px;cursor:pointer}.replay-controls button.is-active,.replay-controls .replay-play{background:#eaf6f0;color:#173d2e}.replay-range{width:100%;accent-color:#8ad0af;margin:9px 0 7px}.replay-timeline{display:flex;flex-direction:column;gap:4px;max-height:250px;overflow:auto}.replay-event{border:0;border-radius:8px;padding:6px;background:#244a39;color:#eaf3ee;display:grid;grid-template-columns:20px 1fr 24px;gap:5px;align-items:flex-start;text-align:left;cursor:pointer}.replay-event.is-selected{outline:1px solid #9de0c0;background:#315c48}.replay-event>b{font-size:13px}.replay-event span{min-width:0}.replay-event strong{display:block;font-size:9px}.replay-event strong em{font-style:normal;color:#9ec4b2;margin-left:4px}.replay-event small{display:block;font-size:8px;color:#bdd1c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.replay-event>i{font-size:8px;font-style:normal;color:#92b09f}.theater-warning{margin-top:8px;padding:7px 9px;border-radius:10px;background:#fff5e8;color:#825d31;font-size:9px}.theater-foot{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.theater-foot span{font-size:8px;color:#72887d;background:#eef5f1;border-radius:999px;padding:4px 6px}.theater-foot code{font-size:7px}
  `;
  document.head.append(style);
}
