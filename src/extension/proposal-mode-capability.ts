import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilConsultationMode,
  CouncilRunOptions,
} from "../core/types.js";
import { applyConsultationModePolicy } from "../consultation/mode-options.js";
import {
  isConsultationMode,
  PROPOSAL_MODE_CHANGED_EVENT,
  PROPOSAL_MODE_STORAGE_KEY,
  type ProposalModeSelectionDetail,
} from "./proposal-mode-wire.js";

declare const chrome: any;

const PATCH_MARKER = "__chatchatProposalModeCapabilityV1" as const;
const DEFAULT_MODE: CouncilConsultationMode = "balanced";

type ModePrototype = typeof CouncilOrchestrator.prototype & {
  [PATCH_MARKER]?: true;
};

let currentMode: CouncilConsultationMode = DEFAULT_MODE;
void restoreMode();
installProposalModeCapability();
window.addEventListener(PROPOSAL_MODE_CHANGED_EVENT, (event: Event) => {
  const mode = (event as CustomEvent<ProposalModeSelectionDetail>).detail?.mode;
  if (isConsultationMode(mode)) currentMode = mode;
});

async function restoreMode(): Promise<void> {
  try {
    const value = await chrome.storage.local.get(PROPOSAL_MODE_STORAGE_KEY);
    const stored = value[PROPOSAL_MODE_STORAGE_KEY];
    if (isConsultationMode(stored)) currentMode = stored;
  } catch {
    currentMode = DEFAULT_MODE;
  }
}

function installProposalModeCapability(): void {
  const prototype = CouncilOrchestrator.prototype as ModePrototype;
  if (prototype[PATCH_MARKER]) return;
  prototype[PATCH_MARKER] = true;

  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = (async function (
    this: CouncilOrchestrator,
    question: string,
    options: CouncilRunOptions = {},
  ) {
    const mode = options.mode ?? currentMode;
    return originalRun.call(this, question, applyConsultationModePolicy(mode, options));
  }) as typeof originalRun;
}
