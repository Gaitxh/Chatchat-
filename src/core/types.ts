export type CouncilPhase = "sealed" | "debate" | "final";
export type CouncilConsultationMode = "balanced" | "explore" | "decide" | "verify" | "stress_test";
export type CouncilStopReason = "stable_alignment_no_new_signal" | "round_budget";

export type CouncilEventKind =
  | "argument"
  | "challenge"
  | "evidence"
  | "support"
  | "defense"
  | "revision"
  | "concede"
  | "question"
  | "uncertain"
  | "final_position";

export interface CouncilParticipant {
  id: string;
  name: string;
  provider: string;
  role?: string;
  /** Historical compatibility metadata. The Browser Consultation product does not privilege groups. */
  delegationId?: string;
  delegationName?: string;
  seatIndex?: number;
  seatCount?: number;
  committeeId?: string;
  committeeName?: string;
  committeeTask?: string;
}

interface CouncilEventBase {
  id: string;
  sessionId: string;
  round: number;
  actorId: string;
  kind: CouncilEventKind;
  createdAt: string;
}

export interface ArgumentEvent extends CouncilEventBase { kind: "argument"; stance: string; content: string; confidence: number; }
export interface ChallengeEvent extends CouncilEventBase { kind: "challenge"; targetEventId: string; content: string; }
export interface EvidenceEvent extends CouncilEventBase { kind: "evidence"; targetEventId?: string; claim: string; content: string; source?: string; sourceDate?: string; confidence: number; }
export interface SupportEvent extends CouncilEventBase { kind: "support"; targetEventId: string; content: string; }
export interface DefenseEvent extends CouncilEventBase { kind: "defense"; targetEventId: string; content: string; }
export interface RevisionEvent extends CouncilEventBase { kind: "revision"; previousEventId: string; stance: string; content: string; confidence: number; causedBy?: string[]; }
export interface ConcedeEvent extends CouncilEventBase { kind: "concede"; targetEventId: string; content: string; }
export interface QuestionEvent extends CouncilEventBase { kind: "question"; targetActorId?: string; content: string; }
export interface UncertainEvent extends CouncilEventBase { kind: "uncertain"; content: string; confidence: number; }
export interface FinalPositionEvent extends CouncilEventBase { kind: "final_position"; stance: string; content: string; confidence: number; caveats?: string[]; }

export type CouncilEvent =
  | ArgumentEvent | ChallengeEvent | EvidenceEvent | SupportEvent | DefenseEvent
  | RevisionEvent | ConcedeEvent | QuestionEvent | UncertainEvent | FinalPositionEvent;

export type CouncilToolFactKind = "evidence_source_observation";

/** Bounded machine observations shared equally with every participant in a round. */
export interface CouncilToolFact {
  id: string;
  kind: CouncilToolFactKind;
  relatedEventId: string;
  observedAt: string;
  sourceState: "reachable" | "unavailable";
  claim?: string;
  sourceUrl?: string;
  sourceHost?: string;
  finalUrl?: string;
  statusCode?: number;
  title?: string;
  description?: string;
  excerpt?: string;
  pageDate?: string;
  pageDateKind?: "published" | "modified" | "page";
  sourceAgeDays?: number;
  contentFingerprint?: string;
  textCharacters?: number;
  truncated?: boolean;
  note: string;
}

type CouncilEventMetadataKey = "id" | "sessionId" | "round" | "actorId" | "createdAt";

export type CouncilContribution =
  | Omit<ArgumentEvent, CouncilEventMetadataKey>
  | Omit<ChallengeEvent, CouncilEventMetadataKey>
  | Omit<EvidenceEvent, CouncilEventMetadataKey>
  | Omit<SupportEvent, CouncilEventMetadataKey>
  | Omit<DefenseEvent, CouncilEventMetadataKey>
  | Omit<RevisionEvent, CouncilEventMetadataKey>
  | Omit<ConcedeEvent, CouncilEventMetadataKey>
  | Omit<QuestionEvent, CouncilEventMetadataKey>
  | Omit<UncertainEvent, CouncilEventMetadataKey>
  | Omit<FinalPositionEvent, CouncilEventMetadataKey>;

export interface CouncilContext {
  sessionId: string;
  question: string;
  phase: CouncilPhase;
  round: number;
  /** Older gate/test contexts may omit this; real runs are filled by the orchestrator. */
  mode?: CouncilConsultationMode;
  participant: CouncilParticipant;
  publicEvents: readonly CouncilEvent[];
  ownEvents: readonly CouncilEvent[];
  toolFacts?: readonly CouncilToolFact[];
}

export interface CouncilAgent {
  participant: CouncilParticipant;
  respond(context: CouncilContext): Promise<readonly CouncilContribution[]>;
}

export interface CouncilPosition {
  participant: CouncilParticipant;
  stance: string;
  content: string;
  confidence: number;
  caveats: string[];
}

export interface CouncilReport {
  sessionId: string;
  question: string;
  /** Optional for backward compatibility with archives created before proposal modes. */
  mode?: CouncilConsultationMode;
  /** Optional for old archives. New runs explain why deliberation stopped. */
  stopReason?: CouncilStopReason;
  consensusStance: string | null;
  consensusRatio: number;
  confidence: number;
  rounds: number;
  positions: CouncilPosition[];
  disagreements: CouncilPosition[];
  eventCount: number;
}

export interface CouncilPhaseUpdate { phase: CouncilPhase; round: number; }
export interface CouncilToolFactsRequest { phase: CouncilPhase; round: number; publicEvents: readonly CouncilEvent[]; }

export interface CouncilRunOptions {
  mode?: CouncilConsultationMode;
  maxRounds?: number;
  minDebateRounds?: number;
  convergenceThreshold?: number;
  onPhase?: (update: CouncilPhaseUpdate) => void | Promise<void>;
  onEvent?: (event: CouncilEvent) => void | Promise<void>;
  /** Called once per round so every participant receives the same bounded tool snapshot. */
  toolFactsProvider?: (
    request: CouncilToolFactsRequest,
  ) => readonly CouncilToolFact[] | Promise<readonly CouncilToolFact[]>;
  /** Tool failures are non-fatal to the consultation. */
  onToolError?: (error: unknown) => void | Promise<void>;
}
