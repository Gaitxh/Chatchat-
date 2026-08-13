CREATE TABLE IF NOT EXISTS provider_profiles (
  profile_id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  url TEXT NOT NULL,
  origin TEXT NOT NULL,
  profile_key TEXT NOT NULL UNIQUE,
  auth_state TEXT NOT NULL,
  seat_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_updated_at
  ON provider_profiles(updated_at DESC);
