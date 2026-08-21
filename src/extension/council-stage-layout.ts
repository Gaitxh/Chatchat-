const INTELLIGENCE_ZONE_ID = "council-intelligence-zone";
const INTELLIGENCE_ROOT_IDS = ["research-roster-root", "investigation-trail-root"] as const;

const zone = document.getElementById(INTELLIGENCE_ZONE_ID);

if (zone) {
  placeIntelligenceZone();

  const observer = new MutationObserver(() => placeIntelligenceZone());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function placeIntelligenceZone() {
  if (!zone) return;

  const intelligenceRoots = INTELLIGENCE_ROOT_IDS
    .map((id) => document.getElementById(id))
    .filter((root): root is HTMLElement => root instanceof HTMLElement);

  for (const root of intelligenceRoots) {
    if (root.parentElement !== zone) zone.append(root);
  }

  const hasVisibleIntelligence = intelligenceRoots.some((root) => root.childElementCount > 0);
  zone.dataset.councilIntelligence = hasVisibleIntelligence ? "visible" : "empty";
  if (!hasVisibleIntelligence) return;

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