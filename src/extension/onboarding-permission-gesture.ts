declare const chrome: any;

const HOST_ID = "chatchat-royal-onboarding";
const SUMMON_SELECTOR = `#${HOST_ID} button[data-action="summon"]`;
const PRIMED_MARKER = "permissionPrimed";

interface PrimedPermission {
  key: string;
  granted: boolean;
}

if (typeof chrome !== "undefined" && chrome.permissions?.request) {
  installPermissionGestureGuard();
}

/**
 * Chrome requires permissions.request() to originate inside a user gesture.
 *
 * Royal Onboarding does some local state work before its normal summon path
 * reaches permissions.request(), so this guard captures the actual button
 * click, requests the selected origins immediately, then replays the click.
 * The later identical request is satisfied once from the primed grant instead
 * of opening a second prompt outside the transient user activation.
 */
function installPermissionGestureGuard() {
  const originalRequest = chrome.permissions.request.bind(chrome.permissions);
  let primed: PrimedPermission | null = null;

  chrome.permissions.request = async (details: { origins?: string[]; permissions?: string[] }) => {
    const key = permissionKey(details.origins ?? []);
    if (primed && primed.key === key) {
      const result = primed.granted;
      primed = null;
      return result;
    }
    return originalRequest(details);
  };

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>(SUMMON_SELECTOR)
        : null;
      if (!target) return;

      if (target.dataset[PRIMED_MARKER] === "true") {
        delete target.dataset[PRIMED_MARKER];
        return;
      }

      const origins = selectedOriginsFromGuide();
      if (!origins.length) return;

      // Stop the ordinary summon click before any await/storage work can run.
      event.preventDefault();
      event.stopImmediatePropagation();
      setCandidateInputsDisabled(true);
      target.disabled = true;
      target.textContent = "正在请求站点权限…";

      // Crucially: call the real Chrome API synchronously from this click
      // handler, before yielding to another task.
      const grantPromise = originalRequest({ origins });
      void Promise.resolve(grantPromise)
        .then((granted: boolean) => {
          if (!granted) {
            showPermissionMessage("没有授予这些 AI 站点的权限；没有席位被加入。");
            return;
          }
          primed = { key: permissionKey(origins), granted: true };
          target.dataset[PRIMED_MARKER] = "true";
          target.disabled = false;
          target.click();
        })
        .catch((caught: unknown) => {
          showPermissionMessage(caught instanceof Error ? caught.message : String(caught));
        })
        .finally(() => {
          setCandidateInputsDisabled(false);
          target.disabled = false;
          if (!primed) refreshSummonButtonLabel(target);
        });
    },
    true,
  );
}

function selectedOriginsFromGuide(): string[] {
  const origins = new Set<string>();
  document
    .querySelectorAll<HTMLInputElement>(`#${HOST_ID} input[data-candidate-tab]:checked`)
    .forEach((input) => {
      const row = input.closest(".candidate-row");
      const hostname = row?.querySelector("small")?.textContent?.trim().toLocaleLowerCase();
      if (!hostname || !isHostname(hostname)) return;
      origins.add(`https://${hostname}/*`);
    });
  return [...origins].sort();
}

function permissionKey(origins: readonly string[]): string {
  return [...new Set(origins)].sort().join("\n");
}

function setCandidateInputsDisabled(disabled: boolean) {
  document
    .querySelectorAll<HTMLInputElement>(`#${HOST_ID} input[data-candidate-tab]`)
    .forEach((input) => { input.disabled = disabled; });
}

function showPermissionMessage(value: string) {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  let message = host.querySelector<HTMLElement>(".royal-status.permission-guard-status");
  if (!message) {
    message = document.createElement("div");
    message.className = "royal-status permission-guard-status";
    host.appendChild(message);
  }
  message.textContent = value;
}

function refreshSummonButtonLabel(button: HTMLButtonElement) {
  const selected = document.querySelectorAll(
    `#${HOST_ID} input[data-candidate-tab]:checked`,
  ).length;
  button.textContent = `🪑 召集 ${selected} 席`;
}

function isHostname(value: string): boolean {
  return (
    value.length <= 253 &&
    /^[a-z0-9.-]+$/.test(value) &&
    !value.startsWith(".") &&
    !value.endsWith(".") &&
    !value.includes("..")
  );
}
