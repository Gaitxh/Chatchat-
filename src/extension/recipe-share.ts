import {
  adapterRecipeComplete,
  analyzeRecipeCandidate,
  detectProviderUrl,
  exportRecipeCandidate,
  parseRecipeCandidate,
  recipeCandidateJson,
  recipeCandidateToAdapterRecipe,
  type AdapterRecipe,
  type RecipeCandidateV1,
} from "../provider-sdk/index.js";

declare const chrome: any;

const SEATS_KEY = "chatchat.extension.seats.v1";
const RECIPES_KEY = "chatchat.extension.recipes.v1";

interface ExtensionSeat {
  seatId: string;
  origin: string;
  providerId: string;
  providerName?: string;
}

interface RecipeMap {
  [origin: string]: AdapterRecipe;
}

void bootRecipeShare();

async function bootRecipeShare() {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  if (new URLSearchParams(location.search).get("showcase") === "1") return;
  await whenDomReady();

  const host = document.createElement("div");
  host.id = "chatchat-recipe-share";
  host.dataset.recipeTrust = "map-only";
  host.dataset.recipeImportEffect = "test-required";
  host.innerHTML = `
    <style>
      #chatchat-recipe-share { margin: 8px 10px 0; color:#173b32; font:12px/1.35 ui-sans-serif,system-ui,sans-serif; }
      #chatchat-recipe-share .recipe-share-bar { display:none; align-items:center; gap:8px; padding:9px 10px; border:1px solid rgba(91,72,36,.16); border-radius:14px; background:rgba(255,252,244,.96); box-shadow:0 8px 24px rgba(71,55,25,.08); }
      #chatchat-recipe-share .recipe-share-bar.is-visible { display:flex; }
      #chatchat-recipe-share .recipe-share-copy { min-width:0; flex:1; }
      #chatchat-recipe-share .recipe-share-copy strong { display:block; }
      #chatchat-recipe-share .recipe-share-copy span { display:block; margin-top:2px; color:#75684e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #chatchat-recipe-share button { border:1px solid rgba(58,77,65,.16); border-radius:9px; padding:7px 9px; background:white; color:#244c3f; font:700 10px/1 system-ui,sans-serif; cursor:pointer; }
      #chatchat-recipe-share button.primary { background:#244c3f; color:white; border-color:#244c3f; }
      #chatchat-recipe-share button:disabled { opacity:.5; cursor:not-allowed; }
      #chatchat-recipe-share .recipe-modal-backdrop { position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center; padding:18px; background:rgba(18,31,27,.5); backdrop-filter:blur(5px); }
      #chatchat-recipe-share .recipe-modal { width:min(620px,100%); max-height:88vh; overflow:auto; padding:16px; border-radius:18px; background:#fffdf7; box-shadow:0 22px 70px rgba(20,35,30,.28); }
      #chatchat-recipe-share .recipe-modal h2 { margin:0; font-size:17px; }
      #chatchat-recipe-share .recipe-modal p { color:#6a6252; }
      #chatchat-recipe-share textarea { width:100%; min-height:180px; box-sizing:border-box; resize:vertical; padding:10px; border:1px solid #d8d2c4; border-radius:10px; background:white; color:#24342f; font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
      #chatchat-recipe-share .recipe-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
      #chatchat-recipe-share .recipe-preview { margin-top:12px; padding:11px; border:1px solid #ded8c9; border-radius:12px; background:white; }
      #chatchat-recipe-share .recipe-preview header { display:flex; justify-content:space-between; gap:8px; align-items:center; }
      #chatchat-recipe-share .recipe-risk { padding:4px 7px; border-radius:999px; font:800 9px/1 system-ui,sans-serif; letter-spacing:.04em; }
      #chatchat-recipe-share .recipe-risk--stable { background:#e5f5ec; color:#276047; }
      #chatchat-recipe-share .recipe-risk--caution { background:#fff0c9; color:#795919; }
      #chatchat-recipe-share .recipe-risk--brittle { background:#ffe1d9; color:#8a4235; }
      #chatchat-recipe-share .recipe-selectors { display:grid; gap:7px; margin-top:10px; }
      #chatchat-recipe-share .recipe-selectors div { display:grid; grid-template-columns:70px minmax(0,1fr); gap:7px; align-items:start; }
      #chatchat-recipe-share code { overflow-wrap:anywhere; color:#44544e; font-size:10px; }
      #chatchat-recipe-share .recipe-warning { margin-top:9px; padding:8px; border-radius:9px; background:#fff3d6; color:#76581e; }
      #chatchat-recipe-share .recipe-error { margin-top:9px; color:#a3473f; font-weight:700; }
      #chatchat-recipe-share .recipe-note { margin-top:8px; color:#6e6657; font-size:10px; }
    </style>
    <div class="recipe-share-bar">
      <div class="recipe-share-copy">
        <strong>🗺 COMMUNITY RECIPE · 地图共享</strong>
        <span>Share selectors, never Test/Gate trust.</span>
      </div>
      <button type="button" data-action="open">COPY / IMPORT</button>
    </div>
  `;
  document.body.prepend(host);

  const bar = host.querySelector<HTMLElement>(".recipe-share-bar")!;
  const openButton = host.querySelector<HTMLButtonElement>("[data-action=open]")!;
  const seats = await loadSeats();
  if (!seats.length) return;
  bar.classList.add("is-visible");
  host.dataset.recipeOrigins = String(uniqueOrigins(seats).length);
  openButton.addEventListener("click", () => void openRecipeModal(host));
}

