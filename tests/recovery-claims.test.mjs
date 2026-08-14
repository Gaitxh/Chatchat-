import { createRecoveryClaimRegistry } from "../extension-public/recovery-claims.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const claims = createRecoveryClaimRegistry();
const seat = "extension:anthropic-claude:801";

assert(claims.size() === 0, "claim registry should start empty");
assert(claims.claim(seat), "the first browser surface should acquire the recovery claim");
assert(!claims.claim(seat), "a second browser surface must be denied the same recovery claim");
assert(claims.has(seat), "the active recovery claim should be observable inside the registry");
assert(claims.size() === 1, "duplicate claims must not create duplicate ownership");
assert(claims.release(seat), "READY/removal should release the recovery claim");
assert(!claims.has(seat), "released recovery claim should disappear");
assert(claims.claim(seat), "a later independent failure cycle may claim recovery again after the previous one reached READY");
assert(!claims.claim(""), "empty recovery claim keys must fail closed");
assert(!claims.claim("x".repeat(257)), "oversized recovery claim keys must fail closed");

console.log("✓ ChatChat cross-surface Provider recovery claim tests passed");
