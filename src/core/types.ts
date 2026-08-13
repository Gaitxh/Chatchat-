export type CouncilPhase = "sealed" | "debate" | "final";

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
  /** Stable model/profile grouping for AI House mode, e.g. `openai-chatgpt`. */
  delegationId?: string;
  /** Human-facing delegation label, e.g. `ChatGPT Delegation`. */
  delegationName?: string;
  /** 1-based seat number inside the delegation. */
  seatIndex?: number;
  /** Configured delegation size at the moment this Council was created. */
  seatCount?: number;
  /** Optional neutral investigative assignment in Committee Parliament mode. */
  committeeId?: string;
  /** Human-facing committee name, e.g. `Evidence Committee`. */
  committeeName?: string;
  /** Public, stance-neutral task for this seat. It must not prescribe a winner. */
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

export interface ArgumentEvent extends CouncilEventBase {
  kind: "argument";
  stance: string;
  content: string;
  confidence: number;
}

export interface ChallengeEvent extends CouncilEventBase {
  kind: "challenge";
  targetEventId: string;
  content: string;
}

export interface EvidenceEvent extends CouncilEventBase {
  kind: "evidence";
  targetEventId?: string;
  claim: string;
  content: string;
  source?: string;
  sourceDate?: string;
  confidence: number;
}

export interface SupportEvent extends CouncilEventBase {
  kind: "support";
  targetEventId: string;
  content: string;
}

export interface DefenseEvent extends CouncilEventBase {
  kind: "defense";
  targetEventId: string;
  content: string;
}

export interface RevisionEvent extends CouncilEventBase {
  kind: "revision";
  previousEventId: string;
  stance: string;
  content: string;
  confidence: number;
  causedBy?: string[];
}

export interface ConcedeEvent extends CouncilEventBase {
  kind: "concede";
  targetEventId: string;
  content: string;
}

export interface QuestionEvent extends CouncilEventBase {
  kind: "question";
  targetActorId?: string;
  content: string;
}

export interface UncertainEvent extends CouncilEventBase {
  kind: "uncertain";
  content: string;
  confidence: number;
}

export interface FinalPositionEvent extends CouncilEventBase {
  kind: "final_position";
  stance: string;
  content: string;
  confidence: number;
  caveats?: string[];
}

export type CouncilEvent =
  | ArgumentEvent
  | ChallengeEvent
  | EvidenceEvent
  | SupportEvent
  | DefenseEvent
  | RevisionEvent
  | ConcedeEvent
  | QuestionEvent
  | UncertainEvent
  | FinalPositionEvent;

type CouncilEventMetadataKey =
  | "id"
  | "sessionId"
  | "round"
  | "actorId"
  | "createdAt";

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
  participant: CouncilParticipant;
  publicEvents: readonly CouncilEvent[];
  ownEvents: readonly CouncilEvent[];
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
}

export interface CouncilRunOptions {
  maxRounds?: number;
  minDebateRounds?: number;
  convergenceThreshold?: number;
  onPhase?: (update: CouncilPhaseUpdate) => void | Promise<void>;
  onEvent?: (event: CouncilEvent) => void | Promise<void>;
}
