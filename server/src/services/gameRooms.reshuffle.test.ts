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

test('a correct answer the board cannot take is still a player worth keeping', () => {
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

  // The board is right to refuse. Taking a find away from somebody who
  // earned it is worse than the board being one name short.
  assert.equal(outcome.placed, null)
  // But he is on this round's board by every honest reading of it, so he is
  // the scrape's to keep. This is the assertion that was failing.
  assert.equal(outcome.belongs, true)
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
