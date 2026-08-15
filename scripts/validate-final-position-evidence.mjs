import fs from "node:fs";

const dir = process.argv[2] ?? "artifacts";
const zh = read("chatchat-final-position-floor-zh.html");
const en = read("chatchat-final-position-floor-en.html");

for (const [label, html] of [["Chinese Final Position Floor", zh], ["English Final Position Floor", en]]) {
  requireAll(label, html, [
    'data-chatchat-final-position-floor-showcase="complete"',
    'data-final-position-floor="explicit-final-submissions"',
    'data-final-position-synthetic="true"',
    'data-final-position-alignment-match="true"',
    'data-final-position-group-leading="true"',
    'data-final-position-group-leading="false"',
    'data-final-seat-execution="verified"',
    'data-final-seat-changed="true"',
    'data-final-seat-lineage="explicit-revision"',
    'data-final-seat-revision-event=',
    'data-final-seat-shift-warning="unexplained"',
    'data-final-position-unexplained="true"',
  ]);
}

requireAll("Chinese Final Position Floor", zh, [
  "会议最终席位图",
  "报告中的领先组 · 描述性",
  "保留的其他最终立场",
  "明确 revision 票据",
  "没有对应 revision 事件",
  "因此不推断原因",
  "DEMO · SYNTHETIC",
]);
requireAll("English Final Position Floor", en, [
  "FINAL POSITION FLOOR",
  "REPORT LEADING GROUP · DESCRIPTIVE",
  "OTHER SURVIVING FINAL STANCE",
  "EXPLICIT REVISION RECEIPTS",
  "no matching revision event",
  "no cause is inferred",
  "DEMO · SYNTHETIC",
]);

assert(!zh.includes("明确修正轨迹"), "Chinese focused evidence still uses the misleading old all-the-way-to-final lineage label.");
assert(!en.includes("EXPLICIT REVISION LINEAGE"), "English focused evidence still uses the misleading old all-the-way-to-final lineage label.");

console.log("✓ focused Final Position Floor proof separates explicit revision receipts from unexplained final shifts");

function read(name) {
  const path = `${dir}/${name}`;
  assert(fs.existsSync(path), `Missing focused final-position evidence file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireAll(label, value, needles) {
  for (const needle of needles) assert(value.includes(needle), `${label} is missing: ${needle}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Final Position Floor evidence failed: ${message}`);
}
