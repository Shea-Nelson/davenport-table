-- Local development schema. The server also creates this on startup when DATABASE_URL is unset.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  slot_id TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  min_players INTEGER,
  max_players INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
