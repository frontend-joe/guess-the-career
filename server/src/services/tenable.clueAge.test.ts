import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The clue says how old they are, not the day they were born.
//
// The date was the clue for a while and it is the wrong unit: a room gets
// "1989-02-26" and does the subtraction out loud, which is arithmetic
// homework in the middle of a party game.
//
// The counting has to be calendar-correct. Days over 365.25 is a year out for
// anybody in the week either side of their birthday, and a clue that is a
// year wrong is worse than no clue, because it is believed.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'clue-age-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { cluesForFootballers } = await import('./tenable.ts')

let n = 0
function bornOn(born: string | null): number {
  n += 1
  const { id } = sqlite
    .prepare(
      `INSERT INTO footballers (name, wikipedia_url, nationality, born)
       VALUES (?, ?, 'France', ?) RETURNING id`,
    )
    .get(`Player ${n}`, `https://en.wikipedia.org/wiki/Player_${n}`, born) as { id: number }
  return id
}

const ageOf = (id: number) => cluesForFootballers([id]).get(id)?.age

test('a birthday that has been and gone counts, one that has not does not', () => {
  // Two players born the same year, on either side of today. Pinned to the
  // real clock rather than a frozen one, so the test still holds next year.
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const had = new Date(today)
  had.setDate(had.getDate() - 1)
  const toCome = new Date(today)
  toCome.setDate(toCome.getDate() + 1)

  const thirtyYearsBack = (d: Date) => iso(new Date(d.getFullYear() - 30, d.getMonth(), d.getDate()))

  assert.equal(ageOf(bornOn(thirtyYearsBack(had))), 30)
  // A day short of the birthday is still 29, which is the whole point of not
  // dividing by 365.25.
  assert.equal(ageOf(bornOn(thirtyYearsBack(toCome))), 29)
})

test('a player with no birth date on file has no age, not a zero', () => {
  // Zero would draw "Age 0" on the row, which reads as a fact.
  assert.equal(ageOf(bornOn(null)), null)
  assert.equal(ageOf(bornOn('')), null)
})

test('a date nobody can parse is dropped rather than guessed at', () => {
  assert.equal(ageOf(bornOn('c. 1890')), null)
  assert.equal(ageOf(bornOn('1976')), null)
})
