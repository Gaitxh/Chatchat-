import {
  AUTO_PILOT_READY_TOKEN,
  buildAutoPilotConnectionPrompt,
  diagnoseAutoPilotFailure,
} from "../src/extension/autopilot-model.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const prompt = buildAutoPilotConnectionPrompt();
assert(
  !prompt.includes(AUTO_PILOT_READY_TOKEN),
  "The complete ready token must not appear in the user's own connection prompt.",
);
assert(prompt.includes("CHATCHAT"), "The prompt should still explain how to construct the ready token.");
assert(prompt.includes("underscore"), "The prompt must make the separator deterministic.");

assert(
  diagnoseAutoPilotFailure(new Error("Timed out waiting for the AI response")).kind === "timeout",
  "Timeouts should be recognized as retryable Auto Pilot failures.",
);
assert(
  diagnoseAutoPilotFailure(new Error("Could not identify the message box automatically")).kind === "site_changed",
  "DOM mapping failures should be classified as page adaptation problems.",
);
assert(
  diagnoseAutoPilotFailure(new Error("Structured consultation output failed twice")).kind === "protocol_failed",
  "Structured protocol failures should not be mislabeled as page mapping failures.",
);
assert(
  diagnoseAutoPilotFailure(new Error("Host access unavailable for this origin")).kind === "permission",
  "Site-access failures should remain explicit.",
);
assert(
  diagnoseAutoPilotFailure(new Error("Some unrelated failure")).kind === "unknown",
  "Unknown failures should fail closed instead of being guessed into a known category.",
);

console.log("✓ ChatChat Auto Pilot reliability tests passed");
