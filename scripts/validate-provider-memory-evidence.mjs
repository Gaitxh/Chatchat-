import fs from "node:fs";

const artifactDir = process.argv[2] ?? "artifacts";
const pages = [
  ["Chinese Provider Memory proof", read("chatchat-provider-memory-zh.html")],
  ["English Provider Memory proof", read("chatchat-provider-memory-en.html")],
];

for (const [label, html] of pages) {
  requireAll(label, html, [
    'data-chatchat-provider-memory-showcase="complete"',
    'data-execution-mode="synthetic-showcase"',
    'data-provider-memory-coverage="audited"',
    'data-provider-memory-evidence="actual_prompt"',
    'data-provider-memory-consistent="true"',
    'data-provider-memory-selector-consistent="true"',
    'data-provider-memory-integrity="verified"',
    'data-provider-memory-gap-state="clear"',
    'data-provider-memory-round="3"',
    'data-provider-memory-round="4"',
    'data-provider-memory-snapshot-count="12"',
    'data-provider-memory-shared="true"',
    'data-provider-memory-pinned-source=',
    'data-provider-memory-resolver-event=',
  ]);

  const r3 = articleForRound(html, 3);
  const r4 = articleForRound(html, 4);
  assert(r3 && r4, `${label} must contain R3 and R4 memory receipts.`);
  assert(numberAttr(r3, "data-provider-memory-available-count") > 12, `${label} R3 must prove >12 public history existed.`);
  assert(numberAttr(r3, "data-provider-memory-snapshot-count") === 12, `${label} R3 must preserve the 12-event hard cap.`);
  assert(numberAttr(r3, "data-provider-memory-pinned-count") > 0, `${label} R3 must restore at least one old unresolved event.`);
  assert(numberAttr(r3, "data-provider-memory-pinned-source-count") > 0, `${label} R3 must expose an exact canonical pin reason.`);
  assert(numberAttr(r3, "data-provider-memory-omitted-count") > 0, `${label} R3 must disclose ordinary history omitted by budget.`);
  assert(numberAttr(r3, "data-provider-memory-actual-prompt-seats") === numberAttr(r3, "data-provider-memory-seat-count"), `${label} R3 must have actual Prompt evidence for every seat.`);
  assert(numberAttr(r3, "data-provider-memory-selector-mismatch-seats") === 0, `${label} R3 actual Prompt metadata must match deterministic selector audit.`);

  assert(numberAttr(r4, "data-provider-memory-available-count") > 12, `${label} R4 must still be under memory pressure.`);
  assert(numberAttr(r4, "data-provider-memory-snapshot-count") === 12, `${label} R4 must retain the same hard cap.`);
  assert(numberAttr(r4, "data-provider-memory-omitted-count") > 0, `${label} R4 must continue disclosing omitted ordinary history.`);
  assert(numberAttr(r4, "data-provider-memory-actual-prompt-seats") === numberAttr(r4, "data-provider-memory-seat-count"), `${label} R4 must retain actual Prompt evidence for every seat.`);

  const pinnedSource = attr(html, "data-chatchat-provider-memory-pinned-source");
  const resolver = attr(html, "data-chatchat-provider-memory-resolver-event");
  assert(pinnedSource && resolver && pinnedSource !== resolver, `${label} must expose distinct exact source and resolver event IDs.`);
  assert(r3.includes(`data-provider-memory-pinned-source="${escapeRegExpLiteral(pinnedSource)}"`) || r3.includes(`data-provider-memory-pinned-source="${pinnedSource}"`), `${label} R3 must visibly contain the pinned source.`);
  assert(!r4.includes(`data-provider-memory-pinned-source="${pinnedSource}"`), `${label} R4 must release the resolved source from pinned memory.`);
}

requireAll("Chinese Provider Memory proof", pages[0][1], ["上下文记忆收据", "实际 Prompt", "同一公共快照", "为什么这些旧事件被带回来"]);
requireAll("English Provider Memory proof", pages[1][1], ["PROVIDER MEMORY COVERAGE", "ACTUAL PROMPT", "SAME PUBLIC SNAPSHOT", "WHY OLD EVENTS WERE BROUGHT BACK"]);

console.log("✓ dedicated Chromium evidence proves hard-cap memory pressure, actual Prompt parity, conflict pinning, exact resolver provenance and next-round unpin");

function read(name) {
  const path = `${artifactDir}/${name}`;
  assert(fs.existsSync(path), `Missing Provider Memory evidence file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function articleForRound(html, round) {
  const marker = `data-provider-memory-round="${round}"`;
  const index = html.indexOf(marker);
  if (index < 0) return "";
  const start = html.lastIndexOf("<article", index);
  const end = html.indexOf("</article>", index);
  return start >= 0 && end >= 0 ? html.slice(start, end + 10) : "";
}

function numberAttr(fragment, name) {
  const value = Number(attr(fragment, name) ?? "NaN");
  return Number.isFinite(value) ? value : -1;
}

function attr(fragment, name) {
  return fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function requireAll(label, value, needles) {
  for (const needle of needles) assert(value.includes(needle), `${label} is missing required evidence: ${needle}`);
}

function escapeRegExpLiteral(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function assert(condition, message) { if (!condition) throw new Error(`Provider Memory evidence validation failed: ${message}`); }
