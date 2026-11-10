import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Two records, one man. Wikipedia answers to both ".../Lothar_Matthäus" and
// ".../Lothar_Matth%C3%A4us", so a scrape that asked for the percent-encoded
// spelling did not find the row already on file and made a second Lothar
// Matthäus with identical career statistics. The derivation then ranked the
// two side by side, and a Germany Serie A board listed him twice on 115 —
// which one guess swept into both slots.
//
// Nationality rounds are derived from a throwaway database here, so only the
// players inserted below exist: 'Duplicatia' is nobody's real nationality.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'dupe-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { answersForRound } = await import('./tenable.ts')
const { wikiUrlVariants } = await import('./scraper.ts')

function striker(name: string, url: string, apps: number): number {
  const { id } = sqlite
    .prepare(
      `INSERT INTO footballers (name, wikipedia_url, nationality)
       VALUES (?, ?, 'Duplicatia') RETURNING id`,
    )
    .get(name, url) as { id: number }
  sqlite
    .prepare(
      `INSERT INTO career_statistics (footballer_id, club, season, league, league_apps, league_goals)
       VALUES (?, 'Duplicatia FC', '2011-12', 'Serie A', ?, 0)`,
    )
    .run(id, apps)
  return id
}

const original = striker('Lothar Matthäus', 'https://en.wikipedia.org/wiki/Lothar_Matthäus', 115)
striker('Lothar Matthäus', 'https://en.wikipedia.org/wiki/Lothar_Matth%C3%A4us', 115)
for (let i = 0; i < 12; i++) striker(`Reserve ${i}`, `https://en.wikipedia.org/wiki/Reserve_${i}`, 10 + i)

const round = () =>
  answersForRound('nationality', { league: 'Serie A', nationality: 'Duplicatia' }, 'apps')

test('one man cannot hold two slots on a board', () => {
  const names = round().map((a) => a.name)
  assert.equal(names.filter((n) => n === 'Lothar Matthäus').length, 1)
})

test('the duplicate is dropped, not the real answer', () => {
  const top = round()[0]
  assert.equal(top.name, 'Lothar Matthäus')
  assert.equal(top.footballer_id, original)
  assert.equal(top.value, 115)
})

test('losing a duplicate still leaves a full board', () => {
  assert.equal(round().length, 10)
})

test('both spellings of one article are the same article', () => {
  const variants = wikiUrlVariants('https://en.wikipedia.org/wiki/Lothar_Matth%C3%A4us')
  assert.ok(variants.includes('https://en.wikipedia.org/wiki/Lothar_Matthäus'))
  assert.ok(variants.includes('https://en.wikipedia.org/wiki/Lothar_Matth%C3%A4us'))
})

test('a plain title survives the round trip unchanged', () => {
  assert.deepEqual(wikiUrlVariants('https://en.wikipedia.org/wiki/Alan_Shearer'), [
    'https://en.wikipedia.org/wiki/Alan_Shearer',
  ])
})
