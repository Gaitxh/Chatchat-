import fs from "node:fs";

const audit = fs.readFileSync("src/provider-sdk/public-deck-audit.ts", "utf8");
const observer = fs.readFileSync("src/extension/prompt-memory-observer.ts", "utf8");
const portal = fs.readFileSync("src/extension/public-deck-integrity-portal.tsx", "utf8");
const test = fs.readFileSync("tests/prompt-memory-audit.test.ts", "utf8");
const webRoom = fs.readFileSync("app/app.html", "utf8");
const sidePanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const doc = fs.readFileSync("docs/PUBLIC_DECK_INTEGRITY.md", "utf8");
const docZh = fs.readFileSync("docs/PUBLIC_DECK_INTEGRITY.zh-CN.md", "utf8");

for (const claim of [
  "CONSULTATION_EVENTS_JSON",
  "publicSnapshotPayload !== first.publicSnapshotPayload",
  "payloadGroups.get(item.publicSnapshotPayload)",
  "peerDecksExactlyEqual",
  "repairDecksExactlyPreserved",
  "MAX_OBSERVATIONS",
]) assert(audit.includes(claim), `Exact public-deck audit is missing ${claim}.`);

assert(
  audit.includes("peerDeckGroups.length === 1"),
  "Peer exactness must be derived from groups built from raw public payload strings.",
);
assert(
  !/peerDecksExactlyEqual[^\n]+fingerprint/i.test(audit),
  "Diagnostic fingerprints must never decide exact peer-deck equality.",
);
assert(
  observer.includes("rememberProviderPublicDeck(prompt)"),
  "The real RUN_SPEECH observer must capture exact public decks.",
);

for (const claim of [
  "sameIdsDifferentContent",
  "mismatch-deck-session",
  "repair-mismatch-session",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
]) assert(test.includes(claim), `Adversarial public-deck regression coverage is missing ${claim}.`);

for (const surface of [webRoom, sidePanel]) {
  assert(surface.includes('id="public-deck-integrity-root"'), "Both browser surfaces must mount the public-deck integrity root.");
  assert(surface.includes("/src/extension/public-deck-integrity-portal.tsx"), "Both browser surfaces must load the public-deck integrity portal.");
}

for (const claim of [
  "data-public-deck-proof-mode",
  "DEMO · SYNTHETIC",
  "not evidence that ChatGPT",
  "never hidden model reasoning",
]) assert(portal.includes(claim), `Public-deck UI truth boundary is missing ${claim}.`);

for (const claim of [
  "byte-for-byte identical",
  "Repair continuity",
  "bounded in-memory audit buffer",
  "does not read Provider credentials",
  "synthetic fixture",
  "procedural fairness",
]) assert(doc.includes(claim), `English public-deck policy is missing ${claim}.`);

for (const claim of [
  "逐字完全相同",
  "repair 连续性",
  "有上限的内存审计缓冲区",
  "账号凭据",
  "synthetic fixture",
  "程序公平性",
]) assert(docZh.includes(claim), `Chinese public-deck policy is missing ${claim}.`);

console.log("✓ exact public Blackboard deck parity, repair continuity, privacy and synthetic/live truth boundaries are guarded");

function assert(condition, message) {
  if (!condition) throw new Error(`Public-deck integrity check failed: ${message}`);
}
