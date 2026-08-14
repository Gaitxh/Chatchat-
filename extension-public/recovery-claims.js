export function createRecoveryClaimRegistry() {
  const claims = new Set();

  return Object.freeze({
    claim(key) {
      const normalized = normalizeKey(key);
      if (!normalized || claims.has(normalized)) return false;
      claims.add(normalized);
      return true;
    },
    release(key) {
      const normalized = normalizeKey(key);
      if (!normalized) return false;
      return claims.delete(normalized);
    },
    has(key) {
      const normalized = normalizeKey(key);
      return Boolean(normalized && claims.has(normalized));
    },
    size() {
      return claims.size;
    },
  });
}

function normalizeKey(value) {
  if (typeof value !== "string") return "";
  const key = value.trim();
  if (!key || key.length > 256) return "";
  return key;
}
