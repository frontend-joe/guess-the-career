import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// One club written two ways was two clubs. Hellas Verona and Verona each had
// their own round with half the players on it, and Dario Šimić's four seasons
// at "Internazionale Milano" belonged to no Inter round at all.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'club-spelling-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const { candidatesForType, answersForRound } = await import('./tenable.ts')

function club(name: string, url: string) {
  sqlite.prepare('INSERT INTO clubs (name, wikipedia_url) VALUES (?, ?)').run(name, url)
}

function player(name: string, club: string, league: string | null, apps: number) {
  const id = (sqlite
    .prepare(
      `INSERT INTO footballers (name, surname, wikipedia_url, nationality)
       VALUES (?, ?, ?, 'Italy') RETURNING id`,
    )
    .get(name, name.split(' ').at(-1), `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }).id
  sqlite
    .prepare(
      `INSERT INTO career_statistics
         (footballer_id, club, division, league, season, total_apps, total_goals)
       VALUES (?, ?, ?, ?, '2010-11', ?, 1)`,
    )
    .run(id, club, league, league, apps)
  return id
}

const VERONA = 'https://en.wikipedia.org/wiki/Hellas_Verona_F.C.'
club('Hellas Verona', VERONA)
club('Verona', VERONA)

// Six under the long name and six under the short one. Ten of either is a
// board; six of either is nothing, which is how a club with twelve players
// ends up with no round at all.
for (let i = 0; i < 6; i++) player(`Long Name ${i}`, 'Hellas Verona', 'Serie A', 30 + i)
for (let i = 0; i < 6; i++) player(`Short Name ${i}`, 'Verona', 'Serie A', 20 + i)

test('two spellings of one club are one club', () => {
  const cands = candidatesForType('club')
  const verona = cands.filter((c) => (c.params.club ?? '').includes('Verona'))
  assert.equal(verona.length, 2, 'one club, one round per metric — not two clubs')
  // The article decides the spelling, and CLUB_BY_URL picks whichever name
  // carries the most players. Both rounds must agree on it.
  assert.deepEqual([...new Set(verona.map((c) => c.params.club))], ['Hellas Verona'])
  assert.equal(verona[0].answer_count, 12, 'everybody, under either spelling')

  const answers = answersForRound('club', { club: 'Hellas Verona' }, 'apps')
  assert.equal(answers.length, 10)
  assert.ok(answers.some((a) => a.name.startsWith('Short Name')), 'the short-name six are on it')
  assert.ok(answers.some((a) => a.name.startsWith('Long Name')), 'and so are the long-name six')
})

test('a spelling the clubs table has never heard of still lands, via the alias map', () => {
  // Nothing anywhere links "Internazionale Milano" to Inter — there is no
  // clubs row for it, so the article route cannot help. The alias map is the
  // only thing standing between those appearances and the board.
  for (let i = 0; i < 10; i++) player(`Nerazzurro ${i}`, 'Inter Milan', 'Serie A', 40 + i)
  const simic = player('Dario Šimić', 'Internazionale Milano', null, 94)

  const cands = candidatesForType('club')
  const inter = cands.filter((c) => (c.params.club ?? '').includes('Inter'))
  assert.deepEqual([...new Set(inter.map((c) => c.params.club))], ['Inter Milan'])
  assert.equal(inter[0].answer_count, 11, 'ten plus the one written the other way')

  const answers = answersForRound('club', { club: 'Inter Milan' }, 'apps')
  assert.equal(answers[0].name, 'Dario Šimić', '94 appearances is the most of any of them')
  assert.equal(answers[0].value, 94)
  assert.equal(answers[0].footballer_id, simic)
})
