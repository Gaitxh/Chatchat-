type Locale = "en" | "zh-CN";

const ROOT_ID = "team-settings-root";
const OPEN_DATASET_VALUE = "open";
const INVITE_DATASET_VALUE = "true";

const COPY = {
  en: {
    kicker: "AI TEAM",
    title: "Change AI team",
    hint: "ChatChat manages this automatically. Open this only when you want to remove or repair an AI participant.",
    closed: "Automatic by default",
    open: "Team controls open",
    inviteLabel: "+ Invite AI",
    invitePlaceholder: "Paste any AI website URL",
    inviteAction: "Invite",
    inviteTitle: "Invite an AI by URL. ChatChat will open it, let you sign in if needed, learn the page automatically, and prepare its seat.",
  },
  "zh-CN": {
    kicker: "AI 团队",
    title: "调整 AI 团队",
    hint: "ChatChat 默认会自动管理这里。只有想移除或修复某位 AI 参与者时，才需要打开这些控制。",
    closed: "默认自动管理",
    open: "团队控制已展开",
    inviteLabel: "＋ 邀请 AI",
    invitePlaceholder: "粘贴任意 AI 网站 URL",
    inviteAction: "邀请入席",
    inviteTitle: "通过 URL 邀请一位 AI。ChatChat 会打开网站；需要时你正常登录，之后它会自动识别页面并准备席位。",
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
    setText(kicker, copy.kicker);
    setText(title, copy.title);
    setText(hint, copy.hint);
    setText(state, details.open ? copy.open : copy.closed);
    if (details.getAttribute("aria-label") !== copy.title) {
      details.setAttribute("aria-label", copy.title);
    }
    syncInviteEntry(copy);
  };

  const syncOpenState = () => {
    if (details.open) document.documentElement.dataset.chatchatTeamEdit = OPEN_DATASET_VALUE;
    else delete document.documentElement.dataset.chatchatTeamEdit;
    syncCopy();
  };

  const mount = () => {
    const participants = document.querySelector(".consultation-app .participants-card");
    if (!(participants instanceof HTMLElement) || !participants.parentElement) {
      if (!root.hidden) root.hidden = true;
      return;
    }

    if (root.parentElement !== participants.parentElement || root.previousElementSibling !== participants) {
      participants.insertAdjacentElement("afterend", root);
    }
    const shouldHide = document.documentElement.dataset.chatchatOnboarding === "zero-config";
    if (root.hidden !== shouldHide) root.hidden = shouldHide;
    syncInviteEntry(COPY[currentLocale()]);
  };

  details.addEventListener("toggle", syncOpenState);

  // Keep DOM discovery and copy/state observation separate. Rewriting text from a
  // subtree MutationObserver can otherwise create a self-sustaining mutation loop
  // in Chromium even when the visible copy is unchanged.
  const pageObserver = new MutationObserver(mount);
  pageObserver.observe(document.body, { childList: true, subtree: true });

  const documentStateObserver = new MutationObserver(() => {
    syncCopy();
    mount();
  });
  documentStateObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang", "data-chatchat-onboarding"],
  });

  syncOpenState();
  mount();
}

function syncInviteEntry(copy: (typeof COPY)[Locale]): void {
  const invite = document.querySelector<HTMLElement>(".consultation-app .participants-card > .url-opener");
  if (!invite) return;
  invite.dataset.chatchatInviteAi = INVITE_DATASET_VALUE;
  invite.setAttribute("aria-label", copy.inviteTitle);
  invite.setAttribute("title", copy.inviteTitle);

  const label = invite.querySelector<HTMLLabelElement>("label");
  const input = invite.querySelector<HTMLInputElement>("input");
  const button = invite.querySelector<HTMLButtonElement>("button");
  if (label) setText(label, copy.inviteLabel);
  if (input && input.placeholder !== copy.invitePlaceholder) input.placeholder = copy.invitePlaceholder;
  if (input && input.getAttribute("aria-label") !== copy.inviteTitle) input.setAttribute("aria-label", copy.inviteTitle);
  if (button) setText(button, copy.inviteAction);
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

function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function currentLocale(): Locale {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
