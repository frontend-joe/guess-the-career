import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// "South American Arsenal players", "African Roma players". A club's Africans
// or its South Americans are a group everybody who follows it can picture and
// nobody can list, which is the whole shape of a Tenable round.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'continent-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { answersForRound, candidatesForType } = await import('./tenable.ts')
const { continentOf } = await import('./continents.ts')

function player(name: string, nationality: string, club: string, goals: number) {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`, nationality) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, total_apps, total_goals)
       VALUES (?, ?, 'Premier League', 'Premier League', '2020-21', 30, ?)`,
    )
    .run(id, club, goals)
  return id
}

// Eleven Africans from eight countries, so no single nationality could carry
// the board on its own — which is the reason this round exists.
const AFRICANS: [string, string][] = [
  ['Nigeria', 'Nnamdi One'], ['Nigeria', 'Chinedu Two'], ['Ghana', 'Kwame Three'],
  ['Ivory Coast', 'Yaya Four'], ['Senegal', 'Sadio Five'], ['Cameroon', 'Samuel Six'],
  ['Egypt', 'Mohamed Seven'], ['Morocco', 'Hakim Eight'], ['Mali', 'Seydou Nine'],
  ['DR Congo', 'Dieumerci Ten'], ['Zaire', 'Historic Eleven'],
]
AFRICANS.forEach(([nat, name], i) => player(name, nat, 'Arsenal', 20 - i))
// And a crowd of Europeans at the same club, who must not turn up on it.
for (let i = 0; i < 12; i++) player(`English Lad ${i}`, 'England', 'Arsenal', 40)

test('a club\'s continent is a round when enough of them played there', () => {
  const cands = candidatesForType('continent-club')
  const arsenal = cands.find((c) => c.params.club === 'Arsenal' && c.params.continent === 'africa')
  assert.ok(arsenal, 'Arsenal has an African round')
  assert.equal(arsenal.answer_count, AFRICANS.length)
  assert.equal(arsenal.title, 'African Arsenal players (most goals)')

  // Being European at a club is the default state of a footballer, not a
  // fact worth a board, however many of them there are.
  assert.equal(cands.some((c) => c.params.continent === 'europe'), false)
})

test('the answers are that continent and only that continent', () => {
  const answers = answersForRound('continent-club', { continent: 'africa', club: 'Arsenal' }, 'goals')
  assert.equal(answers.length, 10)
  assert.deepEqual(answers.map((a) => a.name).slice(0, 3), ['Nnamdi One', 'Chinedu Two', 'Kwame Three'])
  assert.equal(answers.some((a) => a.name.startsWith('English Lad')), false)
})

// A nationality is whatever the infobox said at the time, and the database
// holds states that no longer exist.
test('a country that has since been renamed is still on its continent', () => {
  assert.equal(continentOf('Zaire'), 'africa')
  assert.equal(continentOf('Yugoslavia'), 'europe')
  assert.equal(continentOf('U.S.'), 'north-america')
  assert.equal(continentOf('Atlantis'), null)
})
