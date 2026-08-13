(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("showcase") !== "chronicle") return;

  document.documentElement.dataset.chatchatChronicleShowcase = "booted";
  history.replaceState(null, "", `${location.pathname}?showcase=1&chronicle=1`);

  let clicked = false;
  const attemptReplay = () => {
    if (clicked) return;
    const chronicle = document.getElementById("chatchat-browser-court-chronicle");
    const button = chronicle?.querySelector(
      'button[data-chronicle-replay]',
    );
    if (!(button instanceof HTMLButtonElement)) return;
    clicked = true;
    button.click();
  };

  const markArchive = () => {
    const theater = document.getElementById("chatchat-browser-council-theater");
    if (theater?.dataset.theaterSource !== "archive") return;
    document.documentElement.dataset.chatchatChronicleReplayed = "true";
  };

  const observer = new MutationObserver(() => {
    attemptReplay();
    markArchive();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-theater-source", "data-chronicle-entries"],
  });
  window.setTimeout(attemptReplay, 0);
})();
