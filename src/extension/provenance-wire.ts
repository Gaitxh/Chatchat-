export const CONSULTATION_FOCUS_EVENT = "chatchat:consultation-focus-event";

export interface ConsultationFocusDetail {
  eventId: string;
}

export function focusConsultationEvent(eventId: string): void {
  if (!eventId) return;
  window.dispatchEvent(new CustomEvent<ConsultationFocusDetail>(CONSULTATION_FOCUS_EVENT, {
    detail: { eventId },
  }));
}
