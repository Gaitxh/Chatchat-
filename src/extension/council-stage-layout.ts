const INTELLIGENCE_ZONE_ID = "council-intelligence-zone";

const zone = document.getElementById(INTELLIGENCE_ZONE_ID);

if (zone) {
  placeIntelligenceZone();

  const observer = new MutationObserver(() => placeIntelligenceZone());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function placeIntelligenceZone() {
  if (!zone) return;

  const outcome = document.querySelector<HTMLElement>(".consultation-app .outcome-card");
  const app = outcome?.parentElement;
  if (!(outcome instanceof HTMLElement) || !(app instanceof HTMLElement)) return;

  const finalPositionRoot = document.getElementById("final-position-floor-root");
  const finalPositionVisible = Boolean(
    finalPositionRoot
      && finalPositionRoot.parentElement === app
      && finalPositionRoot.childElementCount > 0,
  );
  const anchor = finalPositionVisible ? finalPositionRoot : outcome;

  if (anchor.nextElementSibling === zone && zone.parentElement === app) return;
  anchor.insertAdjacentElement("afterend", zone);
}
