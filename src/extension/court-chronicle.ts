import { CouncilOrchestrator } from "../core/orchestrator.js";
import {
  clearBrowserChronicle,
  createBrowserChronicleArchive,
  deleteBrowserChronicle,
  listBrowserChronicle,
  loadBrowserChronicle,
  saveBrowserChronicle,
  type BrowserChronicleSummary,
} from "./chronicle-store.js";

const PATCH_MARKER = "__CHATCHAT_BROWSER_COURT_CHRONICLE_V1__";
const PANEL_ID = "chatchat-browser-court-chronicle";
const STYLE_ID = "chatchat-browser-court-chronicle-style";
const THEATER_LOAD_EVENT = "chatchat:theater-load-archive";

const runtime = globalThis as typeof globalThis & Record<string, unknown>;
let summaries: BrowserChronicleSummary[] = [];
let loading = true;
let status = "";
let selectedSessionId: string | null = null;
let mounted = false;

if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  installChronicleCapture();
  installChronicleMount();
  void refreshChronicle();
}

function installChronicleCapture() {
  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = async function chronicleAwareRun(
    this: CouncilOrchestrator,
    ...args: Parameters<CouncilOrchestrator["run"]>
  ): ReturnType<CouncilOrchestrator["run"]> {
    const result = await originalRun.apply(this, args);
    const archive = createBrowserChronicleArchive(
      result.report,
      result.blackboard.events,
    );

    // The King should see HOUSE VERDICT as soon as Council computation is
    // complete. Local history persistence is useful, but it must never sit in
    // the critical path between CouncilOrchestrator and the result UI.
    void persistCompletedCouncil(archive);
    return result;
  } as CouncilOrchestrator["run"];
}

async function persistCompletedCouncil(
  archive: ReturnType<typeof createBrowserChronicleArchive>,
): Promise<void> {
  try {
    await saveBrowserChronicle(archive);
    status = "📚 史官已把本次廷议写入本机。";
    await refreshChronicle();
    window.dispatchEvent(
      new CustomEvent("chatchat:chronicle-saved", {
        detail: {
          sessionId: archive.sessionId,
          eventCount: archive.events.length,
        },
      }),
    );
  } catch (caught) {
    // A local history failure must not convert a successful Council into a
    // failed Council. The verdict is already visible; only the historian shows
    // its local storage error.
    status = `史官写入失败：${message(caught)}`;
    renderChronicle();
  }
}

