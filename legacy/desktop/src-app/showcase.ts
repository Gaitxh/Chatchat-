const SHOWCASE_QUERY = "theater";
const MAX_BOOT_ATTEMPTS = 80;

/**
 * Deterministic, visibly-labelled Mock showcase for README screenshots and UI
 * reproduction. It never creates Provider profiles and never calls a real AI.
 */
export function startShowcaseFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("showcase") !== SHOWCASE_QUERY) return;

  document.documentElement.dataset.chatchatShowcase = SHOWCASE_QUERY;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const button = document.querySelector<HTMLButtonElement>(
      '.royal-command button[type="submit"]',
    );
    if (button && !button.disabled) {
      window.clearInterval(timer);
      button.click();
      return;
    }
    if (attempts >= MAX_BOOT_ATTEMPTS) {
      window.clearInterval(timer);
      console.warn("ChatChat showcase could not start the deterministic Mock Council.");
    }
  }, 100);
}
