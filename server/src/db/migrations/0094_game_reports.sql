-- Reports, so a player has somewhere to go that is not "ask the host nicely".
--
-- Google Play expects an app carrying user-generated content to let people
-- report other users, and that is the reason this exists — but a report that
-- vanishes into a log nobody reads is theatre. It is a row, in the same
-- database as everything else, with the room and both participants on it, so
-- what was reported can actually be looked at afterwards.
--
-- The target is the PARTICIPANT, not the user: most players here are guests
-- with no account, and a report that could only name a signed-in user would
-- miss almost everybody.
--
-- A message id is optional and nullable because the thing being reported is
-- usually live video or audio, which leaves nothing behind to point at. When
-- it IS a chat message, pointing at it is worth far more than a free-text
-- description of what it said.
CREATE TABLE IF NOT EXISTS game_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES game_rooms(id),
  reporter_participant_id INTEGER NOT NULL REFERENCES game_participants(id),
  target_participant_id INTEGER NOT NULL REFERENCES game_participants(id),
  message_id INTEGER REFERENCES game_messages(id),
  reason TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_reports_room ON game_reports(room_id);
CREATE INDEX IF NOT EXISTS idx_game_reports_target ON game_reports(target_participant_id);

-- Chat moderation, recorded per message rather than applied silently.
--
-- `moderated` says the server changed what was typed before anyone else saw
-- it. Keeping the original is the point: a filter with no record of what it
-- caught cannot be checked, tuned, or defended when it gets something wrong.
ALTER TABLE game_messages ADD COLUMN moderated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_messages ADD COLUMN original_body TEXT;
