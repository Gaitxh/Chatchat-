export interface SeatIdentityParticipant {
  seatId: string;
}

/**
 * React renders participant rows in the same order as the persisted participant
 * list. Decorate that one render-order join once, then every recovery/login
 * feature can address a row by the stable seat id instead of keeping its own
 * positional assumption.
 */
export function participantRowMap(
  participants: readonly SeatIdentityParticipant[],
): Map<string, HTMLElement> {
  const rows = [...document.querySelectorAll<HTMLElement>(".participant-row")];
  const bySeat = new Map<string, HTMLElement>();
  rows.forEach((row, index) => {
    const participant = participants[index];
    if (!participant?.seatId) return;
    row.dataset.seatId = participant.seatId;
    bySeat.set(participant.seatId, row);
  });
  return bySeat;
}
