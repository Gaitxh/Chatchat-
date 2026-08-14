import type { ProviderExecutionMode } from "../provider-sdk/transport-audit.js";
import type { MeetingExecutionIntegrity } from "../theater/meeting-integrity.js";

export const MEETING_EXECUTION_INTEGRITY_EVENT = "chatchat:meeting-execution-integrity";

export interface MeetingExecutionIntegrityDetail {
  sessionId: string | null;
  mode: ProviderExecutionMode;
  integrity: MeetingExecutionIntegrity;
}

export function announceMeetingExecutionIntegrity(detail: MeetingExecutionIntegrityDetail): void {
  window.dispatchEvent(new CustomEvent<MeetingExecutionIntegrityDetail>(MEETING_EXECUTION_INTEGRITY_EVENT, {
    detail: {
      ...detail,
      integrity: { ...detail.integrity },
    },
  }));
}