function installChronicleMount() {
  injectStyles();
  const mount = () => {
    if (document.getElementById(PANEL_ID)) {
      mounted = true;
      return;
    }
    const theater = document.getElementById("chatchat-browser-council-theater");
    const result = document.querySelector(".result-card");
    const command = document.querySelector("form.command-card");
    const anchor = theater ?? result ?? command;
    if (!anchor) return;
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "court-chronicle";
    if (theater || result) anchor.insertAdjacentElement("afterend", panel);
    else anchor.insertAdjacentElement("beforebegin", panel);
    mounted = true;
    renderChronicle();
  };
  mount();
  const observer = new MutationObserver(() => {
    if (!mounted || !document.getElementById(PANEL_ID)) mount();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

async function refreshChronicle() {
  loading = true;
  renderChronicle();
  try {
    summaries = await listBrowserChronicle(12);
    if (!status.startsWith("史官写入失败")) status = "";
  } catch (caught) {
    summaries = [];
    status = `读取本地史册失败：${message(caught)}`;
  } finally {
    loading = false;
    renderChronicle();
  }
}

function renderChronicle() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.dataset.chronicleBackend = "indexeddb-local";
  panel.dataset.chronicleEntries = String(summaries.length);
  panel.dataset.chronicleSelected = selectedSessionId ?? "";
  panel.innerHTML = `
    <header class="chronicle-head">
      <div>
        <span>COURT CHRONICLE · 史官</span>
        <strong>📚 私人本地廷议史</strong>
      </div>
      <em>INDEXEDDB · LOCAL ONLY</em>
    </header>
    <div class="chronicle-privacy">
      <b>PRIVATE LOCAL HISTORY</b>
      <span>这里包含你的 King's Command、模型回答和 Blackboard 正文。只保存在这个浏览器扩展域；不会进入 Royal Proof Pack，也不会自动导出。</span>
    </div>
    ${loading
      ? `<div class="chronicle-empty">史官正在翻卷宗…</div>`
      : summaries.length
        ? `<div class="chronicle-list">${summaries.map(summaryHtml).join("")}</div>`
        : `<div class="chronicle-empty"><b>还没有旧廷议。</b><span>完成一场 Council 后，史官会自动在本机记档。</span></div>`}
    <footer class="chronicle-foot">
      <span>${summaries.length ? `显示最近 ${summaries.length} 场 · 不会自动删除更早档案` : "完整档案与列表摘要分开存储"}</span>
      <div>
        <button type="button" data-chronicle-action="refresh">刷新</button>
        <button type="button" class="chronicle-danger" data-chronicle-action="clear" ${summaries.length ? "" : "disabled"}>清空史册</button>
      </div>
    </footer>
    ${status ? `<div class="chronicle-status">${escapeHtml(status)}</div>` : ""}
  `;
  wireChronicleControls(panel);
}

function summaryHtml(summary: BrowserChronicleSummary): string {
  const selected = selectedSessionId === summary.sessionId;
  return `
    <article class="chronicle-entry ${selected ? "is-selected" : ""}" data-chronicle-session="${escapeAttr(summary.sessionId)}">
      <div class="chronicle-entry-main">
        <div>
          <strong>${escapeHtml(summary.questionPreview || "Untitled Council")}</strong>
          <span>${escapeHtml(formatWhen(summary.createdAt))} · ${summary.rounds} rounds · ${summary.eventCount} events · ${summary.participantCount} seats</span>
        </div>
        <b>${summary.consensusStance ? escapeHtml(summary.consensusStance) : "NO CONSENSUS"}</b>
      </div>
      <div class="chronicle-entry-meta">
        <span>Consensus ${Math.round(summary.consensusRatio * 100)}%</span>
        <span>🔄 ${summary.changedMindCount}</span>
        <span>${summary.minorityOpinionPresent ? "🛡 Minority" : "✓ no minority"}</span>
      </div>
      <div class="chronicle-entry-actions">
        <button type="button" data-chronicle-replay="${escapeAttr(summary.sessionId)}">▶ REPLAY LOCALLY</button>
        <button type="button" class="chronicle-delete" data-chronicle-delete="${escapeAttr(summary.sessionId)}">删除</button>
      </div>
    </article>
  `;
}

function wireChronicleControls(panel: HTMLElement) {
  panel.querySelector('[data-chronicle-action="refresh"]')?.addEventListener("click", () => {
    void refreshChronicle();
  });
  panel.querySelector('[data-chronicle-action="clear"]')?.addEventListener("click", async () => {
    const ok = window.confirm("清空本机 ChatChat Court Chronicle？这会删除完整问题、模型回复和事件历史，且无法撤销。 ");
    if (!ok) return;
    try {
      await clearBrowserChronicle();
      selectedSessionId = null;
      status = "本地史册已清空。";
      await refreshChronicle();
    } catch (caught) {
      status = `清空失败：${message(caught)}`;
      renderChronicle();
    }
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-chronicle-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.chronicleDelete;
      if (!sessionId) return;
      try {
        await deleteBrowserChronicle(sessionId);
        if (selectedSessionId === sessionId) selectedSessionId = null;
        status = "卷宗已从本机删除。";
        await refreshChronicle();
      } catch (caught) {
        status = `删除失败：${message(caught)}`;
        renderChronicle();
      }
    });
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-chronicle-replay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.chronicleReplay;
      if (!sessionId) return;
      button.disabled = true;
      status = "正在从本机卷宗恢复 Theater…";
      renderChronicle();
      try {
        const archive = await loadBrowserChronicle(sessionId);
        if (!archive) throw new Error("卷宗缺失或结构已损坏。 ");
        selectedSessionId = sessionId;
        window.dispatchEvent(
          new CustomEvent(THEATER_LOAD_EVENT, {
            detail: {
              source: "archive",
              archive,
            },
          }),
        );
        status = "📚 已送入 Council Theater：本次回放不会重新请求任何 AI。";
        renderChronicle();
        requestAnimationFrame(() => {
          document.getElementById("chatchat-browser-council-theater")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      } catch (caught) {
        status = `回放失败：${message(caught)}`;
        renderChronicle();
      }
    });
  });
}

