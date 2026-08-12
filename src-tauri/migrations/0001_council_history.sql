CREATE TABLE IF NOT EXISTS council_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  question TEXT NOT NULL,
  consensus_stance TEXT,
  consensus_ratio REAL NOT NULL,
  confidence REAL NOT NULL,
  rounds INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS council_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES council_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_council_sessions_created_at
  ON council_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_council_events_session_round
  ON council_events(session_id, round, created_at);