async function openRecipeModal(host: HTMLElement) {
  host.querySelector(".recipe-modal-backdrop")?.remove();
  const seats = await loadSeats();
  const recipes = await loadRecipes();
  const origins = uniqueOrigins(seats);
  const defaultOrigin = origins[0] ?? "";
  const existing = defaultOrigin ? recipes[defaultOrigin] : undefined;
  const modal = document.createElement("div");
  modal.className = "recipe-modal-backdrop";
  modal.innerHTML = `
    <section class="recipe-modal" role="dialog" aria-modal="true" aria-label="Community Recipe Candidate">
      <h2>🗺 Community Recipe Candidate</h2>
      <p><strong>Share the map, not the passport.</strong> 导入只写 Composer / Send / Response 定位；Test Speech 与 Council Gate 不会被导入。</p>
      <label>Target Provider origin
        <select data-field="origin">${origins.map((origin) => `<option value="${escapeHtml(origin)}">${escapeHtml(origin)}</option>`).join("")}</select>
      </label>
      <div class="recipe-actions">
        <button type="button" data-action="export" ${existing && adapterRecipeComplete(existing) ? "" : "disabled"}>COPY CURRENT RECIPE</button>
        <button type="button" data-action="close">关闭</button>
      </div>
      <p class="recipe-note">capturedAt 只是 selector 地图捕获日期，不是 Test/Gate 证据。</p>
      <textarea data-field="json" spellcheck="false" placeholder='粘贴 Recipe Candidate v1 JSON…'></textarea>
      <div class="recipe-actions">
        <button type="button" data-action="preview">PREVIEW IMPORT</button>
      </div>
      <div data-area="preview"></div>
      <div data-area="message"></div>
    </section>
  `;
  host.appendChild(modal);

  const originSelect = modal.querySelector<HTMLSelectElement>("[data-field=origin]")!;
  const json = modal.querySelector<HTMLTextAreaElement>("[data-field=json]")!;
  const previewArea = modal.querySelector<HTMLElement>("[data-area=preview]")!;
  const messageArea = modal.querySelector<HTMLElement>("[data-area=message]")!;
  const exportButton = modal.querySelector<HTMLButtonElement>("[data-action=export]")!;

  const refreshExport = () => {
    const recipe = recipes[originSelect.value];
    exportButton.disabled = !adapterRecipeComplete(recipe);
  };
  originSelect.addEventListener("change", refreshExport);

  modal.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "close") {
      modal.remove();
      return;
    }
    if (action === "export") {
      void exportCurrent(originSelect.value, recipes, json, messageArea);
      return;
    }
    if (action === "preview") {
      renderImportPreview(originSelect.value, json.value, previewArea, messageArea, recipes);
    }
  });

  modal.addEventListener("mousedown", (event) => {
    if (event.target === modal) modal.remove();
  });
}

