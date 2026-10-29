import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reduceEvents, type ReplayEvent } from './boardReplay.ts'

// reduceEvents draws both the live board and the board track of the recorded
// video. A bug here corrupts recordings that cannot be re-recorded, and it
// would not be noticed for days — hence tests on a file with no other.

const ev = (seq: number, t_ms: number, type: string, payload: unknown, actor: number | null = null): ReplayEvent => ({
  seq, t_ms, type, actor_participant_id: actor, payload: JSON.stringify(payload),
})

const LOG: ReplayEvent[] = [
  ev(1, 0, 'round_start', { title: 'Z surnames', target: 10, ordered: true, metric: 'apps', impliedClues: ['surname'] }),
  ev(2, 1000, 'guess', { raw: 'Zanetti', verdict: 'hit', matchedRank: 1 }, 7),
  ev(3, 1000, 'reveal', { rank: 1, name: 'Javier Zanetti', value: 615, unit: null }, 7),
  ev(4, 2500, 'guess', { raw: 'Nobody', verdict: 'miss', matchedRank: null }, 7),
  ev(5, 4000, 'guess', { raw: 'Zola', verdict: 'hit', matchedRank: 6 }, 7),
  ev(6, 4000, 'reveal', { rank: 6, name: 'Gianfranco Zola', value: 229, unit: null }, 7),
  ev(7, 9000, 'round_end', { reason: 'complete' }),
]

test('folds the log into a board', () => {
  const s = reduceEvents(LOG)
  assert.equal(s.title, 'Z surnames')
  assert.equal(s.target, 10)
  assert.deepEqual(s.impliedClues, ['surname'])
  assert.deepEqual(s.revealed.map((r) => r.rank), [1, 6])
  assert.equal(s.guesses.length, 3)
  assert.deepEqual(s.ended, { reason: 'complete', tMs: 9000 })
})

test('untilMs gives the board as it stood at that moment', () => {
  assert.equal(reduceEvents(LOG, 500).revealed.length, 0)
  assert.equal(reduceEvents(LOG, 1000).revealed.length, 1)
  assert.equal(reduceEvents(LOG, 3999).revealed.length, 1)
  assert.equal(reduceEvents(LOG, 4000).revealed.length, 2)
  assert.equal(reduceEvents(LOG, 8999).ended, null)
})

test('a clue appears when it was taken, not from the start', () => {
  const log = [
    LOG[0],
    ev(2, 3000, 'hint', { rank: 4, clue: { nationality: 'Italy', position: 'Defender' } }, 7),
  ]
  assert.deepEqual(reduceEvents(log, 2999).hints, [])
  const [hint] = reduceEvents(log).hints
  assert.equal(hint.rank, 4)
  assert.equal(hint.tMs, 3000)
  assert.deepEqual(hint.clue, { nationality: 'Italy', position: 'Defender' })
})

test('a hint with no clue recorded does not break the fold', () => {
  const out = reduceEvents([LOG[0], ev(2, 100, 'hint', { rank: 3, clue: null })])
  assert.deepEqual(out.hints, [{ rank: 3, clue: null, tMs: 100 }])
})

test('revealed rows come back in rank order, not reveal order', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'reveal', { rank: 9, name: 'Ninth' }),
    ev(3, 2000, 'reveal', { rank: 2, name: 'Second' }),
  ])
  assert.deepEqual(out.revealed.map((r) => r.rank), [2, 9])
})

// The counterpart for a board that is not a ranking. Its ranks are positions
// in a pool longer than the board, so ordering by them means a later answer can
// appear ABOVE an earlier one and push it down a row — which is what a player
// sees as the board rearranging itself for no reason.
test('an unordered board fills in the order answers were found', () => {
  const start = ev(1, 0, 'round_start', { title: 'Cheeses', target: 10, ordered: false, metric: '' })
  const out = reduceEvents([
    start,
    ev(2, 1000, 'reveal', { rank: 14, name: 'Emmental' }),
    ev(3, 2000, 'reveal', { rank: 8, name: 'Gouda' }),
    ev(4, 3000, 'reveal', { rank: 6, name: 'Parmesan' }),
  ])
  assert.deepEqual(out.revealed.map((r) => r.name), ['Emmental', 'Gouda', 'Parmesan'])
})

// Giving up reveals everything left at one instant, so the tie-break is what
// orders them — otherwise the rows that fill at the end arrive arbitrarily.
test('answers revealed together fall back to rank order', () => {
  const start = ev(1, 0, 'round_start', { title: 'Cheeses', target: 10, ordered: false, metric: '' })
  const out = reduceEvents([
    start,
    ev(2, 1000, 'reveal', { rank: 14, name: 'Emmental' }),
    ev(3, 5000, 'give_up', { answers: [{ rank: 9, name: 'Edam' }, { rank: 2, name: 'Brie' }] }),
  ])
  assert.deepEqual(out.revealed.map((r) => r.name), ['Emmental', 'Brie', 'Edam'])
})

