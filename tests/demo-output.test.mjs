import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["dist/src/demo.js"], {
  encoding: "utf8",
  env: process.env,
});

if (result.status !== 0) {
  throw new Error(`Compiled ChatChat demo failed with ${result.status}:\n${result.stderr || result.stdout}`);
}

const output = `${result.stdout}\n${result.stderr}`;

for (const required of [
  "PROPOSAL SUBMITTED",
  "LIVE RESEARCH DESK",
  "LIVE AGENDA",
  "Protocol reason: fresh_signal_follow_up",
  "Trigger events:",
  "replyToEventId:",
  "OPEN ISSUES AT CLOSE",
  "OPEN QUESTION",
  "EXPLICIT UNCERTAINTY",
  "CONSULTATION OUTCOME",
  "Leading position:",
  "Alignment is descriptive telemetry, not authority.",
]) {
  if (!output.includes(required)) {
    throw new Error(`Terminal demo is missing current meeting proof: ${required}\n\n${output}`);
  }
}

for (const forbidden of [/👑/i, /\bking\b/i, /king's/i, /royal/i, /\bverdict\b/i]) {
  if (forbidden.test(output)) {
    throw new Error(`Terminal demo regressed to hierarchical product language: ${forbidden}`);
  }
}

console.log("✓ ChatChat terminal demo proves research, agenda, peer reply, open issues and equal-participant outcome semantics");
