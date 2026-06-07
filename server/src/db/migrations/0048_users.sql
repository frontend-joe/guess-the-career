-- Users for guessthelist.xyz. One table for both public players and admins
-- (is_admin flag). password_hash is nullable to allow future OAuth-only accounts;
-- google_id is reserved for a future "Sign in with Google".

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
