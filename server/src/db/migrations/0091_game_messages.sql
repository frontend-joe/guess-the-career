-- In-game chat, for the player whose microphone or camera is not working.
--
-- Deliberately NOT in game_events. That table is keyed to a round instance and
-- is the board track of the recorded video: chat happens in the lobby before
-- any round exists, continues between rounds, and must never reach the
-- reducer that draws the board. Keeping it in its own room-scoped table means
-- the recording cannot accidentally grow a chat overlay, and a late joiner can
-- still read what was said before they arrived.
--
-- It rides the existing sync primitive rather than inventing a second one:
-- posting a message bumps game_rooms.state_version like any other mutation, so
-- every client already refetches /state and already resyncs after a dropped
-- broadcast. No new transport, no new reconnect logic.
--
-- display_name is snapshotted onto the row for the same reason it is
-- snapshotted onto game_participants: someone renaming themselves later must
-- not retroactively re-attribute what they said.
--
-- client_message_id is the idempotency key, the same contract as
-- game_guesses.client_guess_id. A phone on a bad connection retries, and a
-- retry must not post twice.
CREATE TABLE IF NOT EXISTS game_messages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id           INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  participant_id    INTEGER REFERENCES game_participants(id) ON DELETE SET NULL,
  display_name      TEXT    NOT NULL,
  client_message_id TEXT    NOT NULL,
  body              TEXT    NOT NULL,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_game_messages_room_id ON game_messages(room_id, id);