function formatWhen(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "unknown time";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
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
    .court-chronicle{margin:12px;padding:14px;border:1px solid #e7dfcf;border-radius:18px;background:linear-gradient(160deg,#fffdf8,#faf7ef);box-shadow:0 10px 28px rgba(74,58,35,.06);color:#443822;font-family:inherit}.chronicle-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.chronicle-head>div{display:flex;flex-direction:column;gap:2px}.chronicle-head span{font-size:8px;letter-spacing:.14em;color:#9a876b;font-weight:800}.chronicle-head strong{font-size:15px}.chronicle-head em{font-style:normal;font-size:7px;font-weight:800;color:#735f41;background:#f1eadb;border-radius:999px;padding:5px 7px;white-space:nowrap}.chronicle-privacy{margin:9px 0;padding:8px 9px;border-radius:10px;background:#f3ecdf;display:flex;flex-direction:column;gap:2px}.chronicle-privacy b{font-size:8px;color:#765c36;letter-spacing:.05em}.chronicle-privacy span{font-size:8px;line-height:1.45;color:#7a6b55}.chronicle-list{display:flex;flex-direction:column;gap:7px}.chronicle-entry{padding:9px;border:1px solid #ebe4d8;border-radius:12px;background:#fff;transition:.15s}.chronicle-entry.is-selected{border-color:#bba47c;box-shadow:0 0 0 2px #f2eadb}.chronicle-entry-main{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}.chronicle-entry-main strong{display:block;font-size:10px;line-height:1.35;color:#493d2a}.chronicle-entry-main span{display:block;margin-top:3px;font-size:7px;color:#9a8b74}.chronicle-entry-main>b{font-size:8px;color:#80643d;background:#f7f0e4;border-radius:999px;padding:4px 6px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chronicle-entry-meta{display:flex;flex-wrap:wrap;gap:4px;margin:7px 0}.chronicle-entry-meta span{font-size:7px;padding:3px 5px;background:#f8f4ec;border-radius:999px;color:#83745e}.chronicle-entry-actions{display:flex;gap:5px}.chronicle-entry-actions button{flex:1;border:1px solid #dfd3c1;background:#fbf8f2;border-radius:8px;padding:6px;color:#6f5737;font:700 8px system-ui;cursor:pointer}.chronicle-entry-actions .chronicle-delete{flex:0 0 52px;background:#fff;color:#9b705e}.chronicle-empty{padding:13px;border:1px dashed #d8cbb8;border-radius:11px;text-align:center;color:#8e7d65;font-size:8px}.chronicle-empty b,.chronicle-empty span{display:block}.chronicle-empty span{margin-top:3px}.chronicle-foot{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:9px}.chronicle-foot>span{font-size:7px;color:#9a8d78}.chronicle-foot>div{display:flex;gap:4px}.chronicle-foot button{border:0;background:#eee5d7;border-radius:7px;padding:5px 6px;color:#796347;font-size:7px;cursor:pointer}.chronicle-foot button.chronicle-danger{color:#965c4f;background:#f8e9e4}.chronicle-foot button:disabled{opacity:.4;cursor:not-allowed}.chronicle-status{margin-top:7px;padding:7px 8px;border-radius:9px;background:#f2eadc;color:#755f40;font-size:8px;line-height:1.4}
  `;
  document.head.append(style);
}
