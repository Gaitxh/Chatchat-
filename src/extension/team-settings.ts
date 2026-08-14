type Locale = "en" | "zh-CN";

const ROOT_ID = "team-settings-root";
const OPEN_DATASET_VALUE = "open";

const COPY = {
  en: {
    kicker: "AI TEAM",
    title: "Change AI team",
    hint: "ChatChat manages this automatically. Open this only when you want to add, remove, or repair an AI participant.",
    closed: "Automatic by default",
    open: "Team controls open",
  },
  "zh-CN": {
    kicker: "AI 团队",
    title: "调整 AI 团队",
    hint: "ChatChat 默认会自动管理这里。只有想添加、移除或修复某位 AI 参与者时，才需要打开这些控制。",
    closed: "默认自动管理",
    open: "团队控制已展开",
  },
} as const;

if (document.documentElement.dataset.surface === "web-app") install();

function install(): void {
  const root = ensureRoot();
  const details = document.createElement("details");
  details.className = "team-settings-disclosure";
  details.dataset.chatchatTeamSettings = "true";

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  const kicker = document.createElement("small");
  const title = document.createElement("strong");
  const state = document.createElement("em");
  label.append(kicker, title);
  summary.append(label, state);

  const hint = document.createElement("p");
  hint.className = "team-settings-hint";
  details.append(summary, hint);
  root.replaceChildren(details);

  const syncCopy = () => {
    const locale = currentLocale();
    const copy = COPY[locale];
    kicker.textContent = copy.kicker;
    title.textContent = copy.title;
    hint.textContent = copy.hint;
    state.textContent = details.open ? copy.open : copy.closed;
    details.setAttribute("aria-label", copy.title);
  };

  const syncOpenState = () => {
    if (details.open) document.documentElement.dataset.chatchatTeamEdit = OPEN_DATASET_VALUE;
    else delete document.documentElement.dataset.chatchatTeamEdit;
    syncCopy();
  };

  const mount = () => {
    const participants = document.querySelector(".consultation-app .participants-card");
    if (!(participants instanceof HTMLElement) || !participants.parentElement) {
      root.hidden = true;
      return;
    }

    if (root.parentElement !== participants.parentElement || root.previousElementSibling !== participants) {
      participants.insertAdjacentElement("afterend", root);
    }
    root.hidden = document.documentElement.dataset.chatchatOnboarding === "zero-config";
    syncCopy();
  };

  details.addEventListener("toggle", syncOpenState);
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["lang", "data-chatchat-onboarding"],
  });

  syncOpenState();
  mount();
}

function ensureRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.hidden = true;
  document.body.append(root);
  return root;
}

function currentLocale(): Locale {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
