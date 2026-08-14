import {
  claimProviderRecovery,
  releaseProviderRecovery,
  resetProviderRecoveryClaims,
} from "../extension-public/recovery-claims.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

resetProviderRecoveryClaims();
assert(claimProviderRecovery("seat-a", 101) === true, "First surface must win the recovery claim.");
assert(claimProviderRecovery("seat-a", 101) === false, "Second surface must not navigate the same seat/tab again.");
assert(claimProviderRecovery("seat-b", 101) === true, "Different seat can claim independently.");
assert(claimProviderRecovery("seat-a", 202) === true, "Same seat on a new tab is a distinct recovery episode.");
assert(claimProviderRecovery("", 101) === false, "Missing seat id cannot claim recovery.");
assert(claimProviderRecovery("seat-x", Number.NaN) === false, "Invalid tab id cannot claim recovery.");
releaseProviderRecovery("seat-a", 101);
assert(claimProviderRecovery("seat-a", 101) === true, "Explicit release permits a later fresh claim.");
resetProviderRecoveryClaims();
assert(claimProviderRecovery("seat-a", 101) === true, "Reset clears worker-local claims deterministically.");

console.log("✓ ChatChat Provider recovery claim tests passed");
