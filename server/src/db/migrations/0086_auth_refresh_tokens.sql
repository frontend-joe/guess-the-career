-- Long-lived sessions for native apps.
--
-- The web client authenticates with an httpOnly `gtl_session` cookie, which is
-- tuned for the Netlify -> Railway proxy hop. Native clients talk to Railway
-- directly and have no cookie jar worth the name, so they get a short-lived
-- bearer access token (the same signed session JWT, 1 hour) plus a long-lived
-- opaque refresh token stored here.
--
-- Only the SHA-256 of the refresh token is stored, never the token itself, so
-- a leak of this table is not a leak of anyone's session.
--
-- Tokens ROTATE on use: refreshing revokes the presented row and issues a new
-- one. That gives replay detection for free — if an already-revoked token is
-- presented, the token was stolen, and the whole family is revoked.
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT    NOT NULL UNIQUE,
  device_label  TEXT,
  platform      TEXT,
  last_used_at  TEXT,
  revoked_at    TEXT,
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens (user_id, revoked_at);
