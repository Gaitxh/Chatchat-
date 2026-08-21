import fs from "node:fs";

const artifactDir = process.argv[2] ?? "artifacts";
const pages = [
  ["Chinese Provider payload repair proof", read("chatchat-provider-payload-repair-zh.html")],
  ["English Provider payload repair proof", read("chatchat-provider-payload-repair-en.html")],
];

for (const [label, html] of pages) {
  requireAll(label, html, [
    'data-chatchat-provider-payload-repair-showcase="complete"',
    'data-execution-mode="synthetic-showcase"',
    'data-provider-payload-integrity="verified"',
    'data-provider-payload-view="live"',
    'data-provider-payload-unverified-turns="0"',
    'data-provider-payload-repair-payload-drift="0"',
    'data-provider-payload-repair-selection-drift="0"',
    'data-provider-payload-round="2"',
    'data-provider-payload-phase="debate"',
    'data-provider-payload-consistent="true"',
    'data-provider-payload-unverified-seats="0"',
    'data-provider-payload-receipt-count="1"',
    'data-provider-repair-used-seats="1"',
    'data-provider-repair-matched-seats="1"',
    'data-provider-repair-drift-seats="0"',
    'data-provider-repair-payload-drift-seats="0"',
    'data-provider-repair-selection-drift-seats="0"',
    'data-provider-repair-unverified-seats="0"',
    'data-attendance-turn-state="repaired"',
  ]);
  const r2 = roundFragment(html, 2);
  const seats = numberAttr(r2, "data-provider-payload-seat-count");
  const fingerprinted = numberAttr(r2, "data-provider-payload-fingerprinted-seats");
  const unverified = numberAttr(r2, "data-provider-payload-unverified-seats");
  assert(seats > 0 && fingerprinted === seats && unverified === 0, `${label} must carry complete payload receipts for every R2 transport-observed seat.`);
  assert(numberAttr(r2, "data-provider-payload-receipt-count") === 1, `${label} R2 equal peers must collapse to one exact serialized public-payload receipt.`);
  assert(numberAttr(r2, "data-provider-repair-used-seats") === 1, `${label} must prove exactly one real repair attempt occurred.`);
  assert(numberAttr(r2, "data-provider-repair-matched-seats") === 1, `${label} repair must reuse both the exact serialized payload and the exact selected/pinned/latest provenance.`);
  assert(numberAttr(r2, "data-provider-repair-payload-drift-seats") === 0, `${label} repair must not change exact serialized public payload.`);
  assert(numberAttr(r2, "data-provider-repair-selection-drift-seats") === 0, `${label} repair must not change snapshot/pinned/source/latest provenance.`);
}

requireAll("Chinese Provider payload repair proof", pages[0][1], [
  "PUBLIC PAYLOAD INTEGRITY",
  "精确公共 payload 一致",
  "repair 上下文完全一致",
  "64-bit 非密码学相等性辅助值",
  "它不是签名、真实性证明、防篡改凭证、证据质量分或答案正确率",
]);
requireAll("English Provider payload repair proof", pages[1][1], [
  "PUBLIC PAYLOAD INTEGRITY",
  "EXACT PUBLIC PAYLOAD MATCH",
  "repair contexts fully matched",
  "64-bit non-cryptographic equality aid",
  "It is not a signature, authenticity proof, tamper-proof receipt, evidence-quality score, or answer-correctness signal",
]);

// Negative disclaimers are required above. Reject only affirmative overclaims;
// a sentence such as "not a tamper-proof receipt" must not fail this guard.
for (const [, html] of pages) {
  assert(
    !/cryptographic signature verified|verified cryptographic signature|proof of truth|truth (?:is )?proven|verified tamper.?proof|tamper.?proof (?:receipt )?(?:verified|guaranteed)/i.test(html),
    "Payload equality UI must never overclaim cryptographic authenticity or truth.",
  );
}

console.log("✓ Chromium repair proof keeps every transport-observed seat in the denominator, proves one exact serialized public payload, preserves repair selection provenance, and keeps equality receipts explicitly non-cryptographic");

function read(name) {
  const path = `${artifactDir}/${name}`;
  assert(fs.existsSync(path), `Missing Provider payload evidence file: ${path}`);
  return fs.readFileSync(path, "utf8");
}
function roundFragment(html, round) {
  const marker = `data-provider-payload-round="${round}"`;
  const index = html.indexOf(marker);
  if (index < 0) return "";
  const start = html.lastIndexOf("<article", index);
  const end = html.indexOf("</article>", index);
  return start >= 0 && end >= 0 ? html.slice(start, end + 10) : "";
}
function numberAttr(fragment, name) {
  const raw = fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  const value = Number(raw ?? "NaN");
  return Number.isFinite(value) ? value : -1;
}
function requireAll(label, value, needles) { for (const needle of needles) assert(value.includes(needle), `${label} is missing required evidence: ${needle}`); }
function assert(condition, message) { if (!condition) throw new Error(`Provider payload evidence validation failed: ${message}`); }
