-- The append-only log of everything that happened in a round.
--
-- This is not a convenience table. It is the board track of the podcast video:
-- the recorded Tenable board is re-rendered from this log rather than screen
-- captured, so a missing or out-of-order event is a corrupted recording that
-- cannot be re-recorded. It is durable for that reason, and append-only.
--
-- t_ms is the offset from game_round_instances.started_at_ms, always measured
-- on the SERVER clock. Devices report their own timing for diagnostics, but
-- four phones disagreeing about the time must never reach the board track.
--
-- t_ms can collide across events; seq breaks ties and makes replay a total
-- order. seq is allocated as MAX(seq)+1 inside the same transaction as the
-- mutation — safe only because SQLite serialises writers, and the first thing
-- that must become a real sequence if this ever moves to Postgres.
--
-- THE RULE: the board at time T is a pure fold over all events with
-- t_ms <= T, ordered by (t_ms, seq). No clock reads, no queries, no
-- randomness in the reducer. The live game renders from the same fold, so the
-- board players saw and the board the video shows cannot diverge.
CREATE TABLE IF NOT EXISTS game_events (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id          INTEGER NOT NULL REFERENCES game_round_instances(id) ON DELETE CASCADE,
  seq                  INTEGER NOT NULL,
  t_ms                 INTEGER NOT NULL,
  type                 TEXT    NOT NULL,
  actor_participant_id INTEGER REFERENCES game_participants(id) ON DELETE SET NULL,
  payload              TEXT    NOT NULL DEFAULT '{}',
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (instance_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_game_events_instance_t ON game_events (instance_id, t_ms, seq);
