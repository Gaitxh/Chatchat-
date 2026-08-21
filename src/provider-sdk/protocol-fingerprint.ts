export interface ProtocolPayloadFingerprint {
  algorithm: "fnv1a64";
  hash: string;
  characters: number;
  value: string;
}

/**
 * Deterministic, non-cryptographic 64-bit fingerprint for protocol equality.
 *
 * Structured values are canonicalized recursively before hashing: object keys
 * are sorted, array order is preserved, and scalar values remain unchanged.
 * This prevents harmless JSON property-order differences from becoming false
 * Provider-fairness violations while still detecting real structured drift.
 *
 * ChatChat uses this only to detect accidental payload drift between equal
 * Provider turns or between first/repair attempts. It is not a security hash,
 * authenticity proof, semantic similarity score, or content identifier. The
 * 64-bit width reduces accidental collision risk without introducing async
 * WebCrypto work into the synchronous Prompt-observation path.
 */
export function fingerprintProtocolValue(value: unknown): ProtocolPayloadFingerprint {
  const canonical = JSON.stringify(canonicalizeProtocolValue(value));
  return fingerprintProtocolText(canonical);
}

export function fingerprintProtocolJsonText(raw: string): ProtocolPayloadFingerprint | null {
  try {
    return fingerprintProtocolValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function fingerprintProtocolText(value: string): ProtocolPayloadFingerprint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  const hex = hash.toString(16).padStart(16, "0");
  return {
    algorithm: "fnv1a64",
    hash: hex,
    characters: value.length,
    value: `fnv1a64:${hex}:${value.length}`,
  };
}

function canonicalizeProtocolValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeProtocolValue);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalizeProtocolValue(record[key])]),
  );
}
