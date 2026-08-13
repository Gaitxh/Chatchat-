CREATE TABLE IF NOT EXISTS adapter_recipes (
  profile_id TEXT PRIMARY KEY NOT NULL,
  composer_selector TEXT,
  send_selector TEXT,
  response_selector TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adapter_recipes_updated_at
  ON adapter_recipes(updated_at DESC);