test('a round carries the category it belongs to', () => {
  const start = ev(1, 0, 'round_start', { title: 'Cheeses', target: 10, ordered: false, category: 'general' })
  assert.equal(reduceEvents([start]).category, 'general')
  // Rounds logged before the category existed are football's, which is what
  // every round was when they were recorded.
  assert.equal(reduceEvents([LOG[0]]).category, 'football')
})

test('input order does not matter — (t_ms, seq) is the total order', () => {
  const shuffled = [LOG[4], LOG[0], LOG[6], LOG[2], LOG[5], LOG[1], LOG[3]]
  assert.deepEqual(reduceEvents(shuffled), reduceEvents(LOG))
})

test('is pure: the same input twice gives the same board', () => {
  assert.deepEqual(reduceEvents(LOG), reduceEvents(LOG))
})

test('unknown event types and bad payloads are survivable', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 10, 'recording_start', { slot: 1 }),
    { seq: 3, t_ms: 20, type: 'reveal', actor_participant_id: null, payload: 'not json' },
    LOG[2],
  ])
  // The malformed reveal degrades to rank 0 rather than throwing; the real
  // reveal still lands. Losing a frame beats losing the whole recording.
  assert.equal(out.revealed.length, 2)
  assert.equal(out.title, 'Z surnames')
})

test('a frozen round with no round_start still knows its title', () => {
  // A round is frozen during the lobby and started later, so between those two
  // moments the log is empty and the title can only come from the seed. The
  // apps draw the board in that window.
  const out = reduceEvents([], Number.POSITIVE_INFINITY, { title: 'Z surnames', target: 10 })
  assert.equal(out.title, 'Z surnames')
  assert.equal(out.target, 10)
})

test('round_start wins over the seed rather than being ignored', () => {
  const out = reduceEvents(LOG, Number.POSITIVE_INFINITY, { title: 'stale', target: 3 })
  assert.equal(out.title, 'Z surnames')
  assert.equal(out.target, 10)
})

test('giving up reveals the rest, marked as missed', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'reveal', { rank: 3, name: 'Got This One' }),
    ev(3, 5000, 'give_up', {
      answers: [
        { rank: 1, name: 'Never Got This', value: 9, unit: 'goals' },
        { rank: 2, name: 'Nor This', value: 8, unit: 'goals' },
      ],
    }),
    ev(4, 5000, 'round_end', { reason: 'gave_up' }),
  ])
  // Rank order, not reveal order, and the one that was guessed is not
  // retroactively marked as missed.
  assert.deepEqual(out.revealed.map((r) => [r.rank, r.missed]), [[1, true], [2, true], [3, false]])
  assert.equal(out.ended?.reason, 'gave_up')
})

test('a give_up with a malformed answer list does not lose the round', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'give_up', { answers: [null, 'nonsense', { rank: 4, name: 'Real' }] }),
  ])
  assert.deepEqual(out.revealed.map((r) => r.name), ['Real'])
})

test('a reshuffle restates the whole revealed set at its new ranks', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'reveal', { rank: 3, name: 'Found Early', value: 20 }),
    // A player the database had never heard of turns out to be 2nd, so
    // everyone below shifts and the one already found moves to 4.
    ev(3, 5000, 'board_reshuffle', {
      revealed: [
        { rank: 2, name: 'John Egan', value: 263, byParticipantId: 7 },
        { rank: 4, name: 'Found Early', value: 20, byParticipantId: null },
      ],
    }),
  ])
  assert.deepEqual(out.revealed.map((r) => [r.rank, r.name]), [[2, 'John Egan'], [4, 'Found Early']])
  // The stale rank-3 entry is gone, not kept alongside the new one.
  assert.equal(out.revealed.length, 2)
  assert.equal(out.revealed[0].byParticipantId, 7)
})

test('a reveal carries the footballer id, and an older event folds to null', () => {
  const out = reduceEvents([
    LOG[0],
    ev(2, 1000, 'reveal', { rank: 1, name: 'Andre Gray', value: 113, footballerId: 4821 }, 7),
    // Logged before the board carried ids. The row still folds — it is simply
    // not tappable — because an append-only log cannot be backfilled.
    ev(3, 2000, 'reveal', { rank: 2, name: 'Troy Deeney', value: 103 }, 7),
  ])
  assert.deepEqual(out.revealed.map((r) => r.footballerId), [4821, null])
})
