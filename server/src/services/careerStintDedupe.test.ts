import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Fernando Cáceres's six years at Celta were on his card twice, once as
// "Celta" and once as "Celta Vigo", because the check that asks whether a
// spell is already stored compared the raw club string and the alias map had
// grown between the two scrapes. 0117 clears the strays.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'stint-dedupe-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

// The migration itself has already run against an empty table by the time we
// can seed anything, so run its SQL again over the rows we care about. It is
// the file on disk, not a copy of it, so the test cannot drift from what ships.
const dedupe = readFileSync(
  new URL('../db/migrations/0117_dedupe_aliased_club_stints.sql', import.meta.url),
  'utf8',
)

function player(name: string) {
  return (
    sqlite
      .prepare(`INSERT INTO footballers (name, wikipedia_url) VALUES (?, ?) RETURNING id`)
      .get(name, `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`) as { id: number }
  ).id
}

function stint(
  id: number,
  sortOrder: number,
  years: string,
  club: string,
  apps: number | null,
  goals: number | null = 0,
  type = 'senior',
) {
  sqlite
    .prepare(
      `INSERT INTO career_stints (footballer_id, sort_order, years, club, apps, goals, stint_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, sortOrder, years, club, apps, goals, type)
}

function stintsOf(id: number) {
  return sqlite
    .prepare(`SELECT club, years, apps, goals FROM career_stints WHERE footballer_id = ? ORDER BY sort_order`)
    .all(id) as { club: string; years: string; apps: number | null; goals: number | null }[]
}

test('one spell stored under two spellings of the club becomes one spell', () => {
  const id = player('Fernando Cáceres')
  stint(id, 5, '1998–2004', 'Celta', 198, 3)
  stint(id, 9, '1992–1997', 'Argentina', 24, 1, 'international')
  stint(id, 10, '1998–2004', 'Celta Vigo', 198, 3)

  sqlite.exec(dedupe)

  const rows = stintsOf(id)
  assert.deepEqual(
    rows.map((r) => r.club),
    ['Celta', 'Argentina'],
  )
  // The surviving row keeps the career's real order — the duplicate was
  // appended after the national team, which is not where he played.
  assert.equal(rows[0].apps, 198)
})

test('the kept row takes the newer scrape\'s appearance count', () => {
  const id = player('Still Playing')
  stint(id, 0, '2021–', 'Spurs', 40, 2)
  stint(id, 1, '2021–', 'Tottenham Hotspur', 71, 9)

  sqlite.exec(dedupe)

  assert.deepEqual(stintsOf(id), [{ club: 'Spurs', years: '2021–', apps: 71, goals: 9 }])
})

// normalize_club_alias() strips "→" and "(loan)" along with the alias, so
// without the loan check these two would read as the same spell.
test('a loan is not the same spell as a permanent transfer', () => {
  const id = player('Loaned Then Signed')
  stint(id, 0, '2019–2020', '→ Celta Vigo (loan)', 30, 1)
  stint(id, 1, '2019–2020', 'Celta', 30, 1)

  sqlite.exec(dedupe)

  assert.equal(stintsOf(id).length, 2)
})

test('two real spells at the same club are both kept', () => {
  const id = player('Twice At Celta')
  stint(id, 0, '2013–2014', 'Celta', 34, 2)
  stint(id, 1, '2021–2022', 'Celta Vigo', 29, 3)

  sqlite.exec(dedupe)

  assert.equal(stintsOf(id).length, 2)
})

// 0118 is the same sweep against club_key(), which knows nothing about the
// alias map and simply strips the club down to its letters and digits.
const dedupeByKey = readFileSync(
  new URL('../db/migrations/0118_dedupe_club_stints_by_key.sql', import.meta.url),
  'utf8',
)

test('a hyphen is not a different club', () => {
  const id = player('Neymar')
  stint(id, 3, '2023–2025', 'Al Hilal', 3, 0)
  stint(id, 4, '2025–', 'Santos', 37, 15)
  stint(id, 5, '2023–2025', 'Al-Hilal', 3, 0)

  sqlite.exec(dedupeByKey)

  assert.deepEqual(
    stintsOf(id).map((r) => r.club),
    ['Al Hilal', 'Santos'],
  )
})

test('two real spells at one club survive the blunter key too', () => {
  const id = player('Twice At Santos')
  stint(id, 0, '2009–2013', 'Santos', 179, 107)
  stint(id, 1, '2025–', 'Santos', 37, 15)

  sqlite.exec(dedupeByKey)

  assert.equal(stintsOf(id).length, 2)
})
