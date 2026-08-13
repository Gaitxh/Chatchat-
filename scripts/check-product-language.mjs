import fs from "node:fs";

const files = [
  "extension/sidepanel.html",
  "extension-public/manifest.json",
  "src/extension/consultation-panel.tsx",
  "src/extension/consultation-panel.css",
  "src/i18n/index.ts",
  "src/consultation/equality.ts",
  "docs/CONSULTATION_PROTOCOL.md",
  "docs/CONSULTATION_PROTOCOL.zh-CN.md",
];

const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

for (const required of [
  "AI Consultation",
  "equal participant",
  "用户提案",
  "平等 AI 参与者",
  "Independent AI Participant",
]) {
  if (!source.includes(required)) {
    throw new Error(`Consultation product language is missing required concept: ${required}`);
  }
}

for (const forbidden of [
  "KING'S COMMAND",
  "AI HOUSE",
  "HOUSE VERDICT",
  "众议院",
  "代表团共识",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Primary consultation product surface reintroduced legacy hierarchy wording: ${forbidden}`);
  }
}

console.log("✓ ChatChat primary browser product language is equal-participant consultation");
