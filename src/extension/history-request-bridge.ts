import { ConsultationHistoryStore } from "../history/consultation-history.js";
import {
  OPEN_CONSULTATION_ARCHIVE_EVENT,
  REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT,
  type RequestOpenConsultationArchiveDetail,
} from "./history-wire.js";

const MARKER = "__chatchatHistoryRequestBridgeV1";
const store = new ConsultationHistoryStore();
type MarkedWindow = Window & { [MARKER]?: true };

install();

function install(): void {
  const marked = window as MarkedWindow;
  if (marked[MARKER]) return;
  marked[MARKER] = true;

  window.addEventListener(REQUEST_OPEN_CONSULTATION_ARCHIVE_EVENT, (event: Event) => {
    const sessionId = (event as CustomEvent<RequestOpenConsultationArchiveDetail>).detail?.sessionId;
    if (!sessionId) return;
    void open(sessionId);
  });
}

async function open(sessionId: string): Promise<void> {
  const archive = await store.load(sessionId).catch(() => null);
  if (!archive) return;
  window.dispatchEvent(new CustomEvent(OPEN_CONSULTATION_ARCHIVE_EVENT, {
    detail: { archive },
  }));
  window.setTimeout(() => {
    document.querySelector(".consultation-theater")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 0);
}
