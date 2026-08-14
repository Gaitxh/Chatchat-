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

type Locale = "en" | "zh-CN";
type ProofHost = HTMLElement & { __gateBPack?: GateBProofPack };

const COPY = {
  en: {
    kicker: "REAL PROVIDER PROOF",
    title: "What this browser run actually proved",
    body: "A privacy-safe acceptance snapshot from the current Browser Consultation. No model transcript or account credential is exported.",
    candidate: "✓ GATE B CANDIDATE",
    incomplete: "⚠ INCOMPLETE",
    demo: "DEMO ONLY",
    pageMap: "Page map",
    connection: "Connection",
    protocol: "Protocol",
    host: "Host",
    inRoom: "In room",
    real: "REAL",
    rounds: "ROUNDS",
    events: "EVENTS",
    uncertain: "UNCERTAIN",
    final: "FINAL",
    fallback: "ZERO FINAL",
    challenge: "CHALLENGE",
    revision: "REVISION",
    copyMarkdown: "COPY GITHUB MARKDOWN",
    copyJson: "COPY JSON",
    privacy: "🔒 Excludes the user proposal, model responses, event/message text, page mappings/selectors, account identifiers, cookies, tokens and credentials.",
    candidateNote: "Environment-specific real-run evidence. Review it before making any Provider compatibility claim.",
    incompleteNote: "At least one real-run gate is still missing. Export is useful for debugging, but this is not Gate B success evidence.",
    demoNote: "This is a deterministic UI preview only. It can never count as real Provider acceptance evidence.",
    copiedMarkdown: "✓ Privacy-safe GitHub Markdown copied.",
    copiedJson: "✓ Metadata-only JSON copied.",
    copyFailed: "Copy failed",
  },
  "zh-CN": {
    kicker: "真实 PROVIDER 验收",
    title: "这次浏览器运行到底证明了什么",
    body: "来自当前 Browser Consultation 的隐私安全验收快照。不导出任何模型对话正文或账号凭据。",
    candidate: "✓ GATE B 候选证据",
    incomplete: "⚠ 尚未完整",
    demo: "仅演示",
    pageMap: "页面识别",
    connection: "连接",
    protocol: "协商协议",
    host: "Provider 页面",
    inRoom: "已入场",
    real: "真实参与者",
    rounds: "轮次",
    events: "事件",
    uncertain: "不确定",
    final: "最终立场",
    fallback: "零置信结论",
    challenge: "质疑",
    revision: "改口",
    copyMarkdown: "复制 GitHub Markdown",
    copyJson: "复制 JSON",
    privacy: "🔒 不包含用户提案、模型回复、结构化事件正文、页面映射/selector、账号标识、Cookie、token 或凭据。",
    candidateNote: "这是一次具体真实环境的运行证据。对外宣称 Provider 兼容前仍应由维护者复核。",
    incompleteNote: "至少还有一项真实运行门槛未满足。可以导出用于排错，但不能当作 Gate B 成功证据。",
    demoNote: "这里只是确定性的 UI 演示，永远不能算作真实 Provider 验收证据。",
    copiedMarkdown: "✓ 已复制隐私安全的 GitHub Markdown。",
    copiedJson: "✓ 已复制 metadata-only JSON。",
    copyFailed: "复制失败",
  },
} as const;

void bootRealProviderProofUi();

