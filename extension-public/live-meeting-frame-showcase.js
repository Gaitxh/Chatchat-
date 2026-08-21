(() => {
  const params = new URLSearchParams(location.search);
  const proofMode = params.get("live-proof");
  if (params.get("showcase") !== "consultation" || (proofMode !== "persuasion" && proofMode !== "response")) return;

  const locale = params.get("lang") === "en" ? "en" : "zh-CN";
  const ROOT_ATTR = "data-chatchat-live-proof-showcase";
  const FRAME_ATTR = "data-chatchat-live-proof-frame";
  const STRONG_SELECTOR = '[data-persuasion-strength="strong"][data-persuasion-cause-event][data-persuasion-action-event]';
  const RESPONDING_SELECTOR = '[data-live-response-rail="canonical-peer-exchange"][data-live-response-state="responding"]';
  const QUEUED_SELECTOR = '[data-live-response-rail="canonical-peer-exchange"][data-live-response-state="queued"]';
  const QUEUED_FALLBACK_MS = 900;
  let queuedFallbackTimer = 0;
  let observer = null;

  function capture() {
    return proofMode === "response" ? captureResponse() : capturePersuasion();
  }

  function capturePersuasion() {
    if (document.querySelector(`[${FRAME_ATTR}="persuasion"]`)) return true;
    const strong = document.querySelector(STRONG_SELECTOR);
    const floor = strong?.closest(".live-participant-floor") ?? document.querySelector(".live-participant-floor");
    if (!(strong instanceof HTMLElement) || !(floor instanceof HTMLElement)) return false;

    return freezeFloor({
      mode: "persuasion",
      floor,
      frameDataset: {
        persuasionCauseEvent: strong.dataset.persuasionCauseEvent ?? "",
        persuasionActionEvent: strong.dataset.persuasionActionEvent ?? "",
      },
      heading: locale === "zh-CN"
        ? `<span>REAL CHROMIUM · LIVE FRAME</span><h1>AI 大会正在发生</h1><p>这个画面在真实 consultation 第一次出现可追溯的强影响事件时冻结。下面不是静态 mock：它是当时真实 Live Floor 的 DOM 快照。</p><b>↻ 已捕获一次“谁说服了谁”</b>`
        : `<span>REAL CHROMIUM · LIVE FRAME</span><h1>The AI assembly is happening now</h1><p>This frame freezes the real consultation DOM at the first traceable strong-influence event. It is not a static mock; it is the actual Live Floor at that moment.</p><b>↻ Captured one “who moved whom” event</b>`,
    });
  }

  function captureResponse({ allowQueued = false } = {}) {
    if (document.querySelector(`[${FRAME_ATTR}="response"]`)) return true;

    const responding = document.querySelector(RESPONDING_SELECTOR);
    if (responding instanceof HTMLElement) {
      clearQueuedFallback();
      return freezeResponseFloor(responding);
    }

    const queued = document.querySelector(QUEUED_SELECTOR);
    if (!(queued instanceof HTMLElement)) return false;
    if (allowQueued) return freezeResponseFloor(queued);
    scheduleQueuedFallback();
    return false;
  }

  function scheduleQueuedFallback() {
    if (queuedFallbackTimer) return;
    queuedFallbackTimer = window.setTimeout(() => {
      queuedFallbackTimer = 0;
      if (captureResponse({ allowQueued: true })) observer?.disconnect();
    }, QUEUED_FALLBACK_MS);
  }

  function clearQueuedFallback() {
    if (!queuedFallbackTimer) return;
    window.clearTimeout(queuedFallbackTimer);
    queuedFallbackTimer = 0;
  }

  function freezeResponseFloor(rail) {
    const floor = rail.closest(".live-participant-floor");
    if (!(floor instanceof HTMLElement)) return false;
    if (!floor.querySelector(".live-phase-chip.phase-debate")) return false;
    const state = rail.dataset.liveResponseState ?? "";
    if (state !== "responding" && state !== "queued") return false;
    return freezeFloor({
      mode: "response",
      floor,
      frameDataset: {
        liveResponsePhase: "debate",
        liveResponseState: state,
        liveResponseRequestEvent: rail.dataset.liveResponseRequestEvent ?? "",
        liveResponseTargetActor: rail.dataset.liveResponseTargetActor ?? "",
      },
      heading: locale === "zh-CN"
        ? `<span>REAL CHROMIUM · RESPONSE FRAME</span><h1>点名答辩正在发生</h1><p>这个画面冻结在真实公开协商中：一位 AI 已经点名另一位 AI，回应正在生成，或已进入下一轮待回应队列。状态直接来自 canonical Peer Exchange。</p><b>⚔ 正在追踪一条真实答辩路线</b>`
        : `<span>REAL CHROMIUM · RESPONSE FRAME</span><h1>One AI is waiting on another</h1><p>This frame freezes the real open consultation while a named response is actively being produced or queued for the next debate turn. The state comes directly from canonical Peer Exchange.</p><b>⚔ Tracking one real response route</b>`,
    });
  }

  function freezeFloor({ mode, floor, frameDataset, heading }) {
    if (document.querySelector(`[${FRAME_ATTR}="${mode}"]`)) return true;
    const frame = document.createElement("main");
    frame.className = "chatchat-live-proof-frame consultation-full-room";
    frame.setAttribute(FRAME_ATTR, mode);
    for (const [key, value] of Object.entries(frameDataset)) frame.dataset[key] = value;

    const headingElement = document.createElement("header");
    headingElement.className = "chatchat-live-proof-frame__heading";
    headingElement.innerHTML = heading;

    const proposal = document.createElement("section");
    proposal.className = "chatchat-live-proof-frame__proposal";
    const proposalText = document.querySelector(".proposal-section textarea")?.value
      ?? document.querySelector("textarea")?.value
      ?? "";
    proposal.innerHTML = locale === "zh-CN"
      ? `<small>本次提案</small><strong>${escapeHtml(proposalText)}</strong>`
      : `<small>PROPOSAL</small><strong>${escapeHtml(proposalText)}</strong>`;

    const liveClone = floor.cloneNode(true);
    if (!(liveClone instanceof HTMLElement)) return false;
    liveClone.dataset.liveProofClone = "true";

    frame.append(headingElement, proposal, liveClone);
    document.body.append(frame);
    installStyle();
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute(ROOT_ATTR, "complete");
    return true;
  }

  function installStyle() {
    if (document.getElementById("chatchat-live-proof-frame-style")) return;
    const style = document.createElement("style");
    style.id = "chatchat-live-proof-frame-style";
    style.textContent = `
      .chatchat-live-proof-frame {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        overflow: auto;
        box-sizing: border-box;
        padding: 30px 34px 70px;
        background:
          radial-gradient(circle at 18% 0%, rgba(84, 128, 190, .16), transparent 34%),
          radial-gradient(circle at 82% 12%, rgba(151, 91, 178, .12), transparent 31%),
          #090d14;
        color: #edf2f8;
      }
      .chatchat-live-proof-frame__heading,
      .chatchat-live-proof-frame__proposal,
      .chatchat-live-proof-frame > .live-participant-floor {
        width: min(1320px, calc(100vw - 68px));
        margin-left: auto;
        margin-right: auto;
      }
      .chatchat-live-proof-frame__heading {
        position: relative;
        box-sizing: border-box;
        padding: 26px 30px 24px;
        border: 1px solid rgba(131, 168, 220, .18);
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(48, 72, 104, .34), rgba(25, 30, 42, .88));
        box-shadow: 0 24px 80px rgba(0,0,0,.28);
      }
      .chatchat-live-proof-frame__heading span {
        color: #e3ba73;
        font: 800 11px/1.2 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .14em;
      }
      .chatchat-live-proof-frame__heading h1 {
        margin: 8px 0 8px;
        color: #f4f7fb;
        font: 760 34px/1.12 ui-sans-serif, system-ui, sans-serif;
      }
      .chatchat-live-proof-frame__heading p {
        max-width: 850px;
        margin: 0;
        color: #9eabba;
        font: 500 14px/1.55 ui-sans-serif, system-ui, sans-serif;
      }
      .chatchat-live-proof-frame__heading b {
        position: absolute;
        top: 26px;
        right: 28px;
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(171, 103, 199,.12);
        color: #d7ade8;
        font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
      }
      .chatchat-live-proof-frame__proposal {
        box-sizing: border-box;
        margin-top: 14px;
        margin-bottom: 14px;
        padding: 12px 16px;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 12px;
        background: rgba(255,255,255,.035);
      }
      .chatchat-live-proof-frame__proposal small {
        display: block;
        margin-bottom: 4px;
        color: #77869a;
        font: 800 9px/1.2 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .1em;
      }
      .chatchat-live-proof-frame__proposal strong {
        display: block;
        color: #cbd5e1;
        font: 600 12px/1.45 ui-sans-serif, system-ui, sans-serif;
      }
      .chatchat-live-proof-frame > .live-participant-floor {
        box-sizing: border-box;
      }
      .chatchat-live-proof-frame button { pointer-events: none; }
      @media (max-width: 720px) {
        .chatchat-live-proof-frame { padding: 14px 12px 50px; }
        .chatchat-live-proof-frame__heading,
        .chatchat-live-proof-frame__proposal,
        .chatchat-live-proof-frame > .live-participant-floor { width: 100%; }
        .chatchat-live-proof-frame__heading { padding: 18px; }
        .chatchat-live-proof-frame__heading h1 { font-size: 24px; }
        .chatchat-live-proof-frame__heading b { position: static; display: inline-block; margin-top: 12px; }
      }
    `;
    document.head.append(style);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function start() {
    if (capture()) return;
    observer = new MutationObserver(() => {
      if (!capture()) return;
      observer.disconnect();
      clearQueuedFallback();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
