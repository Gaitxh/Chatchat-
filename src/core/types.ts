export type CouncilPhase = "sealed" | "debate" | "final";
export type CouncilConsultationMode = "balanced" | "explore" | "decide" | "verify" | "stress_test";
export type CouncilStopReason = "stable_alignment_no_new_signal" | "round_budget";
export type CouncilPhaseReason =
  | "sealed_start"
  | "initial_debate"
  | "fresh_signal_follow_up"
  | "minimum_debate_rounds"
  | "alignment_not_reached"
  | "finalizing_stable_alignment"
  | "finalizing_round_budget";
export type CouncilResearchLane =
  | "primary_sources"
  | "strongest_counterexample"
  | "implementation_constraints"
  | "historical_base_rate"
  | "user_failure_modes";

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

/** Optional only on speech kinds that otherwise have no exact peer-event target. Old archives remain valid without it. */
interface CouncilPeerReply {
  replyToEventId?: string;
}

export interface ArgumentEvent extends CouncilEventBase, CouncilPeerReply { kind: "argument"; stance: string; content: string; confidence: number; }
export interface ChallengeEvent extends CouncilEventBase { kind: "challenge"; targetEventId: string; content: string; }
export interface EvidenceEvent extends CouncilEventBase, CouncilPeerReply { kind: "evidence"; targetEventId?: string; claim: string; content: string; source?: string; sourceDate?: string; confidence: number; }
export interface SupportEvent extends CouncilEventBase { kind: "support"; targetEventId: string; content: string; }
export interface DefenseEvent extends CouncilEventBase { kind: "defense"; targetEventId: string; content: string; }
export interface RevisionEvent extends CouncilEventBase { kind: "revision"; previousEventId: string; stance: string; content: string; confidence: number; causedBy?: string[]; }
export interface ConcedeEvent extends CouncilEventBase { kind: "concede"; targetEventId: string; content: string; }
export interface QuestionEvent extends CouncilEventBase, CouncilPeerReply { kind: "question"; targetActorId?: string; content: string; }
export interface UncertainEvent extends CouncilEventBase, CouncilPeerReply { kind: "uncertain"; content: string; confidence: number; }
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
  /** Optional equal-authority research focus. It changes what to investigate, never voting weight or speaking priority. */
  researchLane?: CouncilResearchLane;
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
  /** Optional for old archives. Research lanes are equal-status investigation assignments, not roles of authority. */
  researchLaneAssignments?: Record<string, CouncilResearchLane>;
  /**
   * Exact direct question/challenge/evidence event ids still lacking a structured
   * response receipt when deliberation closed. Presence is transparency, not a
   * claim that the requester was correct or that the target should have agreed.
   */
  unansweredDirectRequestEventIds?: string[];
  consensusStance: string | null;
  consensusRatio: number;
  confidence: number;
  rounds: number;
  positions: CouncilPosition[];
  disagreements: CouncilPosition[];
  eventCount: number;
}

export interface CouncilPhaseUpdate {
  phase: CouncilPhase;
  round: number;
  /** Engine-owned explanation of why this phase/round exists. Optional keeps older callers/archives compatible. */
  reason?: CouncilPhaseReason;
  /** Exact public events that forced another peer-visible debate snapshot, including older unanswered direct requests. */
  triggerEventIds?: readonly string[];
  /** Descriptive alignment before this phase begins; never authority or a vote. */
  alignmentRatio?: number;
  convergenceThreshold?: number;
  debateRoundsCompleted?: number;
  minimumDebateRounds?: number;
}
export type CouncilParticipantTurnState = "working" | "completed" | "failed";
export interface CouncilParticipantTurnUpdate {
  phase: CouncilPhase;
  round: number;
  participant: CouncilParticipant;
  state: CouncilParticipantTurnState;
  researchLane?: CouncilResearchLane;
  /** Present when a participant completed a turn. These are declared structured actions, not inferred prose. */
  contributionKinds?: readonly CouncilEventKind[];
}
export interface CouncilToolFactsRequest { phase: CouncilPhase; round: number; publicEvents: readonly CouncilEvent[]; }

export interface CouncilRunOptions {
  mode?: CouncilConsultationMode;
  maxRounds?: number;
  minDebateRounds?: number;
  convergenceThreshold?: number;
  /** Equal-authority per-participant research focus. Omitted in ordinary modes. */
  researchLaneAssignments?: Readonly<Record<string, CouncilResearchLane>>;
  onPhase?: (update: CouncilPhaseUpdate) => void | Promise<void>;
  /** Runtime-only participant lifecycle used by live meeting surfaces. It does not affect deliberation order or authority. */
  onParticipantTurn?: (update: CouncilParticipantTurnUpdate) => void | Promise<void>;
  onEvent?: (event: CouncilEvent) => void | Promise<void>;
  /** Called once per round so every participant receives the same bounded tool snapshot. */
  toolFactsProvider?: (
    request: CouncilToolFactsRequest,
  ) => readonly CouncilToolFact[] | Promise<readonly CouncilToolFact[]>;
  /** Tool failures are non-fatal to the consultation. */
  onToolError?: (error: unknown) => void | Promise<void>;
}