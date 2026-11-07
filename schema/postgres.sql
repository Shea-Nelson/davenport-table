-- Schema used when DATABASE_URL is a postgres connection string.
-- Cursor Apps documents automatic Postgres provisioning, but does not name the variable.
-- This app reads DATABASE_URL, the name used in Cursor's secrets examples.
-- No rows are copied from SQLite. A new database starts empty.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS attendees_nickname_ci ON attendees (lower(nickname));
CREATE TABLE IF NOT EXISTS claims (
  slot_id TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  min_players INTEGER,
  max_players INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
