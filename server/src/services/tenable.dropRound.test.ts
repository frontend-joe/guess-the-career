import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Taking a round out of the pool, when a game has already played it.
//
// game_round_instances references tenable_rounds ON DELETE RESTRICT, so a
// round that has been played cannot be deleted — deliberately, because a
// recording has to keep the round it was a recording of. The admin screens
// nonetheless need to be able to stop a round being offered: an Oceanian
// Serie A board added while the database briefly held enough Australians, and
// picked up by a room within the hour, derived five answers once those players
// went again. Deleting it threw a 500 and left it in the pool, where it would
// have served a board nobody could finish.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'drop-round-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { dropRound } = await import('../routes/tenable.ts')

function round(title: string): number {
  const { id } = sqlite
    .prepare(
      `INSERT INTO tenable_rounds (type, params, metric, title, answer_count)
       VALUES ('league', ?, 'apps', ?, 10) RETURNING id`,
    )
    .get(JSON.stringify({ league: title }), title) as { id: number }
  return id
}

function playedBy(roundId: number, code: string): void {
  const { id: userId } = sqlite
    .prepare(`INSERT INTO users (email, password_hash) VALUES (?, 'x') RETURNING id`)
    .get(`${code}@example.com`) as { id: number }
  const { id: roomId } = sqlite
    .prepare(
      `INSERT INTO game_rooms (code, livekit_room, host_user_id)
       VALUES (?, ?, ?) RETURNING id`,
    )
    .get(code, `lk-${code}`, userId) as { id: number }
  sqlite
    .prepare(
      `INSERT INTO game_round_instances
         (room_id, round_id, seq, type, params_json, metric, title, ordered)
       VALUES (?, ?, 1, 'league', '{}', 'apps', 'played', 1)`,
    )
    .run(roomId, roundId)
}

const exists = (id: number) =>
  !!sqlite.prepare(`SELECT 1 FROM tenable_rounds WHERE id = ?`).get(id)
const enabled = (id: number) =>
  (sqlite.prepare(`SELECT enabled FROM tenable_rounds WHERE id = ?`).get(id) as
    { enabled: number } | undefined)?.enabled

test('a round no game has touched is deleted outright', () => {
  const id = round('Untouched League')
  const res = dropRound(id)
  assert.equal(res.deleted, true)
  assert.equal(exists(id), false)
})

test('a round a game has played survives, deselected', () => {
  const id = round('Played League')
  playedBy(id, 'PLAY01')
  const res = dropRound(id)
  // Not deleted, because the game that played it still references it — and
  // that is the point, not a failure.
  assert.equal(res.deleted, false)
  assert.equal(exists(id), true)
  assert.equal(enabled(id), 0)
})

test('either way the schedule lets go of it', () => {
  const gone = round('Scheduled Gone')
  const kept = round('Scheduled Kept')
  playedBy(kept, 'PLAY02')
  sqlite.prepare(`INSERT INTO tenable_schedule (date, round_id) VALUES ('2030-01-01', ?)`).run(gone)
  sqlite.prepare(`INSERT INTO tenable_schedule (date, round_id) VALUES ('2030-01-02', ?)`).run(kept)

  assert.equal(dropRound(gone).unscheduled, 1)
  assert.equal(dropRound(kept).unscheduled, 1)
  const left = sqlite
    .prepare(`SELECT COUNT(*) AS n FROM tenable_schedule WHERE round_id IN (?, ?)`)
    .get(gone, kept) as { n: number }
  assert.equal(left.n, 0)
})
