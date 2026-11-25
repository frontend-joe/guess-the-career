import { test } from 'node:test'
import assert from 'node:assert/strict'
import { positionBuckets, positionBucketKey } from './positions.ts'

const buckets = (custom: string | null, position: string | null) =>
  positionBuckets(custom, position)

test('the whole field counts, not the first word of it', () => {
  // Lahm belongs on both full-back boards. A round that read only the first
  // word would leave him off one of them, and that is the entire point of
  // the round type.
  assert.deepEqual(buckets(null, 'Right-back, left-back, midfielder'), ['right-back', 'left-back'])
  // Both, now that "Forward" places a player rather than being skipped —
  // which is the same rule, not an exception to it.
  assert.deepEqual(buckets(null, 'Forward, attacking midfielder'), [
    'attacking midfielder',
    'striker',
  ])
  assert.deepEqual(buckets(null, 'Centre-back, defensive midfielder'), [
    'centre-back',
    'defensive midfielder',
  ])
})

test('the spellings nobody agreed on all land in one place', () => {
  for (const s of ['Centre-back', 'Centre back', 'Center-back', 'Central defender', 'Sweeper', 'Centre-half']) {
    assert.deepEqual(buckets(null, s), ['centre-back'], s)
  }
  for (const s of ['Left back', 'Left-back', 'Left wing-back', 'Left wing back']) {
    assert.deepEqual(buckets(null, s), ['left-back'], s)
  }
  for (const s of ['Right back', 'Right-back', 'Right wing-back']) {
    assert.deepEqual(buckets(null, s), ['right-back'], s)
  }
  for (const s of ['Striker', 'Second striker', 'Centre forward', 'Centre-forward', 'Inside forward']) {
    assert.deepEqual(buckets(null, s), ['striker'], s)
  }
  for (const s of ['Winger', 'Left winger', 'Right winger', 'Left midfielder', 'Wide midfielder']) {
    assert.deepEqual(buckets(null, s), ['winger'], s)
  }
})

// The reason the broad buckets went: a board of forty defenders is not a
// question. The price is that a player the data describes only by half of
// the pitch cannot be placed on any of these boards, and must not be
// guessed at — a right-backs board taking a man who might have been a
// centre-half is worse than one that is short a name.
test('a position that names only half the pitch places nobody', () => {
  assert.deepEqual(buckets(null, 'Defender'), [])
  assert.deepEqual(buckets(null, 'Midfielder'), [])
  // Same problem one level down: which flank?
  assert.deepEqual(buckets(null, 'Full-back'), [])
  assert.deepEqual(buckets(null, 'Wing-back'), [])
})

// Except the forward half, which has two buckets in it rather than four,
// and where the other one is spelt out.
test('a bare Forward is a striker', () => {
  // Mark Bright. "Forward" is the whole of his row, and he led Sheffield
  // Wednesday's line for four years.
  assert.deepEqual(buckets(null, 'Forward'), ['striker'])
  assert.deepEqual(buckets(null, 'Midfielder, forward'), ['striker'])
  // And where a row says both, it means both — the same rule that puts
  // Lahm on two full-back boards.
  assert.deepEqual(buckets(null, 'Winger, Forward'), ['winger', 'striker'])
})

test('a hand-corrected position wins outright, and is how a vague one is fixed', () => {
  // Somebody looked at this player and fixed the scrape. Reading the old
  // answer as well would undo the correction.
  assert.deepEqual(buckets('Centre Back', 'Striker'), ['centre-back'])
  assert.deepEqual(buckets('Goalkeeper', 'Striker'), ['goalkeeper'])
  // Beckham, whose infobox says only "Midfielder".
  assert.deepEqual(buckets('Right midfielder, Central midfielder', 'Midfielder'), [
    'central midfielder',
    'winger',
  ])
})

test('pitch order, not the order the infobox happened to use', () => {
  // Two players whose infoboxes disagree about where to start must still
  // produce the same key, or the LIKE in the round SQL is matching noise.
  assert.equal(
    positionBucketKey(null, 'Striker, Central midfielder, Centre-back'),
    positionBucketKey(null, 'Centre-back, Central midfielder, Striker'),
  )
  assert.equal(positionBucketKey(null, 'Striker, Centre-back'), '|centre-back|striker|')
})

test('a goalkeeper is only ever a goalkeeper', () => {
  // Nothing on file mixes the two today. The rule is here because
  // all_positions is full of exactly that mistake — Seaman and Neuer as
  // centre-backs, Buffon as a winger — and a rescrape could put it in the
  // column this module does read.
  assert.deepEqual(buckets(null, 'Goalkeeper'), ['goalkeeper'])
  assert.deepEqual(buckets(null, 'Goalkeeper, Centre-back'), ['goalkeeper'])
})

test('Petr Cech keeps goal despite his other sport', () => {
  assert.deepEqual(buckets(null, 'Goaltender'), ['goalkeeper'])
})

test('a position that is not football at all buckets to nothing', () => {
  assert.deepEqual(buckets(null, 'Prop'), [])
  assert.deepEqual(buckets(null, 'Defensive end'), [])
  assert.equal(positionBucketKey(null, null), '')
  assert.equal(positionBucketKey(null, ''), '')
})

test('the key is delimited so one bucket cannot match inside another', () => {
  // "central midfielder" and "centre-back" share a start, and a bare LIKE
  // on an undelimited key would have them matching each other's boards.
  assert.equal(positionBucketKey(null, 'Central midfielder'), '|central midfielder|')
  assert.equal(positionBucketKey(null, 'Centre-back'), '|centre-back|')
  assert.ok(!positionBucketKey(null, 'Central midfielder').includes('|centre-back|'))
})
