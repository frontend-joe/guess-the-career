import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// When a player the database had never heard of is scraped mid-round, two
// separate questions get asked about them, and for a while they were one:
//
//   1. Do they belong on this round's board?  — decides whether the scrape is
//      KEPT, because Tenable only learns people who were on the board of the
//      round that asked.
//   2. Can the live board be rewritten to include them? — decides whether the
//      guess SCORES, and may be no for reasons that say nothing about the
//      player.
//
// Answering 2 and treating it as 1 deletes real footballers out of the
// database and blacklists their names. İlkay Gündoğan went that way: sixth on
// Germany's Premier League goals, with the board's sixth slot empty, but
// adding him pushed the already-found tenth off the bottom — so the board
// refused, correctly, and he was deleted for it.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'reshuffle-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')
const { norm } = await import('./nameMatch.ts')

// Spaced out so a new arrival can be dropped cleanly between two of them.
const GOALS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]

function striker(name: string, goals: number): number {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, 'England') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, 'Testville', 'Premier League', 'Premier League', '2020-21', 30, ?)`,
    )
    .run(id, goals)
  return id
}

const ids = GOALS.map((g, i) => striker(`Tenth Man ${i + 1}`, g))

const roundId = (sqlite
  .prepare(
    `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
     VALUES ('football', 'club', ?, 'goals', 'Testville players (most goals)', 10) RETURNING id`,
  )
  .get(JSON.stringify({ club: 'Testville' })) as { id: number }).id

test('a correction goes on the board even though it pushes a find off the bottom', () => {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('reshuffle-host@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  // Nine of the ten found, the sixth slot left open — the shape of the board
  // in the screenshot this came from.
  ids.forEach((_, i) => {
    if (i === 5) return
    assert.equal(rooms.submitGuess(inst.id, host, `g${i}`, `Tenth Man ${i + 1}`).verdict, 'hit')
  })

  // The database catches up: a real player, better than the sixth-placed one,
  // who was missing when the round was frozen. He is sixth now, which pushes
  // the tenth — already found, already on screen — off the bottom.
  const latecomer = striker('Late Arrival', 55)

  const outcome = rooms.reshuffleForPlayer(inst.id, latecomer, norm('Late Arrival'))

  assert.equal(outcome.belongs, true)
  assert.equal(outcome.placed?.rank, 6)

  const board = rooms.roomState(rooms.roomByCode(room.code)!).round!.board
  assert.deepEqual(
    board.revealed.map((r) => r.name),
    // Sixth is filled, everybody below has shifted down one, and the old
    // tenth is off the bottom. This is a collaborative board, not a
    // scoreboard: being right beats protecting a tenth place.
    ['Tenth Man 1', 'Tenth Man 2', 'Tenth Man 3', 'Tenth Man 4', 'Tenth Man 5',
     'Late Arrival', 'Tenth Man 7', 'Tenth Man 8', 'Tenth Man 9'],
  )

  // Nothing is taken off the people who were right. The pushed-off player's
  // guess is still a hit in the feed and in the recording.
  assert.equal(board.guesses.find((g) => g.raw === 'Tenth Man 10')!.verdict, 'hit')

  // And the slot that opened at the bottom is one more for the room to fill,
  // so the round is not over.
  assert.equal(board.ended, null)
})

test('a player who is not on the board at all belongs to nobody', () => {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('reshuffle-host-2@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  // One goal: real, qualifies for the round, nowhere near the top ten. The
  // rule the user asked for — only learn people who were on the board — still
  // has to throw this one away.
  const nobody = striker('Barely There', 1)
  const outcome = rooms.reshuffleForPlayer(inst.id, nobody, norm('Barely There'))

  assert.equal(outcome.belongs, false)
  assert.equal(outcome.placed, null)
})

// A clue is about a player, not about a row of the pyramid. Importing Pablo
// Armero pushed the Colombia Serie A board down a slot below him, and the
// clues already taken stayed on the slots they were taken on — so the clue on
// 9 described the man who had just moved to 10, and taking the clue on 10
// produced the same man a second time.
test('clues follow their player when the board is rewritten under them', () => {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('reshuffle-host-3@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  // The ninth man, clued while he is still the ninth man.
  const ninth = rooms.takeHint(inst.id, host, 9)
  assert.equal(ninth.replayed, false)

  // A latecomer lands above him, so he is the tenth man now.
  rooms.reshuffleForPlayer(inst.id, striker('Late Comer', 55), norm('Late Comer'))

  const hints = rooms.roomState(rooms.roomByCode(room.code)!).round!.board.hints
  assert.equal(hints.length, 1)
  assert.equal(hints[0].rank, 10, 'his clue moved down with him')
  assert.deepEqual(hints[0].clue, ninth.clue)

  // The ninth slot belongs to somebody else now, and nobody has paid for a
  // clue on him — so asking is a new clue, not a replay of the old one.
  // (These fixtures all carry the same bare clue, so it is the replayed flag
  // and the ranks below, not the clue's contents, that say which man it is.)
  assert.equal(rooms.takeHint(inst.id, host, 9).replayed, false)

  const after = rooms.roomState(rooms.roomByCode(room.code)!).round!.board.hints
  assert.deepEqual(after.map((h) => h.rank), [9, 10])
})

// Whoever gets pushed off the bottom takes their clue with them, rather than
// leaving it on a slot that is now somebody else's.
test('a clue on a player pushed off the board goes with them', () => {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get('reshuffle-host-4@example.com') as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)

  rooms.takeHint(inst.id, host, 10)
  rooms.reshuffleForPlayer(inst.id, striker('Queue Jumper', 55), norm('Queue Jumper'))

  assert.deepEqual(rooms.roomState(rooms.roomByCode(room.code)!).round!.board.hints, [])
})
