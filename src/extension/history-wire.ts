export const REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT = "chatchat:consultation-request-open-archive";
export const OPEN_CONSULTATION_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
export const CONSULTATION_HISTORY_UPDATED_EVENT = "chatchat:consultation-history-updated";

export interface RequestOpenConsultationArchiveDetail {
  sessionId: string;
}

export interface ConsultationHistoryUpdatedDetail {
  sessionId?: string;
}

export function requestOpenConsultationArchive(sessionId: string): void {
  if (!sessionId) return;
  window.dispatchEvent(new CustomEvent<RequestOpenConsultationArchiveDetail>(REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT, {
    detail: { sessionId },
  }));
}

export function announceConsultationHistoryUpdated(sessionId?: string): void {
  window.dispatchEvent(new CustomEvent<ConsultationHistoryUpdatedDetail>(CONSULTATION_HISTORY_UPDATED_EVENT, {
    detail: sessionId ? { sessionId } : {},
  }));
}
