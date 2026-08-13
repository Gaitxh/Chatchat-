(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "onboarding") return;

  const act = params.get("act") || "scan";
  document.documentElement.dataset.chatchatOnboardingShowcase = "booted";
  document.documentElement.dataset.chatchatOnboardingShowcaseAct = act;

  // Reuse the existing synthetic seven-open-AI-tab browser harness. The
  // onboarding companion receives its own act selector separately.
  history.replaceState(
    null,
    "",
    `${location.pathname}?showcase=summon&onboarding=1&onboardingAct=${encodeURIComponent(act)}`,
  );
})();
