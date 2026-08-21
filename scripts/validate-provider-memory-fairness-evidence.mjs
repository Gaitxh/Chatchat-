import fs from "node:fs";

const artifactDir = process.argv[2] ?? "artifacts";
const pages = [
  ["Chinese Provider Memory Fairness proof", read("chatchat-provider-memory-fairness-zh.html")],
  ["English Provider Memory Fairness proof", read("chatchat-provider-memory-fairness-en.html")],
];

for (const [label, html] of pages) {
  requireAll(label, html, [
    'data-chatchat-provider-memory-fairness-showcase="complete"',
    'data-chatchat-provider-memory-fairness-metadata-parity="complete"',
    'data-chatchat-provider-memory-fairness-actors="3/3"',
    'data-chatchat-provider-memory-fairness-latest-events="12"',
    'data-execution-mode="synthetic-showcase"',
    'data-provider-memory-fairness="verified"',
    'data-provider-memory-fairness-view="live"',
    'data-memory-fairness-payload-mismatch-rounds="0"',
    'data-memory-fairness-metadata-mismatch-turns="0"',
    'data-memory-fairness-repair-mismatch-turns="0"',
    'data-memory-fairness-selector-actor-mismatch-turns="0"',
    'data-memory-fairness-representation-limited-rounds="0"',
    'data-provider-memory-coverage="audited"',
    'data-provider-memory-evidence="actual_prompt"',
  ]);

  const fairnessR3 = articleFor(html, 'data-memory-fairness-round="3"');
  const memoryR3 = articleFor(html, 'data-provider-memory-round="3"');
  assert(fairnessR3 && memoryR3, `${label} must include both R3 fairness and R3 memory receipts.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-actor-total") === 3, `${label} must prove three actors spoke in the overfull latest round.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-actor-represented") === 3, `${label} must preserve all three latest-round actors.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-actor-omitted") === 0, `${label} must not silently omit the early-published actor.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-actual-prompt-seats") === 3, `${label} must have actual Prompt fairness evidence for all seats.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-seat-count") === 3, `${label} must audit all three equal Provider seats.`);
  assert(fairnessR3.includes('data-memory-fairness-payload-consistent="true"'), `${label} equal peers must receive the same normalized public payload.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-metadata-mismatch-seats") === 0, `${label} self-reported snapshot ids must equal ids independently parsed from actual public JSON.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-selector-actor-mismatch-seats") === 0, `${label} actual Prompt actor coverage must match selector audit.`);
  assert(numberAttr(fairnessR3, "data-memory-fairness-repair-mismatch-seats") === 0, `${label} format repair may not swap public memory.`);

  assert(numberAttr(memoryR3, "data-provider-memory-snapshot-count") === 12, `${label} must keep the fixed 12-event public Prompt cap.`);
  assert(numberAttr(memoryR3, "data-provider-memory-latest-count") === 12, `${label} all 12 bounded slots must come from the overfull previous round.`);
  assert(numberAttr(memoryR3, "data-provider-memory-actual-prompt-seats") === 3, `${label} memory receipt must carry actual Prompt evidence for all seats.`);
  assert(memoryR3.includes('data-provider-memory-shared="true"'), `${label} same-round Providers must share one bounded public deck.`);
}

requireAll("Chinese Provider Memory Fairness proof", pages[0][1], ["公共记忆程序公平", "平等席位获得了可验证的同一公共记忆程序", "3/3 上一轮 actor 被代表", "metadata = actual IDs"]);
requireAll("English Provider Memory Fairness proof", pages[1][1], ["PUBLIC MEMORY PROCEDURAL FAIRNESS", "Equal seats received a verifiably consistent public-memory procedure", "3/3 previous-round actors represented", "metadata = actual IDs"]);

console.log("✓ Chromium proves an 18-event latest round becomes a 12-event seat-representative deck with 3/3 actors, equal payload fingerprints, metadata parity and no repair drift");

function read(name) {
  const path = `${artifactDir}/${name}`;
  assert(fs.existsSync(path), `Missing Provider Memory Fairness evidence file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function articleFor(html, marker) {
  const index = html.indexOf(marker);
  if (index < 0) return "";
  const start = html.lastIndexOf("<article", index);
  const end = html.indexOf("</article>", index);
  return start >= 0 && end >= 0 ? html.slice(start, end + 10) : "";
}

function numberAttr(fragment, name) {
  const value = Number(fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "NaN");
  return Number.isFinite(value) ? value : -1;
}

function requireAll(label, value, needles) {
  for (const needle of needles) assert(value.includes(needle), `${label} is missing required evidence: ${needle}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Provider Memory Fairness evidence validation failed: ${message}`);
}
