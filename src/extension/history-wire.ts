export const REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT = "chatchat:consultation-request-open-archive";

export interface RequestOpenConsultationArchiveDetail {
  sessionId: string;
}

export function requestOpenConsultationArchive(sessionId: string): void {
  if (!sessionId) return;
  window.dispatchEvent(new CustomEvent<RequestOpenConsultationArchiveDetail>(REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT, {
    detail: { sessionId },
  }));
}
