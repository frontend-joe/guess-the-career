-- Every time a phone tries to get onto the notification list, and how it went.
--
-- Written because the first real report of "I get no notifications" could not
-- be answered. The registry in push_devices says who IS registered; it cannot
-- say anything about a phone that is absent, and absent has two completely
-- different causes with the same appearance:
--
--   the app never called us   — no permission, no APNs token, or the person
--                               never entered a room, since registration
--                               needs the participant token of a game
--   the app called and we refused — a missing or expired participant token,
--                               which returns 403 and, until this table,
--                               was not recorded anywhere at all
--
-- One of those is fixed on the phone and the other on the server, and
-- guessing between them cost a session.
--
-- A refusal is the row most worth having, so `outcome` is recorded before
-- anything else can go wrong. `token_tail` rather than the token: this is a
-- diagnostic, and a push token is the one value that lets a stranger put
-- words on somebody's lock screen — it has no business in a log table.
CREATE TABLE IF NOT EXISTS push_registration_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  platform    TEXT,
  -- Last six characters, enough to tie an attempt to a device row.
  token_tail  TEXT,
  -- registered | rotated | refused | unknown-secret
  outcome     TEXT    NOT NULL,
  -- Our own words, for the cases where the outcome is not self-explanatory.
  reason      TEXT,
  -- Which device row it became, when it became one.
  device_id   INTEGER REFERENCES push_devices(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_registration_attempts_time
  ON push_registration_attempts (created_at);
