export {
  DEFAULT_TEST_SPEECH,
  buildAdapterSpeechRequest,
  buildAdapterConsultationSpeechRequest,
  buildAdapterCouncilSpeechRequest,
  validateAdapterSpeechInput,
  type AdapterSpeechRequest,
} from "./speech-request.js";

export interface AdapterSpeechResult {
  ok: boolean;
  responseText: string;
  elapsedMs: number;
  baselineCount: number;
  responseCount: number;
  stablePolls: number;
  truncated: boolean;
}
