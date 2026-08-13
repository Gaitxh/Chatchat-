import {
  gateBProofJson,
  gateBProofMarkdown,
  type GateBProofPack,
} from "../validation/proof-pack.js";
import {
  BROWSER_GATE_B_PROOF_EVENT,
  BROWSER_GATE_B_PROOF_KEY,
} from "./gate-b-observer.js";

declare const chrome: any;

void bootBrowserProofUi();

async function bootBrowserProofUi() {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  await whenDomReady();

  const host = document.createElement("div");
  host.id = "chatchat-browser-proof";
  host.dataset.proofPrivacy = "metadata-only";
  host.dataset.proofSource = "browser-house";
  host.innerHTML = `
    <style>
      #chatchat-browser-proof { display:none; margin:10px; color:#173b32; font:12px/1.4 ui-sans-serif,system-ui,sans-serif; }
      #chatchat-browser-proof.is-visible { display:block; }
      #chatchat-browser-proof .proof-shell { padding:13px; border:1px solid rgba(38,88,68,.16); border-radius:16px; background:linear-gradient(145deg,#f5fbf7,#fffdf5); box-shadow:0 12px 34px rgba(28,63,51,.1); }
      #chatchat-browser-proof .proof-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      #chatchat-browser-proof .proof-kicker { display:block; color:#698279; font:800 9px/1 system-ui,sans-serif; letter-spacing:.12em; }
      #chatchat-browser-proof h2 { margin:5px 0 3px; font-size:16px; }
      #chatchat-browser-proof .proof-copy { color:#65756f; font-size:10px; }
      #chatchat-browser-proof .proof-verdict { flex:none; padding:6px 8px; border-radius:999px; font:800 9px/1 system-ui,sans-serif; letter-spacing:.04em; }
      #chatchat-browser-proof .proof-verdict--gate-b-candidate { background:#dff4e9; color:#245d46; }
      #chatchat-browser-proof .proof-verdict--incomplete { background:#fff0cd; color:#79581a; }
      #chatchat-browser-proof .proof-verdict--demo-only { background:#ece9ff; color:#554589; }
      #chatchat-browser-proof .proof-provider-list { display:grid; gap:6px; margin-top:11px; }
      #chatchat-browser-proof .proof-provider { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:7px 8px; border:1px solid #e2e8e4; border-radius:10px; background:white; }
      #chatchat-browser-proof .proof-provider strong { display:block; font-size:10px; }
      #chatchat-browser-proof .proof-provider code { color:#6c7974; font-size:9px; }
      #chatchat-browser-proof .proof-gates { display:flex; gap:3px; flex-wrap:wrap; justify-content:flex-end; }
      #chatchat-browser-proof .proof-gates span { padding:3px 5px; border-radius:999px; background:#f2e6df; color:#925744; font:800 8px/1 system-ui,sans-serif; }
      #chatchat-browser-proof .proof-gates span.ok { background:#e3f3e9; color:#2b654b; }
      #chatchat-browser-proof .proof-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; margin-top:9px; }
      #chatchat-browser-proof .proof-stat { padding:6px; border-radius:9px; background:#eef4f1; text-align:center; }
      #chatchat-browser-proof .proof-stat b { display:block; font-size:13px; }
      #chatchat-browser-proof .proof-stat span { color:#71817b; font-size:8px; }
      #chatchat-browser-proof .proof-actions { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
      #chatchat-browser-proof button { border:1px solid rgba(38,88,68,.16); border-radius:9px; padding:7px 8px; background:white; color:#245544; font:800 9px/1 system-ui,sans-serif; cursor:pointer; }
      #chatchat-browser-proof button.primary { background:#245544; color:white; border-color:#245544; }
      #chatchat-browser-proof .proof-privacy { margin-top:8px; padding:7px 8px; border-radius:9px; background:#f5f0e2; color:#6b624d; font-size:9px; }
      #chatchat-browser-proof .proof-notice { margin-top:7px; color:#2b6e53; font-weight:700; font-size:9px; }
    </style>
    <section class="proof-shell" aria-label="Browser Gate B Royal Proof Pack">
      <div class="proof-head">
        <div>
          <span class="proof-kicker">ROYAL PROOF PACK · 御前验收</span>
          <h2>Browser Gate B</h2>
          <div class="proof-copy">真实 House Council 完成后自动冻结；只保留可公开的元数据。</div>
        </div>
        <span class="proof-verdict">WAITING</span>
      </div>
      <div class="proof-provider-list"></div>
      <div class="proof-stats"></div>
      <div class="proof-actions">
        <button type="button" class="primary" data-action="markdown">COPY ISSUE MARKDOWN</button>
        <button type="button" data-action="json">COPY JSON</button>
      </div>
      <div class="proof-privacy">🔒 不含 King's Command、模型回复、Blackboard 正文、Teach selector、tab id、账号、Cookie 或 token。</div>
      <div class="proof-notice" role="status"></div>
    </section>
  `;
  document.body.appendChild(host);

  host.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "markdown") void copyCurrent(host, "markdown");
    if (action === "json") void copyCurrent(host, "json");
  });

  window.addEventListener(BROWSER_GATE_B_PROOF_EVENT, (event) => {
    const pack = (event as CustomEvent<GateBProofPack>).detail;
    if (pack) renderProof(host, pack);
  });

  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(BROWSER_GATE_B_PROOF_KEY);
  if (isProofPack(state[BROWSER_GATE_B_PROOF_KEY])) {
    renderProof(host, state[BROWSER_GATE_B_PROOF_KEY]);
  }
}

