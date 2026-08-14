export const AUTOMATIC_TEAM_ASSEMBLED_EVENT = "chatchat:automatic-team-assembled";

export function announceAutomaticTeamAssembled(): void {
  window.dispatchEvent(new Event(AUTOMATIC_TEAM_ASSEMBLED_EVENT));
}
