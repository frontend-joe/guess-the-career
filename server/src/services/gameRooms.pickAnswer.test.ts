import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Which answer a guess refers to, when more than one of them fits.
//
// The board that forced this: "Serie A players with 4-letter surnames (most
// appearances)" holds Cristiano Doni at 8th, and ALSO a Roma goalkeeper whose
// entire name is "Doni", 23rd with 149 appearances — deep enough to be off
// the board but shallow enough to be in the frozen fifty. Typing "Doni" at an
// empty 8th slot came back as a near miss on the keeper.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'pick-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const rooms = await import('./gameRooms.ts')

function player(name: string, apps: number): void {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, 'Italy') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, 'Doniville', 'Serie A', 'Serie A', '2010-11', ?, 0)`,
    )
    .run(id, apps)
}

// Eight ahead of him, so Cristiano Doni is 9th and on the board…
for (let i = 1; i <= 8; i++) player(`Filler ${i}`, 500 - i)
player('Cristiano Doni', 278)
player('Filler 9', 270)
// …and five more between, so the keeper is 15th: off the board, inside the
// frozen fifty. Exactly the shape of the real round.
for (let i = 10; i <= 13; i++) player(`Filler ${i}`, 200 + i)
player('Doni', 149)

const roundId = (sqlite
  .prepare(
    `INSERT INTO tenable_rounds (category, type, params, metric, title, answer_count)
     VALUES ('football', 'club', ?, 'apps', 'Doniville players (most appearances)', 10) RETURNING id`,
  )
  .get(JSON.stringify({ club: 'Doniville' })) as { id: number }).id

let hostNo = 0
function liveRound() {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(`pick-${++hostNo}@example.com`) as { id: number }
  const room = rooms.createRoom({ id: user.id, displayName: 'Host' }, 'Test')
  const host = rooms.participantsOf(room.id)[0]
  const inst = rooms.freezeRound(room.id, roundId)
  rooms.startRound(room.id, inst.id)
  return { room, host, inst }
}

test('a bare surname fills the open slot, not the exact match that is off the board', () => {
  const { host, inst } = liveRound()
  const result = rooms.submitGuess(inst.id, host, 'g1', 'Doni')

  assert.equal(result.verdict, 'hit')
  assert.equal(result.name, 'Cristiano Doni')
  assert.equal(result.rank, 9)
})

test('once the slot is filled the exact match is the near miss it always was', () => {
  const { host, inst } = liveRound()
  rooms.submitGuess(inst.id, host, 'g1', 'Cristiano Doni')

  // Nothing open fits any more, so the keeper is the honest reading — and
  // "15th, 149 apps" is a useful thing to be told.
  const again = rooms.submitGuess(inst.id, host, 'g2', 'Doni')
  assert.equal(again.verdict, 'near')
  assert.equal(again.name, 'Doni')
  assert.equal(again.rank, 15)
})

test('an exact full name still beats a surname that fits somebody else', () => {
  // The rule this replaced was put there for Javier and Cristiano Zanetti,
  // both on the board. Naming one in full must not credit the other.
  const { host, inst } = liveRound()
  const result = rooms.submitGuess(inst.id, host, 'g1', 'Cristiano Doni')
  assert.equal(result.verdict, 'hit')
  assert.equal(result.name, 'Cristiano Doni')
})
