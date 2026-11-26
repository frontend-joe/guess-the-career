import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Reviewing the game after it.
//
// Three rules the endpoint has to get right, and all three are about what it
// must NOT show. A round still being played is a cheat sheet. A round the
// host lined up and never started is a board still in the pool for next week.
// And an unordered round froze its whole pool — two hundred names on a
// nationality round — so the list is capped, which must never be allowed to
// drop a name somebody actually said.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'history-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')

const roundId = (sqlite
  .prepare("INSERT INTO tenable_rounds (type, params, metric, title) VALUES ('x', '{}', 'goals', 'T') RETURNING id")
  .get() as { id: number }).id

function room(email: string) {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(email) as { id: number }
  return rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
}

/** An instance with `answers` names on the board, the first `found` of them found. */
function instance(
  roomId: number,
  seq: number,
  opts: {
    status: string; started: boolean; ordered?: boolean; answers: number; found: number; by?: number
    /// Extra frozen rows BELOW the board, as a ranked round has: real answers
    /// to the question, ranked too low to be on it.
    tail?: number
  },
): number {
  const id = Number(
    sqlite
      .prepare(
        `INSERT INTO game_round_instances
           (room_id, round_id, seq, type, params_json, metric, title, ordered, target, status, started_at_ms)
         VALUES (?, ?, ?, 'x', '{}', 'goals', ?, ?, 10, ?, ?)`,
      )
      .run(
        roomId, roundId, seq, `Round ${seq}`,
        opts.ordered === false ? 0 : 1, opts.status, opts.started ? 1000 : null,
      ).lastInsertRowid,
  )
  const insert = sqlite.prepare(
    `INSERT INTO game_round_answers
       (instance_id, rank, on_board, name, name_norm, surname_norm, value, found_at_ms, found_by_participant_id)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
  )
  for (let i = 1; i <= opts.answers; i++) {
    const hit = i <= opts.found
    insert.run(id, i, `Player ${i}`, `player ${i}`, `${i}`, 100 - i, hit ? i * 10 : null, hit ? opts.by ?? null : null)
  }
  const offBoard = sqlite.prepare(
    `INSERT INTO game_round_answers
       (instance_id, rank, on_board, name, name_norm, surname_norm, value)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
  )
  for (let i = opts.answers + 1; i <= opts.answers + (opts.tail ?? 0); i++) {
    offBoard.run(id, i, `Player ${i}`, `player ${i}`, `${i}`, 100 - i)
  }
  return id
}

test('history is the rounds that were played, and only those', () => {
  const r = room('history-1@example.com')
  const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant

  instance(r.id, 1, { status: 'complete', started: true, answers: 10, found: 7, by: alan.id })
  instance(r.id, 2, { status: 'live', started: true, answers: 10, found: 3, by: alan.id })
  instance(r.id, 3, { status: 'abandoned', started: false, answers: 10, found: 0 })
  instance(r.id, 4, { status: 'abandoned', started: true, answers: 10, found: 2, by: alan.id })

  const history = rooms.roomHistory(r.id)

  // The live one and the one that never started are both absent.
  assert.deepEqual(history.map((h) => h.seq), [1, 4])
  assert.equal(history[0].found, 7)
  assert.equal(history[1].found, 2)
})

test('an answer says who got it, and an unfound one says nobody', () => {
  const r = room('history-2@example.com')
  const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant
  instance(r.id, 1, { status: 'complete', started: true, answers: 10, found: 2, by: alan.id })

  const [round] = rooms.roomHistory(r.id)
  assert.equal(round.answers.length, 10)
  // Rank order, whatever order they were found in.
  assert.deepEqual(round.answers.map((a) => a.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(round.answers[0].foundBy, 'Alan')
  assert.equal(round.answers[9].foundBy, null)
})

test('a long unordered pool is capped, and the cap never eats a found name', () => {
  const r = room('history-3@example.com')
  const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant
  // 200 in the pool. The ten that were found are ranks 191..200 — the very
  // end of it, which a naive "first forty by rank" would throw away.
  const id = instance(r.id, 1, { status: 'complete', started: true, ordered: false, answers: 200, found: 0 })
  sqlite
    .prepare(
      `UPDATE game_round_answers SET found_at_ms = rank, found_by_participant_id = ?
        WHERE instance_id = ? AND rank > 190`,
    )
    .run(alan.id, id)

  const [round] = rooms.roomHistory(r.id)
  assert.equal(round.found, 10)
  assert.equal(round.answers.length, 40)
  assert.equal(round.more, 160)
  // Every one of the ten is in the list, despite living past the cap.
  const found = round.answers.filter((a) => a.foundBy === 'Alan').map((a) => a.rank)
  assert.deepEqual(found, [191, 192, 193, 194, 195, 196, 197, 198, 199, 200])
})

test('a sweep that overfills the board still reads as ten of ten', () => {
  const r = room('history-4@example.com')
  const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant
  // One guess fills every open slot it names — "Cole" at a board of Coles
  // takes all three — so a sweep landing on the last slot ends the round
  // with eleven found against a target of ten. The game scored ten and the
  // board drew ten; the review must not be the one screen saying otherwise.
  instance(r.id, 1, { status: 'complete', started: true, answers: 11, found: 11, by: alan.id })

  const [round] = rooms.roomHistory(r.id)
  assert.equal(round.found, 10)
  // The eleventh is still listed, and still credited to whoever swept it.
  assert.equal(round.answers.length, 11)
  assert.equal(round.answers.filter((a) => a.foundBy === 'Alan').length, 11)
})

test('a ranked round shows the fifty, and says which ten were the board', () => {
  const r = room('history-5@example.com')
  const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant
  // What a ranked round actually freezes: ten on the board and a hundred and
  // ninety behind them, kept so a near miss can be told it was sixteenth
  // without asking the database again mid-round.
  instance(r.id, 1, { status: 'complete', started: true, answers: 10, found: 7, by: alan.id, tail: 190 })

  const [round] = rooms.roomHistory(r.id)
  // Fifty deep, not ten and not two hundred.
  assert.equal(round.answers.length, 50)
  assert.deepEqual(round.answers.map((a) => a.rank).slice(0, 3), [1, 2, 3])
  assert.equal(round.answers.at(-1)?.rank, 50)

  // And the line between them survives the trip, because the two kinds of
  // name mean opposite things: one is an answer that went missing and the
  // other was never on offer.
  assert.equal(round.answers.filter((a) => a.onBoard).length, 10)
  assert.equal(round.answers.filter((a) => !a.onBoard).length, 40)

  // The score is still out of ten. Forty extra names on the screen must not
  // turn 7 of 10 into 7 of 50.
  assert.equal(round.found, 7)
  assert.equal(round.target, 10)
  // And nothing in the tail is credited to anybody.
  assert.equal(round.answers.filter((a) => !a.onBoard && a.foundBy != null).length, 0)
  // "N more would also have counted" is about an unordered pool. None of
  // these would have counted, so the footer stays silent.
  assert.equal(round.more, 0)
})
