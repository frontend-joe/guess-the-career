import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Two real footballers share the name "Idrissa Gueye", and Wikipedia's search
// ranks the teenager above the Everton midfielder. The round knows it is an
// Everton round; this is the check that lets it say so.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'hint-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { careerMatchesHint } = await import('./playerImport.ts')

function player(name: string): number {
  return (sqlite
    .prepare(`INSERT INTO footballers (name, wikipedia_url) VALUES (?, ?) RETURNING id`)
    .get(name, `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }).id
}

function stint(id: number, club: string) {
  sqlite
    .prepare(
      `INSERT INTO career_stints (footballer_id, sort_order, years, club, stint_type)
       VALUES (?, 0, '2016-2019', ?, 'senior')`,
    )
    .run(id, club)
}

function season(id: number, club: string, league: string) {
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, league_apps, league_goals)
       VALUES (?, ?, ?, ?, '2016-17', 30, 1)`,
    )
    .run(id, club, league, league)
}

const everton = player('Idrissa Gueye')
stint(everton, 'Everton')
season(everton, 'Everton', 'Premier League')

const teenager = player('Idrissa Gueye (footballer, born 2006)')
stint(teenager, 'Génération Foot')
season(teenager, 'Génération Foot', 'Senegal Ligue 1')

test('the club hint tells two players of the same name apart', () => {
  assert.equal(careerMatchesHint(everton, 'Everton'), true)
  assert.equal(careerMatchesHint(teenager, 'Everton'), false)
})

test('a league round hints a competition, not a squad', () => {
  assert.equal(careerMatchesHint(everton, 'Premier League'), true)
  assert.equal(careerMatchesHint(teenager, 'Premier League'), false)
  assert.equal(careerMatchesHint(teenager, 'Senegal Ligue 1'), true)
})

// A club written two ways is still one club, the same rule the boards use.
test('the hint survives a club spelled differently', () => {
  const dario = player('Dario Simic')
  stint(dario, 'Internazionale Milano')
  assert.equal(careerMatchesHint(dario, 'Inter Milan'), true)
})

// No hint means no opinion: the bulk importers pass '' and must not have
// every candidate silently rejected.
test('an empty hint matches nobody, so it can never outrank a real one', () => {
  assert.equal(careerMatchesHint(everton, ''), false)
})

const { titleMatchesName, stripDiacritics } = await import('./playerImport.ts')
const parts = (name: string) => stripDiacritics(name).split(/\s+/).filter((p) => p.length > 2)

// Wikipedia files him under "Idrissa Gueye". The name everybody calls him by
// carries a middle name the title leaves out, and that used to disqualify the
// article — so the common name was the one thing that could not find him.
test('a middle name the article title omits no longer disqualifies it', () => {
  const title = 'Idrissa Gueye (footballer, born 1989)'
  assert.equal(titleMatchesName(title, parts('Idrissa Gana Gueye')), true)
  assert.equal(titleMatchesName(title, parts('Idrissa Gueye')), true)
})

// The loosening is only ever about EXTRA words. With one given name it is the
// same rule it always was, so a wrong first name still cannot reach a right
// surname.
test('a wrong given name still cannot reach a matching surname', () => {
  assert.equal(titleMatchesName('Alan Smith', parts('John Smith')), false)
  assert.equal(titleMatchesName('Lilian Thuram', parts('Marcus Thuram')), false)
  assert.equal(titleMatchesName('Idrissa Gueye', parts('Makhtar Gueye')), false)
})

test('a surname that does not appear is still rejected outright', () => {
  assert.equal(titleMatchesName('Idrissa Gueye', parts('Idrissa Gana Diop')), false)
})
