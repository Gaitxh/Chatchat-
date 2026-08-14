import fs from "node:fs";

const panel = fs.readFileSync("src/extension/consultation-panel.tsx", "utf8");
const showcase = fs.readFileSync("extension-public/consultation-showcase-bootstrap.js", "utf8");

for (const required of [
  'const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1"',
  'const [proposal, setProposal] = useState("")',
  "PROPOSAL_DRAFT_KEY]);",
  "setProposal(session[PROPOSAL_DRAFT_KEY] as string)",
  "store.set({ [PROPOSAL_DRAFT_KEY]: next })",
]) {
  if (!panel.includes(required)) {
    throw new Error(`User-owned proposal draft contract is missing: ${required}`);
  }
}

if (panel.includes("defaultProposal")) {
  throw new Error("Real consultation UI must not seed a project/demo proposal into the user's input.");
}

for (const required of [
  'const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1"',
  "const showcaseProposal = locale === \"en\"",
  "[PROPOSAL_DRAFT_KEY]: showcaseProposal",
]) {
  if (!showcase.includes(required)) {
    throw new Error(`Consultation showcase must own its own demo proposal seed: ${required}`);
  }
}

console.log("✓ ChatChat real proposal input is user-owned and session-persistent");
console.log("✓ ChatChat consultation showcase owns its demo proposal seed");
