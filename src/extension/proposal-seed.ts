import type { CouncilConsultationMode } from "../core/types.js";
import { requestProposalMode } from "./proposal-mode-wire.js";

export function stageProposalInExistingComposer(
  proposal: string,
  mode?: CouncilConsultationMode,
): boolean {
  const textarea = document.querySelector<HTMLTextAreaElement>(".proposal-card textarea");
  if (!textarea || !proposal.trim()) return false;

  if (mode) requestProposalMode(mode, "next-move");

  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(textarea, proposal);
  else textarea.value = proposal;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  textarea.focus({ preventScroll: true });
  textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
