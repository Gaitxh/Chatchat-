export const CONNECTION_RETRY_REQUESTED_EVENT = "chatchat:connection-retry-requested";

export interface ConnectionRetryRequestedDetail {
  seatId: string;
  reason?: "provider-tab-loaded" | "manual" | "recovery";
}

export function requestConnectionRetry(
  seatId: string,
  reason: ConnectionRetryRequestedDetail["reason"] = "recovery",
): void {
  if (!seatId) return;
  window.dispatchEvent(new CustomEvent<ConnectionRetryRequestedDetail>(
    CONNECTION_RETRY_REQUESTED_EVENT,
    { detail: { seatId, reason } },
  ));
}
