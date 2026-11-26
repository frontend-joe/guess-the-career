import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// How hard a round is, from the size of the pool it draws on.
//
// The rule is counter-intuitive and was nearly built backwards, so it is
// pinned here with the two rounds that make the argument. A ranked board
// draws ten from the pool, so the pool is also the trap count — by that
// reading "Most Premier League appearances of all time" (722 qualifying
// players, nine of every ten plausible shouts missing) is the hard one and
// "surname beginning with K" (ten qualifying players, every one of them on
// the board, nothing can miss) cannot be hard at all.
//
// The game says otherwise and the game wins. A big pool is a big pool of
// FAMOUS players; the thin categories are thin because they are obscure, and
// a board you cannot miss is no use when you cannot think of the tenth name.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'difficulty-test-')), 'db.sqlite')

const { runMigrations } = await import('../db/client.ts')
runMigrations()

const { difficultyOf } = await import('./tenable.ts')

test('a thin pool is the hard one, however unmissable the board', () => {
  // Ten qualifying players for ten slots. Every name that fits the category
  // scores, and it is still the hardest round in the game.
  assert.equal(difficultyOf(10), 'hard')
  assert.equal(difficultyOf(13), 'hard')
})

test('a deep pool is the easy one, however many ways there are to miss', () => {
  assert.equal(difficultyOf(25), 'easy')
  // Most Premier League appearances of all time. Seven hundred qualify and
  // ten are on the board, and it is still the round a room cleans up on,
  // because the first names anybody shouts are the right ones.
  assert.equal(difficultyOf(722), 'easy')
})

test('the middle is everything between', () => {
  assert.equal(difficultyOf(14), 'medium')
  assert.equal(difficultyOf(24), 'medium')
  // A squad round: name any ten of twenty-three. Comfortable, not generous.
  assert.equal(difficultyOf(23), 'medium')
})

test('a round that cannot legally exist does not crash the label', () => {
  // Nothing under ten is ever enabled — MIN_ANSWERS sees to that — but the
  // count is a stored column and a label is not the place to find out it
  // went wrong.
  assert.equal(difficultyOf(0), 'hard')
})
