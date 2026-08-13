import {
  AUTO_PILOT_READY_TOKEN,
  autoPilotFailureMessage,
  buildAutoPilotConnectionPrompt,
  diagnoseAutoPilotFailure,
} from "../src/extension/autopilot-model.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const prompt = buildAutoPilotConnectionPrompt();
assert(!prompt.includes(AUTO_PILOT_READY_TOKEN), "The complete ready token must not appear in the user's own prompt.");
assert(prompt.includes("CHATCHAT") && prompt.includes("underscore"), "The token construction instruction should remain deterministic.");

assert(diagnoseAutoPilotFailure(new Error("Timed out waiting for the AI response")).kind === "timeout", "Timeouts should be recognized.");
assert(diagnoseAutoPilotFailure(new Error("Could not identify the message box automatically")).kind === "site_changed", "DOM mapping failures should be classified as page adaptation problems.");
assert(diagnoseAutoPilotFailure(new Error("Structured consultation output failed twice")).kind === "protocol_failed", "Protocol failures should stay distinct from page mapping failures.");
assert(diagnoseAutoPilotFailure(new Error("Host access unavailable for this origin")).kind === "permission", "Site-access failures should remain explicit.");
assert(diagnoseAutoPilotFailure(new Error("Some unrelated failure")).kind === "unknown", "Unknown failures should fail closed.");

assert(autoPilotFailureMessage("site_changed", "zh-CN").includes("高级修复"), "Chinese site-change copy should offer manual repair only as fallback.");
assert(autoPilotFailureMessage("protocol_failed", "en").includes("unready"), "Protocol failure copy must say ChatChat fails closed.");

console.log("✓ ChatChat Auto Pilot reliability tests passed");
