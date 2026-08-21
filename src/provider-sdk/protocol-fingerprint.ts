export interface ProtocolPayloadFingerprint {
  algorithm: "fnv1a32";
  hash: string;
  characters: number;
  value: string;
}

/**
 * Deterministic, non-cryptographic fingerprint for protocol equality checks.
 *
 * ChatChat uses this only to detect accidental payload drift between equal
 * Provider turns or between first/repair attempts. It is not a security hash,
 * authenticity proof, semantic similarity score, or content identifier.
 */
export function fingerprintProtocolValue(value: unknown): ProtocolPayloadFingerprint {
  const canonical = JSON.stringify(value);
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
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0");
  return {
    algorithm: "fnv1a32",
    hash: hex,
    characters: value.length,
    value: `fnv1a32:${hex}:${value.length}`,
  };
}
