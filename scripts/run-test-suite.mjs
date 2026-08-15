import { spawnSync } from "node:child_process";

const tests = [
  "dist/tests/core.test.js",
  "dist/tests/participant-turn-lifecycle.test.js",
  "dist/tests/automatic-team.test.js",
  "dist/tests/login-state.test.js",
  "dist/tests/provider-sdk.test.js",
  "dist/tests/teach-mode.test.js",
  "dist/tests/test-speech.test.js",
  "dist/tests/council-bridge.test.js",
  "dist/tests/window-health.test.js",
  "dist/tests/gate-b-proof.test.js",
  "dist/tests/consultation-mode.test.js",
  "dist/tests/proposal-modes.test.js",
  "dist/tests/peer-inbox.test.js",
  "dist/tests/reply-provenance.test.js",
  "dist/tests/peer-exchange.test.js",
  "dist/tests/live-agenda.test.js",
  "dist/tests/open-issues.test.js",
  "dist/tests/conflict-board.test.js",
  "dist/tests/conflict-resolution.test.js",
  "dist/tests/context-selection.test.js",
  "dist/tests/pinned-issue-prompt.test.js",
  "dist/tests/live-persuasion.test.js",
  "dist/tests/provider-attendance.test.js",
  "dist/tests/execution-audit-history.test.js",
  "dist/tests/meeting-integrity.test.js",
  "dist/tests/receipt-integrity.test.js",
  "dist/tests/consultation-theater.test.js",
  "dist/tests/live-moments.test.js",
  "dist/tests/discussion-stream.test.js",
  "dist/tests/research-activity.test.js",
  "dist/tests/relationship-map.test.js",
  "dist/tests/evidence-ledger.test.js",
  "dist/tests/evidence-gap-radar.test.js",
  "dist/tests/evidence-tool-facts.test.js",
  "dist/tests/next-moves.test.js",
  "dist/tests/investigation-trail.test.js",
  "dist/tests/consultation-receipt.test.js",
  "dist/tests/source-metadata.test.js",
  "tests/source-extract.test.mjs",
  "tests/demo-output.test.mjs",
  "dist/tests/consultation-history.test.js",
  "dist/tests/extension-gate-b.test.js",
  "dist/tests/recipe-candidate.test.js",
  "dist/tests/browser-chronicle.test.js",
];

for (const test of tests) {
  process.stdout.write(`\n→ ${test}\n`);
  const result = spawnSync(process.execPath, [test], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) continue;

  const diagnostic = compactDiagnostic(result.stderr || result.stdout || `Process exited with ${result.status ?? "unknown status"}.`);
  if (process.env.GITHUB_ACTIONS === "true") {
    process.stdout.write(`::error title=Deterministic test failed (${escapeCommand(test)})::${escapeCommand(diagnostic)}\n`);
  }
  process.stderr.write(`\n✗ Deterministic test failed: ${test}\n`);
  process.exit(result.status ?? 1);
}

console.log(`\n✓ ${tests.length} deterministic ChatChat test programs passed`);

function compactDiagnostic(value) {
  const lines = String(value).trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-8).join(" | ").slice(0, 1800) || "No diagnostic output.";
}

function escapeCommand(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}