async function bootRealProviderProofUi() {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  await whenDomReady();
  const host = document.createElement("section") as ProofHost;
  host.id = "chatchat-real-provider-proof";
  host.dataset.proofPrivacy = "metadata-only";
  host.hidden = true;
  host.innerHTML = `
    <style>
      #chatchat-real-provider-proof{margin:0 0 14px;color:#253832;font:12px/1.45 ui-sans-serif,system-ui,sans-serif}#chatchat-real-provider-proof[hidden]{display:none!important}
      #chatchat-real-provider-proof .proof-shell{padding:17px;border:1px solid rgba(45,83,70,.14);border-radius:20px;background:linear-gradient(145deg,#f7fbf8,#fffaf1);box-shadow:0 12px 34px rgba(28,63,51,.07)}
      #chatchat-real-provider-proof .proof-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.real-proof-kicker{display:block;color:#708079;font:850 9px/1 system-ui;letter-spacing:.13em}
      #chatchat-real-provider-proof h2{margin:6px 0 4px;font-size:18px;letter-spacing:-.02em}.real-proof-copy{max-width:760px;color:#6e7b76;font-size:10px}.real-proof-verdict{flex:none;padding:7px 9px;border-radius:999px;font:850 9px/1 system-ui;letter-spacing:.04em}
      .real-proof-verdict--gate-b-candidate{background:#dff4e9;color:#245d46}.real-proof-verdict--incomplete{background:#fff0cd;color:#79581a}.real-proof-verdict--demo-only{background:#ece9ff;color:#554589}
      #chatchat-real-provider-proof .real-proof-provider-list{display:grid;gap:7px;margin-top:13px}.real-proof-provider{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid #e2e8e4;border-radius:11px;background:white}
      .real-proof-provider strong{display:block;font-size:11px}.real-proof-provider code{color:#75817d;font-size:9px}.real-proof-gates{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.real-proof-gates span{padding:4px 6px;border-radius:999px;background:#f2e6df;color:#925744;font:800 8px/1 system-ui}.real-proof-gates span.ok{background:#e3f3e9;color:#2b654b}
      .real-proof-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}.real-proof-stat{padding:7px;border-radius:10px;background:#eef4f1;text-align:center}.real-proof-stat b{display:block;font-size:14px}.real-proof-stat span{color:#71817b;font-size:8px}
      .real-proof-actions{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}#chatchat-real-provider-proof button{border:1px solid rgba(38,88,68,.16);border-radius:9px;padding:8px 9px;background:white;color:#245544;font:800 9px/1 system-ui;cursor:pointer}#chatchat-real-provider-proof button.primary{background:#245544;color:white;border-color:#245544}
      .real-proof-privacy{margin-top:9px;padding:8px 9px;border-radius:9px;background:#f5f0e2;color:#6b624d;font-size:9px}.real-proof-notice{margin-top:8px;color:#2b6e53;font-weight:700;font-size:9px}
      @media(max-width:700px){#chatchat-real-provider-proof .proof-head{flex-direction:column}.real-proof-provider{grid-template-columns:1fr}.real-proof-gates{justify-content:flex-start}.real-proof-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
    </style>
    <div class="proof-shell">
      <div class="proof-head"><div><span class="real-proof-kicker"></span><h2></h2><div class="real-proof-copy"></div></div><span class="real-proof-verdict">WAITING</span></div>
      <div class="real-proof-provider-list"></div><div class="real-proof-stats"></div>
      <div class="real-proof-actions"><button type="button" class="primary" data-action="markdown"></button><button type="button" data-action="json"></button></div>
      <div class="real-proof-privacy"></div><div class="real-proof-notice" role="status"></div>
    </div>`;
  document.body.appendChild(host);
  void placeInProduct(host);

  host.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "markdown") void copyCurrent(host, "markdown");
    if (action === "json") void copyCurrent(host, "json");
  });
  window.addEventListener(BROWSER_GATE_B_PROOF_EVENT, (event) => {
    const pack = (event as CustomEvent<GateBProofPack | null>).detail;
    if (pack) renderProof(host, pack); else resetProof(host);
  });
  new MutationObserver(() => {
    if (host.__gateBPack) renderProof(host, host.__gateBPack);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(BROWSER_GATE_B_PROOF_KEY);
  if (isProofPack(state[BROWSER_GATE_B_PROOF_KEY])) renderProof(host, state[BROWSER_GATE_B_PROOF_KEY]);
}

function renderProof(host: ProofHost, pack: GateBProofPack) {
  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const copy = COPY[locale];
  host.hidden = false;
  host.__gateBPack = pack;
  host.dataset.gateBVerdict = pack.verdict;
  host.dataset.gateBProviders = String(pack.providers.length);
  host.dataset.gateBRounds = String(pack.council?.rounds ?? 0);
  host.dataset.gateBUncertain = String(pack.council?.eventKinds.uncertain ?? 0);
  host.querySelector<HTMLElement>(".real-proof-kicker")!.textContent = copy.kicker;
  host.querySelector<HTMLElement>("h2")!.textContent = copy.title;
  host.querySelector<HTMLElement>(".real-proof-copy")!.textContent = copy.body;
  host.querySelector<HTMLButtonElement>('[data-action="markdown"]')!.textContent = copy.copyMarkdown;
  host.querySelector<HTMLButtonElement>('[data-action="json"]')!.textContent = copy.copyJson;
  host.querySelector<HTMLElement>(".real-proof-privacy")!.textContent = copy.privacy;

  const verdict = host.querySelector<HTMLElement>(".real-proof-verdict")!;
  verdict.className = `real-proof-verdict real-proof-verdict--${pack.verdict}`;
  verdict.textContent = pack.verdict === "gate-b-candidate"
    ? copy.candidate
    : pack.verdict === "demo-only"
      ? copy.demo
      : copy.incomplete;

  const providers = host.querySelector<HTMLElement>(".real-proof-provider-list")!;
  providers.replaceChildren();
  for (const provider of pack.providers) {
    const row = document.createElement("div");
    row.className = "real-proof-provider";
    row.innerHTML = `<div><strong>${escapeHtml(provider.providerId)}</strong><code>${escapeHtml(provider.host)}</code></div><div class="real-proof-gates">${gate(copy.pageMap, provider.recipeReady)}${gate(copy.connection, provider.testPassed)}${gate(copy.protocol, provider.councilGatePassed)}${gate(copy.host, provider.providerHostHealthy)}${gate(copy.inRoom, provider.seated)}</div>`;
    providers.appendChild(row);
  }

  const c = pack.council;
  host.querySelector<HTMLElement>(".real-proof-stats")!.innerHTML = c
    ? [
        stat(copy.real, c.realParticipantCount),
        stat(copy.rounds, c.rounds),
        stat(copy.events, c.realEventCount),
        stat(copy.uncertain, c.eventKinds.uncertain),
        stat(copy.final, c.finalPositionCount),
        stat(copy.fallback, c.zeroConfidenceFinalCount),
        stat(copy.challenge, c.eventKinds.challenge),
        stat(copy.revision, c.eventKinds.revision),
      ].join("")
    : stat(copy.events, "—");

  host.querySelector<HTMLElement>(".real-proof-notice")!.textContent = pack.verdict === "gate-b-candidate"
    ? copy.candidateNote
    : pack.verdict === "demo-only"
      ? copy.demoNote
      : copy.incompleteNote;
}

function resetProof(host: ProofHost) {
  host.hidden = true;
  delete host.dataset.gateBVerdict;
  delete host.dataset.gateBProviders;
  delete host.dataset.gateBRounds;
  delete host.dataset.gateBUncertain;
  delete host.__gateBPack;
}

async function copyCurrent(host: ProofHost, format: "markdown" | "json") {
  const pack = host.__gateBPack;
  if (!pack) return;
  const locale: Locale = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  const copy = COPY[locale];
  const text = format === "markdown" ? gateBProofMarkdown(pack) : gateBProofJson(pack);
  const notice = host.querySelector<HTMLElement>(".real-proof-notice")!;
  try {
    await copyText(text);
    notice.textContent = format === "markdown" ? copy.copiedMarkdown : copy.copiedJson;
  } catch (caught) {
    notice.textContent = `${copy.copyFailed}: ${caught instanceof Error ? caught.message : String(caught)}`;
  }
}

function gate(label: string, ok: boolean) {
  return `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "×"} ${escapeHtml(label)}</span>`;
}

function stat(label: string, value: string | number) {
  return `<div class="real-proof-stat"><b>${escapeHtml(String(value))}</b><span>${escapeHtml(label)}</span></div>`;
}

async function placeInProduct(host: HTMLElement) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const setup = document.querySelector<HTMLElement>(".consultation-app .setup-card");
    const app = setup?.parentElement ?? document.querySelector<HTMLElement>(".consultation-app");
    if (app) {
      if (setup?.parentElement === app) app.insertBefore(host, setup);
      else app.append(host);
      return;
    }
    await sleep(50);
  }
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

function whenDomReady() {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
