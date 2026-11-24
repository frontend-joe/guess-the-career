import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The second clue: the host gives away the initials of an answer whose clue
// is already up.
//
// Everything else in a clue was decided when the round was frozen — it
// describes the player, out of the snapshot, and the same sheet would say the
// same thing an hour later. This one is decided at the time, by somebody
// choosing to spend it, which is why it is its own event rather than a tenth
// field in the clue: a recording has to show the moment it was handed over.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'initials-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')
const { norm } = await import('./nameMatch.ts')

const GOALS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]

function striker(name: string, goals: number): number {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, 'France') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, 'Initialsville', 'Premier League', 'Premier League', '2020-21', 30, ?)`,
    )
    .run(id, goals)
  return id
}

const NAMES = [
  'Laurent Robert', 'Charles Nzogbia', 'Moussa Sissoko', 'Yoan Gouffran',
  'Allan Saint-Maximin', 'Olivier Bernard', 'Yohan Cabaye', 'Hatem Ben Arfa',
  'David Ginola', 'Didier Domi',
]
NAMES.forEach((n, i) => striker(n, GOALS[i]))

const roundId = (sqlite
  .prepare(
    `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
     VALUES ('football', 'club', ?, 'goals', 'Initialsville players (most goals)', 10) RETURNING id`,
  )
  .get(JSON.stringify({ club: 'Initialsville' })) as { id: number }).id

let seq = 0
function liveRound() {
  seq += 1
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(`initials-host${seq}@example.com`) as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)
  return { room, host, inst }
}

const hintsOf = (code: string) =>
  rooms.roomState(rooms.roomByCode(code)!).round!.board.hints

test('every word gives a letter, and a double-barrelled name counts once', () => {
  assert.equal(rooms.initialsOf('David Ginola'), 'D.G.')
  assert.equal(rooms.initialsOf('Virgil van Dijk'), 'V.V.D.')
  // A mononym is a thin clue, but an honest one.
  assert.equal(rooms.initialsOf('Ronaldinho'), 'R.')
  // A.S-M. would hand over the shape of the name as well as the letters,
  // which is most of the answer on a board with one hyphenated name on it.
  assert.equal(rooms.initialsOf('Allan Saint-Maximin'), 'A.S.')
})

test('the initials land on the clue that is already open', () => {
  const { room, host, inst } = liveRound()
  rooms.takeHint(inst.id, host, 9)
  assert.equal(hintsOf(room.code).find((h) => h.rank === 9)?.initials, null)

  const result = rooms.takeInitials(inst.id, host, 9)
  assert.equal(result.initials, 'D.G.')
  assert.equal(result.replayed, false)
  assert.equal(hintsOf(room.code).find((h) => h.rank === 9)?.initials, 'D.G.')
  // And nowhere else: one answer was opened up, not the board.
  assert.equal(hintsOf(room.code).filter((h) => h.initials != null).length, 1)
})

test('asking twice is not a second clue and does not move the version', () => {
  const { room, host, inst } = liveRound()
  rooms.takeHint(inst.id, host, 1)
  const first = rooms.takeInitials(inst.id, host, 1)
  const again = rooms.takeInitials(inst.id, host, 1)

  assert.equal(again.replayed, true)
  assert.equal(again.initials, first.initials)
  // A recording should not blink, and the room should not get a second ping.
  assert.equal(again.stateVersion, first.stateVersion)
  assert.equal(
    (sqlite
      .prepare("SELECT COUNT(*) AS n FROM game_events WHERE instance_id = ? AND type = 'initials'")
      .get(inst.id) as { n: number }).n,
    1,
  )
  assert.equal(hintsOf(room.code).find((h) => h.rank === 1)?.initials, 'L.R.')
})

test('a slot with no clue on it has nowhere to put them', () => {
  const { host, inst } = liveRound()
  assert.throws(() => rooms.takeInitials(inst.id, host, 4), /No clue on that slot yet/)
})

test('only the host spends a clue', () => {
  const { room, host, inst } = liveRound()
  rooms.takeHint(inst.id, host, 2)
  const { participant: guest } = rooms.joinRoom(room.code, 'Mate')

  assert.throws(() => rooms.takeInitials(inst.id, guest, 2), /Only the host/)
  assert.equal(hintsOf(room.code).find((h) => h.rank === 2)?.initials, null)
})

test('an answer already on the board has nothing left to give away', () => {
  const { room, host, inst } = liveRound()
  rooms.takeHint(inst.id, host, 3)
  assert.equal(rooms.submitGuess(inst.id, host, 'g1', 'Moussa Sissoko').verdict, 'hit')

  assert.throws(() => rooms.takeInitials(inst.id, host, 3), /already found/)
  void room
})

test('the initials follow their player down a reshuffled board', () => {
  const { room, host, inst } = liveRound()
  // A clue, and its initials, on the man who is currently sixth.
  rooms.takeHint(inst.id, host, 6)
  rooms.takeInitials(inst.id, host, 6)
  assert.equal(hintsOf(room.code).find((h) => h.rank === 6)?.initials, 'O.B.')

  // The database catches up: somebody better than him was missing when the
  // round was frozen, so he is seventh now.
  const latecomer = striker('Late Arrival', 55)
  rooms.reshuffleForPlayer(inst.id, latecomer, norm('Late Arrival'))

  const hints = hintsOf(room.code)
  assert.equal(hints.find((h) => h.rank === 7)?.initials, 'O.B.')
  // Not left sitting on the slot, describing whoever moved into it.
  assert.equal(hints.find((h) => h.rank === 6)?.initials ?? null, null)
})
