import { CouncilOrchestrator } from "../core/orchestrator.js";
import type { AdapterRecipe } from "../provider-sdk/recipe.js";
import {
  buildGateBProofPack,
  coarsePlatformHint,
  type GateBProofPack,
} from "../validation/proof-pack.js";
import {
  captureAdmittedBrowserHouseProviderProof,
  seatStillOnProviderOrigin,
  type BrowserHouseProofSeat,
} from "./gate-b.js";

declare const chrome: any;
declare const __CHATCHAT_VERSION__: string;

export const BROWSER_GATE_B_PROOF_KEY = "chatchat.extension.gate-b-proof.v1";
export const BROWSER_GATE_B_PROOF_EVENT = "chatchat:browser-gate-b-proof";

const SEATS_KEY = "chatchat.extension.seats.v1";
const RECIPES_KEY = "chatchat.extension.recipes.v1";
const PATCH_MARKER = "__CHATCHAT_GATE_B_OBSERVER_PATCHED_V1__";

interface StoredSeat extends BrowserHouseProofSeat {
  tabId: number;
}

const runtime = globalThis as typeof globalThis & Record<string, unknown>;
if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  installCouncilProofObserver();
}

function installCouncilProofObserver() {
  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = async function observedCouncilRun(
    this: CouncilOrchestrator,
    ...args: Parameters<CouncilOrchestrator["run"]>
  ): ReturnType<CouncilOrchestrator["run"]> {
    const result = await originalRun.apply(this, args);
    try {
      await freezeBrowserGateBProof(result.report, result.blackboard.events);
    } catch (caught) {
      // Proof capture is an observer. A failure here must never rewrite or
      // invalidate the already-completed Council itself.
      console.warn("ChatChat could not freeze Browser Gate B proof.", caught);
    }
    return result;
  } as CouncilOrchestrator["run"];
}

async function freezeBrowserGateBProof(
  report: Awaited<ReturnType<CouncilOrchestrator["run"]>>["report"],
  events: Awaited<ReturnType<CouncilOrchestrator["run"]>>["blackboard"]["events"],
): Promise<void> {
  const participantIds = report.positions
    .filter((position) => position.participant.role === "Browser Tab Delegate")
    .map((position) => position.participant.id);

  // This module is loaded only in the Browser Side Panel, but still refuse to
  // emit evidence for an unrelated Council shape.
  if (participantIds.length < 2 || participantIds.length !== report.positions.length) return;

  const sessionStore = chrome.storage.session ?? chrome.storage.local;
  const [seatState, recipeState] = await Promise.all([
    sessionStore.get(SEATS_KEY),
    chrome.storage.local.get(RECIPES_KEY),
  ]);
  const storedSeats = Array.isArray(seatState[SEATS_KEY])
    ? (seatState[SEATS_KEY] as StoredSeat[])
    : [];
  const recipes = isRecipeMap(recipeState[RECIPES_KEY])
    ? (recipeState[RECIPES_KEY] as Record<string, AdapterRecipe>)
    : {};

  const participantSet = new Set(participantIds);
  const matchedSeats = storedSeats.filter((seat) => participantSet.has(seat.seatId));
  const healthySeatIds: string[] = [];

  for (const seat of matchedSeats) {
    try {
      const tab = await chrome.tabs.get(seat.tabId);
      if (seatStillOnProviderOrigin(seat.origin, tab?.url)) {
        healthySeatIds.push(seat.seatId);
      }
    } catch {
      // A tab that disappeared after the Council is explicitly unhealthy proof.
    }
  }

  const providers = captureAdmittedBrowserHouseProviderProof({
    seats: matchedSeats,
    recipes,
    providerHostSeatIds: healthySeatIds,
  });
  const pack = buildGateBProofPack({
    providers,
    report,
    events: [...events],
    mode: "live",
    chatChatVersion: __CHATCHAT_VERSION__,
    environment: `Chromium Side Panel · ${coarsePlatformHint(navigator.userAgent)}`,
  });

  await sessionStore.set({ [BROWSER_GATE_B_PROOF_KEY]: pack });
  window.dispatchEvent(
    new CustomEvent<GateBProofPack>(BROWSER_GATE_B_PROOF_EVENT, { detail: pack }),
  );
}

function isRecipeMap(value: unknown): value is Record<string, AdapterRecipe> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
