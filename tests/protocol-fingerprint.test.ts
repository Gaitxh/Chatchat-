import {
  fingerprintProtocolJsonText,
  fingerprintProtocolValue,
} from "../src/provider-sdk/protocol-fingerprint.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const a = {
  id: "event-1",
  actorId: "claude",
  nested: { stance: "A", confidence: 0.8 },
  refs: ["q1", "e1"],
};
const reordered = {
  refs: ["q1", "e1"],
  nested: { confidence: 0.8, stance: "A" },
  actorId: "claude",
  id: "event-1",
};
const changed = {
  ...reordered,
  nested: { confidence: 0.81, stance: "A" },
};

const first = fingerprintProtocolValue(a);
const second = fingerprintProtocolValue(reordered);
const third = fingerprintProtocolValue(changed);
assert(first.algorithm === "fnv1a64" && /^[0-9a-f]{16}$/.test(first.hash), "Fingerprint must remain deterministic FNV-1a 64-bit.");
assert(first.value === second.value, "Object property order must not create a false payload mismatch.");
assert(first.value !== third.value, "A real structured value change must change the fingerprint.");

const arrayA = fingerprintProtocolValue([{ id: "1" }, { id: "2" }]);
const arrayB = fingerprintProtocolValue([{ id: "2" }, { id: "1" }]);
assert(arrayA.value !== arrayB.value, "Array/event chronology must remain significant to public-deck equality.");

const jsonA = fingerprintProtocolJsonText('{"b":2,"a":{"y":2,"x":1}}');
const jsonB = fingerprintProtocolJsonText('{"a":{"x":1,"y":2},"b":2}');
assert(jsonA?.value === jsonB?.value, "JSON text with equivalent structured values must canonicalize to one fingerprint.");
assert(fingerprintProtocolJsonText("not json") === null, "Malformed JSON must not invent a fingerprint.");

console.log("✓ protocol fingerprint canonicalizes object keys, preserves array chronology, and detects real structured drift");