function renderProof(host: HTMLElement, pack: GateBProofPack) {
  host.classList.add("is-visible");
  host.dataset.gateBVerdict = pack.verdict;
  host.dataset.gateBProviders = String(pack.providers.length);
  host.dataset.gateBRounds = String(pack.council?.rounds ?? 0);
  host.dataset.gateBUncertain = String(pack.council?.eventKinds.uncertain ?? 0);
  (host as HTMLElement & { __gateBPack?: GateBProofPack }).__gateBPack = pack;

  const verdict = host.querySelector<HTMLElement>(".proof-verdict")!;
  verdict.className = `proof-verdict proof-verdict--${pack.verdict}`;
  verdict.textContent =
    pack.verdict === "gate-b-candidate"
      ? "✓ GATE B CANDIDATE"
      : pack.verdict === "demo-only"
        ? "DEMO ONLY"
        : "⚠ INCOMPLETE";

  const providers = host.querySelector<HTMLElement>(".proof-provider-list")!;
  providers.replaceChildren();
  for (const provider of pack.providers) {
    const row = document.createElement("div");
    row.className = "proof-provider";
    row.innerHTML = `
      <div><strong>${escapeHtml(provider.providerId)}</strong><code>${escapeHtml(provider.host)}</code></div>
      <div class="proof-gates">
        ${gate("Recipe", provider.recipeReady)}
        ${gate("Test", provider.testPassed)}
        ${gate("Gate", provider.councilGatePassed)}
        ${gate("Host", provider.providerHostHealthy)}
      </div>
    `;
    providers.appendChild(row);
  }

  const council = pack.council;
  const stats = host.querySelector<HTMLElement>(".proof-stats")!;
  stats.innerHTML = council
    ? [
        stat("REAL", council.realParticipantCount),
        stat("ROUNDS", council.rounds),
        stat("EVENTS", council.realEventCount),
        stat("UNCERTAIN", council.eventKinds.uncertain),
        stat("FINAL", council.finalPositionCount),
        stat("ZERO FINAL", council.zeroConfidenceFinalCount),
        stat("CHALLENGE", council.eventKinds.challenge),
        stat("REVISION", council.eventKinds.revision),
      ].join("")
    : stat("COUNCIL", "—");

  const notice = host.querySelector<HTMLElement>(".proof-notice")!;
  notice.textContent =
    pack.verdict === "gate-b-candidate"
      ? "这是一份待维护者复核的环境级证据，不是自动 Official Support。"
      : "至少有一项真实运行门槛未满足；导出仍可用于排错，但不能当作 Gate B 成功证据。";
}

async function copyCurrent(host: HTMLElement, format: "markdown" | "json") {
  const pack = (host as HTMLElement & { __gateBPack?: GateBProofPack }).__gateBPack;
  if (!pack) return;
  const text = format === "markdown" ? gateBProofMarkdown(pack) : gateBProofJson(pack);
  const notice = host.querySelector<HTMLElement>(".proof-notice")!;
  try {
    await copyText(text);
    notice.textContent = format === "markdown"
      ? "✓ 已复制隐私安全的 GitHub Issue Markdown。"
      : "✓ 已复制 metadata-only JSON。";
  } catch (caught) {
    notice.textContent = `复制失败：${caught instanceof Error ? caught.message : String(caught)}`;
  }
}

function gate(label: string, ok: boolean): string {
  return `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "×"} ${label}</span>`;
}

function stat(label: string, value: string | number): string {
  return `<div class="proof-stat"><b>${escapeHtml(String(value))}</b><span>${escapeHtml(label)}</span></div>`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Clipboard unavailable.");
}

function isProofPack(value: unknown): value is GateBProofPack {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const pack = value as Partial<GateBProofPack>;
  return pack.schemaVersion === 1 && Array.isArray(pack.providers) && "privacy" in pack;
}

function whenDomReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