async function exportCurrent(
  origin: string,
  recipes: RecipeMap,
  textarea: HTMLTextAreaElement,
  message: HTMLElement,
) {
  const recipe = recipes[origin];
  if (!adapterRecipeComplete(recipe)) {
    showMessage(message, "当前 origin 还没有完整 3/3 Recipe。", true);
    return;
  }
  const detection = detectProviderUrl(origin);
  const candidate = exportRecipeCandidate({
    providerId: detection.providerId,
    origin,
    recipe,
  });
  const text = recipeCandidateJson(candidate);
  textarea.value = text;
  try {
    await copyText(text);
    showMessage(message, "✓ Recipe Candidate JSON 已复制。它不包含 Test/Gate 状态。", false);
  } catch {
    showMessage(message, "Recipe 已放入文本框；系统剪贴板不可用，请手动复制。", false);
  }
}

function renderImportPreview(
  selectedOrigin: string,
  raw: string,
  preview: HTMLElement,
  message: HTMLElement,
  recipes: RecipeMap,
) {
  preview.replaceChildren();
  message.replaceChildren();
  let candidate: RecipeCandidateV1;
  try {
    candidate = parseRecipeCandidate(raw);
  } catch (caught) {
    showMessage(message, caught instanceof Error ? caught.message : String(caught), true);
    return;
  }
  if (candidate.origin !== selectedOrigin) {
    showMessage(message, `Candidate origin ${candidate.origin} 与选中的 ${selectedOrigin} 不一致。`, true);
    return;
  }

  const analysis = analyzeRecipeCandidate(candidate);
  const card = document.createElement("div");
  card.className = "recipe-preview";
  card.dataset.recipeCandidateLevel = analysis.level;
  card.dataset.recipeCandidateTrust = "test-required";
  card.innerHTML = `
    <header>
      <div><strong>${escapeHtml(candidate.providerId)}</strong><br><code>${escapeHtml(candidate.origin)}</code></div>
      <span class="recipe-risk recipe-risk--${analysis.level}">${analysis.level.toUpperCase()} · ${analysis.score}/100</span>
    </header>
    <div class="recipe-selectors">
      <div><b>Composer</b><code>${escapeHtml(candidate.composerSelector)}</code></div>
      <div><b>Send</b><code>${escapeHtml(candidate.sendSelector)}</code></div>
      <div><b>Response</b><code>${escapeHtml(candidate.responseSelector)}</code></div>
    </div>
    ${analysis.warnings.length ? `<div class="recipe-warning">⚠ ${analysis.warnings.map(escapeHtml).join(" · ")}</div>` : ""}
    <p class="recipe-note">Captured ${escapeHtml(candidate.capturedAt)} · 导入后所有该 origin 席位仍需重新 Test Speech + Council Gate。</p>
    <div class="recipe-actions"><button type="button" class="primary" data-action="confirm-import">IMPORT · TEST REQUIRED</button></div>
  `;
  preview.appendChild(card);
  card.querySelector<HTMLButtonElement>("[data-action=confirm-import]")!.addEventListener("click", async () => {
    try {
      const targetDetection = detectProviderUrl(selectedOrigin);
      const imported = recipeCandidateToAdapterRecipe(candidate, {
        providerId: targetDetection.providerId,
        origin: selectedOrigin,
        profileId: selectedOrigin,
      });
      const store = chrome.storage.local;
      const next = { ...recipes, [selectedOrigin]: imported };
      await store.set({ [RECIPES_KEY]: next });
      showMessage(message, "✓ Candidate 已作为本地地图导入。正在重载；Test/Gate 将保持未验证。", false);
      window.setTimeout(() => location.reload(), 650);
    } catch (caught) {
      showMessage(message, caught instanceof Error ? caught.message : String(caught), true);
    }
  });
}

async function loadSeats(): Promise<ExtensionSeat[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const state = await store.get(SEATS_KEY);
  return Array.isArray(state[SEATS_KEY]) ? state[SEATS_KEY] : [];
}

async function loadRecipes(): Promise<RecipeMap> {
  const state = await chrome.storage.local.get(RECIPES_KEY);
  return state[RECIPES_KEY] && typeof state[RECIPES_KEY] === "object"
    ? state[RECIPES_KEY]
    : {};
}

function uniqueOrigins(seats: readonly ExtensionSeat[]): string[] {
  return [...new Set(seats.map((seat) => seat.origin).filter(Boolean))].sort();
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

function showMessage(host: HTMLElement, text: string, isError: boolean) {
  host.textContent = text;
  host.className = isError ? "recipe-error" : "recipe-note";
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
