export function stageProposalInExistingComposer(proposal: string): boolean {
  const textarea = document.querySelector<HTMLTextAreaElement>(".proposal-card textarea");
  if (!textarea || !proposal.trim()) return false;

  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(textarea, proposal);
  else textarea.value = proposal;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  textarea.focus({ preventScroll: true });
  textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
