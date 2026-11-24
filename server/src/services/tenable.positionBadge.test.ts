import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The position rounds carry no badge.
//
// "Arsenal goalkeepers" and "Brazilian goalkeepers" ask who was one of a
// group. Nothing is ranked, so a number beside the name reads as a placing
// that does not exist — and the number itself was often wrong: it is summed
// from Wikipedia's career-statistics table, which about a quarter of players
// on file do not have. Zetti kept goal 155 times for São Paulo and his board
// said "0 apps".
//
// Both apps drop the badge when there is no unit and the value is zero, the
// same way a squad round hides shirt numbers, so saying nothing is a matter
// of what the server emits.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'posbadge-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound } = await import('./tenable.ts')

// A keeper with a career-statistics table, and one with nothing but a name.
function keeper(name: string, apps: number | null): number {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality, position)
       VALUES (?, ?, ?, 'Brazil', 'Goalkeeper') RETURNING id`,
    )
    .get(name, name.split(' ').pop(), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as {
    id: number
  }).id
  if (apps !== null) {
    sqlite
      .prepare(
        `INSERT INTO career_statistics
           (footballer_id, sort_order, club, season, division, league, league_apps, league_goals)
         VALUES (?, 0, 'Arsenal', '2010-11', 'Premier League', 'Premier League', ?, 0)`,
      )
      .run(id, apps)
  }
  return id
}

keeper('Busy Keeper', 300)
keeper('Quiet Keeper', 20)
// The Zetti case: a real player the appearance table has never heard of.
keeper('Undocumented Keeper', null)

const CLUB = { club: 'Arsenal', position: 'goalkeeper' }
const COUNTRY = { nationality: 'Brazil', position: 'goalkeeper' }

test('a position round sends no badge at all', () => {
  for (const [type, params] of [
    ['club-position', CLUB],
    ['nationality-position', COUNTRY],
  ] as const) {
    const answers = answersForRound(type, params, 'apps')
    assert.ok(answers.length > 0, `${type} has answers`)
    for (const a of answers) {
      // The pair both apps read as "draw nothing here".
      assert.equal(a.value, 0, `${type}: ${a.name} carries no number`)
      assert.ok(!a.unit, `${type}: ${a.name} carries no unit`)
    }
  }
})

test('the pool is still ordered by who actually played', () => {
  // The badge is gone; the ordering it used to come from is not. Only the
  // first two hundred answers are frozen into a round, and the ones worth
  // keeping are the players with a career behind them.
  const names = answersForRound('nationality-position', COUNTRY, 'apps').map((a) => a.name)
  assert.deepEqual(names, ['Busy Keeper', 'Quiet Keeper', 'Undocumented Keeper'])
})

test('a player with no appearance table is still an answer', () => {
  // He was never excluded, but he used to arrive wearing a nought.
  const answers = answersForRound('nationality-position', COUNTRY, 'apps')
  assert.ok(answers.some((a) => a.name === 'Undocumented Keeper'))
})
