import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The career span on a clue, for somebody who has not finished having one.
//
// An infobox writes an unfinished spell "2020–", with nothing after the dash.
// That open end is the only thing on file that says a player is still playing,
// and the span ignored it — so Patrik Schick, at Leverkusen since 2020 and
// still scoring, was clued as "2014–2020". The end of the span was the year he
// joined his current club, which reads as the year he stopped.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'clue-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { cluesForFootballers } = await import('./tenable.ts')

function player(name: string, spells: [string, string, number][]): number {
  const { id } = sqlite
    .prepare(
      `INSERT INTO footballers (name, wikipedia_url, nationality)
       VALUES (?, ?, 'Czech Republic') RETURNING id`,
    )
    .get(name, `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }
  for (const [years, club, apps] of spells) {
    sqlite
      .prepare(
        `INSERT INTO career_stints (footballer_id, sort_order, years, club, apps, stint_type)
         VALUES (?, 0, ?, ?, ?, 'senior')`,
      )
      .run(id, years, club, apps)
  }
  return id
}

const schick = player('Patrik Schick', [
  ['2014–2016', 'Sparta Prague', 4],
  ['2016–2017', 'Sampdoria', 32],
  ['2017–2020', 'Roma', 46],
  ['2020–', 'Bayer Leverkusen', 150],
])
const retired = player('Tomas Rosicky', [
  ['1998–2001', 'Sparta Prague', 42],
  ['2001–2006', 'Borussia Dortmund', 136],
  ['2006–2016', 'Arsenal', 170],
])
const oneSeason = player('Josef Jednorok', [['2016', 'Slavia Prague', 30]])

const years = (id: number) => cluesForFootballers([id]).get(id)?.years

test('a career still being had is left open', () => {
  assert.equal(years(schick), '2014–')
})

test('a finished career still says when it finished', () => {
  assert.equal(years(retired), '1998–2016')
})

test('a single closed season is not mistaken for an open one', () => {
  assert.equal(years(oneSeason), '2016–2016')
})
