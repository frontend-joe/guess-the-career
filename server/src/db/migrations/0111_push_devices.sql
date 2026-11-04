-- Phones we can wake up, so starting a game reaches people who are not
-- already looking at the app.
--
-- Until now an invite was a link the host pasted into a group chat by hand,
-- and the only way to learn a game had started was to be told. This table is
-- the audience for the other direction: the host taps Create, every other
-- known phone buzzes, and tapping the notification opens the same
-- /join/<CODE> link the chat message carried.
--
-- A row is a DEVICE, not a person, because most players have no account —
-- guests join with a code and a typed name and that is deliberate (see
-- 0087_game_rooms.sql). `user_id` is therefore nullable and set only for the
-- host, which is also how a host's own phone is excluded from their own
-- game's notification.
--
-- `secret` is the device's own credential, handed back once at registration.
-- A push token rotates — iOS reissues it on restore, Android on reinstall —
-- and the phone has to be able to say "this is my new token" later, when it
-- holds no participant token and may have no account at all. Identifying
-- itself by the old token would make the token both the name and the
-- password; a separate secret keeps a push token out of the request body of
-- an otherwise unauthenticated call.
--
-- `apns_env` is learned rather than configured. A development build and a
-- TestFlight build of the same app get tokens that are valid on DIFFERENT
-- Apple gateways, and nothing in the token says which. Sending to the wrong
-- one comes back BadDeviceToken, indistinguishable from a dead phone, so the
-- sender tries the other gateway and writes down which one answered.
CREATE TABLE IF NOT EXISTS push_devices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  platform      TEXT    NOT NULL,              -- ios | android
  token         TEXT    NOT NULL UNIQUE,
  secret        TEXT    NOT NULL UNIQUE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Whose phone this is, snapshotted from the name they last joined under, so
  -- "who gets pinged" is answerable without guessing from a token.
  display_name  TEXT,
  apns_env      TEXT,                           -- development | production
  muted         INTEGER NOT NULL DEFAULT 0,
  -- Set when Apple or Google tells us the token is dead. Kept rather than
  -- deleted so a reinstall under the same name does not look like a new
  -- person, and so a bug that disables everybody is visible afterwards.
  disabled_at   TEXT,
  last_push_at  TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The audience query: every live phone that is not the host's own.
CREATE INDEX IF NOT EXISTS idx_push_devices_live ON push_devices (disabled_at, muted);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices (user_id);
