import { CouncilOrchestrator } from "../core/orchestrator.js";
import type { AdapterRecipe } from "../provider-sdk/recipe.js";
import {
  buildGateBProofPack,
  coarsePlatformHint,
  type GateBProofPack,
} from "../validation/proof-pack.js";
import {
  captureReadyBrowserConsultationProviderProof,
  participantStillOnProviderOrigin,
  type BrowserConsultationProofParticipant,
} from "./gate-b.js";

declare const chrome: any;
declare const __CHATCHAT_VERSION__: string;

export const BROWSER_GATE_B_PROOF_KEY = "chatchat.extension.gate-b-proof.v1";
export const BROWSER_GATE_B_PROOF_EVENT = "chatchat:browser-gate-b-proof";

const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
const CONNECTIONS_KEY = "chatchat.consultation.connections.v1";
const RECIPES_KEY = "chatchat.extension.recipes.v1";
const PATCH_MARKER = "__CHATCHAT_CURRENT_GATE_B_OBSERVER_PATCHED_V2__";

interface StoredParticipant extends BrowserConsultationProofParticipant {
  tabId: number;
  providerName?: string;
}

interface StoredConnection {
  state?: "idle" | "connecting" | "ready" | "failed";
  automatic?: boolean;
  verifiedAt?: string;
}

const runtime = globalThis as typeof globalThis & Record<string, unknown>;
if (!runtime[PATCH_MARKER]) {
  runtime[PATCH_MARKER] = true;
  installConsultationProofObserver();
}

function installConsultationProofObserver() {
  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = async function observedConsultationRun(
    this: CouncilOrchestrator,
    ...args: Parameters<CouncilOrchestrator["run"]>
  ): ReturnType<CouncilOrchestrator["run"]> {
    if (isRealExtensionRuntime()) {
      try {
        await clearBrowserGateBProof();
      } catch (caught) {
        console.warn("ChatChat could not clear stale Real Provider Proof.", caught);
      }
    }

    const result = await originalRun.apply(this, args);
    if (!isRealExtensionRuntime()) return result;

    try {
      await freezeBrowserGateBProof(result.report, result.blackboard.events);
    } catch (caught) {
      // Proof is a read-only observer. It may fail to record evidence; it may
      // never rewrite or fail an already-completed consultation.
      console.warn("ChatChat could not freeze Real Provider Proof.", caught);
    }
    return result;
  } as CouncilOrchestrator["run"];
}

function isRealExtensionRuntime(): boolean {
  return typeof location !== "undefined" && location.protocol === "chrome-extension:";
}

async function clearBrowserGateBProof(): Promise<void> {
  const store = chrome.storage.session ?? chrome.storage.local;
  await store.remove(BROWSER_GATE_B_PROOF_KEY);
  window.dispatchEvent(
    new CustomEvent<GateBProofPack | null>(BROWSER_GATE_B_PROOF_EVENT, { detail: null }),
  );
}

async function freezeBrowserGateBProof(
  report: Awaited<ReturnType<CouncilOrchestrator["run"]>>["report"],
  events: Awaited<ReturnType<CouncilOrchestrator["run"]>>["blackboard"]["events"],
): Promise<void> {
  if (report.positions.length < 2) return;

  const sessionStore = chrome.storage.session ?? chrome.storage.local;
  const [participantState, connectionState, recipeState] = await Promise.all([
    sessionStore.get(PARTICIPANTS_KEY),
    sessionStore.get(CONNECTIONS_KEY),
    chrome.storage.local.get(RECIPES_KEY),
  ]);

  const storedParticipants = Array.isArray(participantState[PARTICIPANTS_KEY])
    ? (participantState[PARTICIPANTS_KEY] as StoredParticipant[])
    : [];
  const connections = isConnectionMap(connectionState[CONNECTIONS_KEY])
    ? (connectionState[CONNECTIONS_KEY] as Record<string, StoredConnection>)
    : {};
  const recipes = isRecipeMap(recipeState[RECIPES_KEY])
    ? (recipeState[RECIPES_KEY] as Record<string, AdapterRecipe>)
    : {};

  const bySeatId = new Map(storedParticipants.map((participant) => [participant.seatId, participant]));
  const matchedParticipants: StoredParticipant[] = [];
  for (const position of report.positions) {
    const participant = bySeatId.get(position.participant.id);
    if (!participant) return;
    matchedParticipants.push(participant);
  }
  if (matchedParticipants.length < 2) return;

  const readySeatIds = matchedParticipants
    .filter((participant) => connections[participant.seatId]?.state === "ready")
    .map((participant) => participant.seatId);
  const providerHostSeatIds: string[] = [];

  for (const participant of matchedParticipants) {
    try {
      const tab = await chrome.tabs.get(participant.tabId);
      if (participantStillOnProviderOrigin(participant.origin, tab?.url)) {
        providerHostSeatIds.push(participant.seatId);
      }
    } catch {
      // A missing/closed/off-origin tab is deliberately unhealthy evidence.
    }
  }

  const providers = captureReadyBrowserConsultationProviderProof({
    participants: matchedParticipants,
    recipes,
    readySeatIds,
    providerHostSeatIds,
  });
  const surface = document.documentElement.dataset.surface === "web-app"
    ? "Full Room"
    : "Side Panel";
  const pack = buildGateBProofPack({
    providers,
    report,
    events: [...events],
    mode: "live",
    chatChatVersion: __CHATCHAT_VERSION__,
    environment: `Chromium ${surface} · ${coarsePlatformHint(navigator.userAgent)}`,
  });

  await sessionStore.set({ [BROWSER_GATE_B_PROOF_KEY]: pack });
  window.dispatchEvent(
    new CustomEvent<GateBProofPack | null>(BROWSER_GATE_B_PROOF_EVENT, { detail: pack }),
  );
}

function isRecipeMap(value: unknown): value is Record<string, AdapterRecipe> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConnectionMap(value: unknown): value is Record<string, StoredConnection> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
