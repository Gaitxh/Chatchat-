export interface SeatIdentityParticipant {
  seatId: string;
  hostname?: string;
  origin?: string;
  providerName?: string;
}

/**
 * Resolve the rendered Provider row from stable public Provider identity instead
 * of assuming React render order still matches a separately hydrated array.
 * Duplicate Provider origins are forbidden by consultation equality, so hostname
 * is the primary key and the visible Provider name is only a conservative fallback.
 */
export function participantRowMap(
  participants: readonly SeatIdentityParticipant[],
): Map<string, HTMLElement> {
  const rows = [...document.querySelectorAll<HTMLElement>(".participant-row")];
  const bySeat = new Map<string, HTMLElement>();
  const claimed = new Set<string>();

  for (const row of rows) {
    delete row.dataset.seatId;
    const renderedHostname = row.querySelector<HTMLElement>(".participant-main > small")?.textContent?.trim().toLocaleLowerCase() ?? "";
    const renderedName = row.querySelector<HTMLElement>(".participant-title-line > strong")?.textContent?.trim().toLocaleLowerCase() ?? "";

    const participant = participants.find((candidate) => {
      if (!candidate.seatId || claimed.has(candidate.seatId)) return false;
      const hostname = participantHostname(candidate);
      return Boolean(renderedHostname && hostname && renderedHostname === hostname);
    }) ?? participants.find((candidate) => {
      if (!candidate.seatId || claimed.has(candidate.seatId)) return false;
      return Boolean(renderedName && candidate.providerName?.trim().toLocaleLowerCase() === renderedName);
    });

    if (!participant) continue;
    claimed.add(participant.seatId);
    row.dataset.seatId = participant.seatId;
    bySeat.set(participant.seatId, row);
  }

  return bySeat;
}

function participantHostname(participant: SeatIdentityParticipant): string {
  if (participant.hostname) return participant.hostname.trim().toLocaleLowerCase();
  if (!participant.origin) return "";
  try {
    return new URL(participant.origin).hostname.toLocaleLowerCase();
  } catch {
    return "";
  }
}
