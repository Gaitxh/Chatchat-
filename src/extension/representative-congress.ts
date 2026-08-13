const PATCH_MARKER = "__CHATCHAT_REPRESENTATIVE_CONGRESS_V1__";
const STYLE_ID = "chatchat-representative-congress-style";

const runtime = globalThis as typeof globalThis & Record<string, unknown>;

if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  injectStyles();
  installCongressUi();
}

function installCongressUi() {
  const enhance = () => {
    enhanceHouseIdentity();
    enhanceDelegationQuotaRows();
    enhanceOnboardingQuotaGroups();
  };
  enhance();
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhance();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function enhanceHouseIdentity() {
  const card = document.querySelector<HTMLElement>(".delegates-card");
  if (!card) return;
  const kicker = card.querySelector<HTMLElement>(".section-kicker");
  const title = card.querySelector<HTMLElement>(".section-head h2");
  if (kicker && kicker.dataset.congressRenamed !== "true") {
    kicker.textContent = "AI REPRESENTATIVE CONGRESS";
    kicker.dataset.congressRenamed = "true";
  }
  if (title && title.dataset.congressRenamed !== "true") {
    title.textContent = "AI 民主代表大会";
    title.dataset.congressRenamed = "true";
  }

  const emptyStrong = card.querySelector<HTMLElement>(".empty-state strong");
  const emptyCopy = card.querySelector<HTMLElement>(".empty-state p");
  if (emptyStrong && emptyStrong.dataset.congressRenamed !== "true") {
    emptyStrong.textContent = "先邀请第一支 AI 代表团";
    emptyStrong.dataset.congressRenamed = "true";
  }
  if (emptyCopy && emptyCopy.dataset.congressRenamed !== "true") {
    emptyCopy.textContent = "每个模型默认 1 席。需要更多独立代表时，再把该代表团席位配额调高。";
    emptyCopy.dataset.congressRenamed = "true";
  }
}

function enhanceDelegationQuotaRows() {
  document.querySelectorAll<HTMLElement>(".delegation-row").forEach((row) => {
    const stepper = row.querySelector<HTMLElement>(".seat-stepper");
    if (!stepper || stepper.dataset.congressQuota === "true") return;
    stepper.dataset.congressQuota = "true";
    stepper.title = "代表团席位配额：默认 1。每增加 1 席都必须是新的独立 tab / 会话。";
    const label = document.createElement("span");
    label.className = "delegation-quota-label";
    label.textContent = "席位配额";
    stepper.insertAdjacentElement("beforebegin", label);
  });
}

/**
 * Royal Onboarding still owns candidate selection state. This companion only
 * makes the existing checkbox state easier to control as a per-delegation
 * quota and normalizes its initial default to ×1.
 */
function enhanceOnboardingQuotaGroups() {
  document.querySelectorAll<HTMLElement>("#chatchat-royal-onboarding .candidate-group").forEach((group) => {
    const head = group.querySelector<HTMLElement>(".candidate-head");
    if (!head) return;
    const inputs = candidateInputs(group);
    if (!inputs.length) return;

    if (group.dataset.congressQuotaInitialized !== "true") {
      group.dataset.congressQuotaInitialized = "true";
      const checked = inputs.filter((input) => input.checked);
      // Royal Onboarding historically selected every discovered tab. The
      // Congress rule intentionally normalizes first render to one seat per
      // Provider delegation. Dispatching `change` lets the real onboarding
      // state own this update instead of secretly mutating a parallel model.
      checked.slice(1).forEach((input) => {
        input.checked = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return;
    }

    if (head.querySelector(".onboarding-quota-stepper")) return;
    const controls = document.createElement("div");
    controls.className = "onboarding-quota-stepper";
    controls.innerHTML = `
      <small>代表团席位</small>
      <button type="button" data-quota-action="minus" aria-label="减少代表席位">−</button>
      <b>×${inputs.filter((input) => input.checked).length}</b>
      <button type="button" data-quota-action="plus" aria-label="增加代表席位">＋</button>
    `;
    head.appendChild(controls);

    controls.querySelector<HTMLButtonElement>('[data-quota-action="minus"]')?.addEventListener("click", () => {
      const current = candidateInputs(group).filter((input) => input.checked);
      const target = current.at(-1);
      if (!target) return;
      target.checked = false;
      target.dispatchEvent(new Event("change", { bubbles: true }));
    });

    controls.querySelector<HTMLButtonElement>('[data-quota-action="plus"]')?.addEventListener("click", () => {
      const target = candidateInputs(group).find((input) => !input.checked);
      if (!target) return;
      target.checked = true;
      target.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function candidateInputs(group: Element): HTMLInputElement[] {
  return [...group.querySelectorAll<HTMLInputElement>('input[data-candidate-tab]')]
    .sort((a, b) => Number(a.dataset.candidateTab) - Number(b.dataset.candidateTab));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .delegation-quota-label{margin-left:auto;margin-right:4px;font-size:7px;font-weight:800;letter-spacing:.04em;color:#7d9188;background:#eef5f1;border-radius:999px;padding:3px 5px;white-space:nowrap}.onboarding-quota-stepper{margin-left:auto;display:flex;align-items:center;gap:3px}.onboarding-quota-stepper small{font-size:7px;color:#7d9188;margin-right:2px}.onboarding-quota-stepper button{width:21px;height:21px;border:1px solid #d6e2dc;border-radius:7px;background:#fff;color:#315947;font:800 12px/1 system-ui;cursor:pointer;padding:0}.onboarding-quota-stepper b{min-width:24px;text-align:center;font-size:9px;color:#244d3b}.candidate-head>span{display:none}
  `;
  document.head.appendChild(style);
}
