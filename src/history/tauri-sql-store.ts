import Database from "@tauri-apps/plugin-sql";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import type {
  ArchivedCouncil,
  CouncilHistoryStore,
  CouncilHistorySummary,
} from "./types.js";

const DATABASE_URL = "sqlite:chatchat.db";

interface SessionRow {
  session_id: string;
  question: string;
  consensus_stance: string | null;
  consensus_ratio: number;
  confidence: number;
  rounds: number;
  event_count: number;
  report_json: string;
  created_at: string;
}

interface EventRow {
  payload_json: string;
}

export class TauriSqliteCouncilHistoryStore implements CouncilHistoryStore {
  readonly backend = "sqlite" as const;

  readonly #database: Database;

  private constructor(database: Database) {
    this.#database = database;
  }

  static async open(): Promise<TauriSqliteCouncilHistoryStore> {
    const database = await Database.load(DATABASE_URL);
    return new TauriSqliteCouncilHistoryStore(database);
  }

  async save(archive: ArchivedCouncil): Promise<void> {
    await this.#database.execute(
      `INSERT OR REPLACE INTO council_sessions (
        session_id, question, consensus_stance, consensus_ratio, confidence,
        rounds, event_count, report_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        archive.sessionId,
        archive.question,
        archive.consensusStance,
        archive.consensusRatio,
        archive.confidence,
        archive.rounds,
        archive.eventCount,
        JSON.stringify(archive.report),
        archive.createdAt,
      ],
    );

    for (const event of archive.events) {
      await this.#database.execute(
        `INSERT OR REPLACE INTO council_events (
          event_id, session_id, round, actor_id, kind, payload_json, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.id,
          archive.sessionId,
          event.round,
          event.actorId,
          event.kind,
          JSON.stringify(event),
          event.createdAt,
        ],
      );
    }
  }

  async list(limit = 12): Promise<CouncilHistorySummary[]> {
    const rows = await this.#database.select<SessionRow[]>(
      `SELECT session_id, question, consensus_stance, consensus_ratio,
        confidence, rounds, event_count, report_json, created_at
       FROM council_sessions
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(0, limit)],
    );

    return rows.map(summaryFromRow);
  }

  async load(sessionId: string): Promise<ArchivedCouncil | null> {
    const sessions = await this.#database.select<SessionRow[]>(
      `SELECT session_id, question, consensus_stance, consensus_ratio,
        confidence, rounds, event_count, report_json, created_at
       FROM council_sessions
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId],
    );
    const session = sessions[0];
    if (!session) return null;

    const rows = await this.#database.select<EventRow[]>(
      `SELECT payload_json
       FROM council_events
       WHERE session_id = $1
       ORDER BY round ASC, created_at ASC, event_id ASC`,
      [sessionId],
    );

    return {
      ...summaryFromRow(session),
      report: JSON.parse(session.report_json) as CouncilReport,
      events: rows.map(
        (row) => JSON.parse(row.payload_json) as CouncilEvent,
      ),
    };
  }
}

function summaryFromRow(row: SessionRow): CouncilHistorySummary {
  return {
    sessionId: row.session_id,
    question: row.question,
    consensusStance: row.consensus_stance,
    consensusRatio: row.consensus_ratio,
    confidence: row.confidence,
    rounds: row.rounds,
    eventCount: row.event_count,
    createdAt: row.created_at,
  };
}
