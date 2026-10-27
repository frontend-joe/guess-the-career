-- Private multiplayer rooms: a host and up to three friends playing one
-- Tenable board together over video.
--
-- A room is identified publicly by a short `code` people read out loud, and
-- separately by `livekit_room`, which is never reused even if a code is —
-- recycling a LiveKit room name would let someone rejoin a call they were
-- removed from.
--
-- `state_version` is the sync primitive and the reason a deploy mid-game is
-- survivable. Every mutation bumps it inside the same transaction that made
-- the change, and every broadcast carries it; a client that sees a gap, or
-- reconnects, refetches the whole state. The server therefore holds no
-- authoritative state in memory and a restarted process answers correctly.
CREATE TABLE IF NOT EXISTS game_rooms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,
  livekit_room  TEXT    NOT NULL UNIQUE,
  host_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  status        TEXT    NOT NULL DEFAULT 'lobby',   -- lobby | live | ended
  max_players   INTEGER NOT NULL DEFAULT 4,
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  ended_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_host_status ON game_rooms (host_user_id, status);

-- Participants. `user_id` is NULLABLE on purpose: the host signs in, but
-- guests join with nothing but a code and a name they type, because the people
-- least likely to bother signing up are exactly the friends you want in the
-- call. A guest is identified by a room-scoped token referencing this row.
--
-- `display_name` is snapshotted here rather than read from users, so renaming
-- an account later does not retroactively relabel a recorded video.
--
-- `slot` (0..3) is assigned at join and never reused within a room: it fixes
-- tile order for the whole recording, so someone dropping out cannot shuffle
-- everyone else's position halfway through.
CREATE TABLE IF NOT EXISTS game_participants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id       INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  display_name  TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'player',  -- host | player
  slot          INTEGER NOT NULL,
  platform      TEXT,
  joined_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  left_at       TEXT,
  UNIQUE (room_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_game_participants_room ON game_participants (room_id, left_at);
-- A signed-in user occupies at most one seat per room. Guests are all NULL
-- here, and SQLite treats NULLs as distinct in a UNIQUE index, so any number
-- of them can sit down.
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_participants_room_user
  ON game_participants (room_id, user_id) WHERE user_id IS NOT NULL;
