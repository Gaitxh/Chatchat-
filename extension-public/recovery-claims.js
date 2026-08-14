const claimedKeys = new Set();

export function claimProviderRecovery(seatId, tabId) {
  const numericTabId = Number(tabId);
  if (!seatId || !Number.isInteger(numericTabId)) return false;
  const key = `${String(seatId)}:${numericTabId}`;
  if (claimedKeys.has(key)) return false;
  claimedKeys.add(key);
  return true;
}

export function releaseProviderRecovery(seatId, tabId) {
  claimedKeys.delete(`${String(seatId)}:${Number(tabId)}`);
}

export function resetProviderRecoveryClaims() {
  claimedKeys.clear();
}
