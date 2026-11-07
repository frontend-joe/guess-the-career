import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// When a guess is worth waking everybody's phone for.
//
// The rule is "once per quiet spell, whoever guesses first", and it is
// carried entirely by the guesses already in the table — there is no flag to
// set and nothing to reset. These tests are about the two ways that can be
// got wrong: pinging on a guess that follows another one closely, and
// pinging seconds after the round-start notification has already gone out.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'quiet-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const rooms = await import('./gameRooms.ts')

// A full board, because freezing a round refuses to make one out of fewer
// than ten answers.
function quietville(name: string, apps: number): void {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, 'England') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}_q`) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, 'Quietville', 'Premier League', 'Premier League', '2010-11', ?, 0)`,
    )
    .run(id, apps)
}

quietville('Quiet Man', 300)
for (let i = 1; i <= 11; i++) quietville(`Reserve ${i}`, 200 - i)

const roundId = (sqlite
  .prepare(
    `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
     VALUES ('football', 'club', ?, 'apps', 'Quietville players (most appearances)', 10) RETURNING id`,
  )
  .get(JSON.stringify({ club: 'Quietville' })) as { id: number }).id

let hostNo = 0

function room() {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(`quiet-${++hostNo}@example.com`) as { id: number }
  const created = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(created.id)[0]
  const inst = rooms.freezeRound(created.id, roundId)
  rooms.startRound(created.id, inst.id)
  return { roomId: created.id, host, inst }
}

/// Backdate everything that counts as activity, the way an hour of nobody
/// touching the room would have.
function ageBy(roomId: number, minutes: number): void {
  sqlite
    .prepare(
      `UPDATE game_guesses SET created_at = datetime(created_at, ?)
        WHERE instance_id IN (SELECT id FROM game_round_instances WHERE room_id = ?)`,
    )
    .run(`-${minutes} minutes`, roomId)
  sqlite
    .prepare('UPDATE game_round_instances SET started_at_ms = started_at_ms - ? WHERE room_id = ?')
    .run(minutes * 60_000, roomId)
}

test('a brand new room is not quiet, however little has happened in it', () => {
  const { roomId } = room()
  // Creating it told everybody about thirty seconds ago. The first guess of a
  // new game is the game working, not news.
  assert.equal(rooms.roomWentQuiet(roomId, 30), false)
})

test('a guess that follows another one is not news', () => {
  const { roomId, host, inst } = room()
  rooms.submitGuess(inst.id, host, 'g1', 'Quiet Man')
  assert.equal(rooms.roomWentQuiet(roomId, 30), false)
})

test('a guess after a long silence is', () => {
  const { roomId, host, inst } = room()
  rooms.submitGuess(inst.id, host, 'g1', 'Quiet Man')
  ageBy(roomId, 45)
  assert.equal(rooms.roomWentQuiet(roomId, 30), true)
})

test('and only the one that breaks it', () => {
  const { roomId, host, inst } = room()
  rooms.submitGuess(inst.id, host, 'g1', 'Quiet Man')
  ageBy(roomId, 45)
  assert.equal(rooms.roomWentQuiet(roomId, 30), true)
  // Whoever got there first has already woken everybody up. The second guess
  // is a miss, which would queue a Wikipedia lookup — marking it settled
  // first keeps the suite off the network.
  sqlite
    .prepare(
      "INSERT INTO game_guess_reviews (instance_id, raw, raw_norm, status) VALUES (?, 'Nobody At All', 'nobody at all', 'rejected')",
    )
    .run(inst.id)
  rooms.submitGuess(inst.id, host, 'g2', 'Nobody At All')
  assert.equal(rooms.roomWentQuiet(roomId, 30), false)
})

test('a round that has just started is not a quiet room', () => {
  const { roomId, host, inst } = room()
  rooms.submitGuess(inst.id, host, 'g1', 'Quiet Man')
  ageBy(roomId, 45)
  // The round-start ping went out seconds ago and says the same thing to the
  // same people. Without this the room would be announced twice over.
  const second = rooms.freezeRound(roomId, roundId)
  rooms.startRound(roomId, second.id)
  assert.equal(rooms.roomWentQuiet(roomId, 30), false)
})
