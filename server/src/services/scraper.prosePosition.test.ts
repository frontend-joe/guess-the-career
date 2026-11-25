import { test } from 'node:test'
import assert from 'node:assert/strict'
import { positionFromProse } from './scraper.ts'

// Wikipedia's infobox holds one field, and for 385 players in this database
// it holds the half of the pitch and stops: "Midfielder". The body of the
// article usually knows the rest. These are the real sentences.

test('it reads the position out of the prose when the infobox will not', () => {
  // Garry Parker, Nottingham Forest section, verbatim. His infobox says
  // "Midfielder" and nothing else, so he was on no position board at all.
  const parker =
    'Forest sold England midfielder Neil Webb to Manchester United in the summer of 1989, ' +
    'and despite buying Ireland international John Sheridan, Parker was moved into his ' +
    'favoured central midfield position for the next season and Sheridan was quickly sold on.'
  assert.equal(positionFromProse(parker, 'Midfielder', 'Parker'), 'Central midfielder')
})

test('somebody else’s job title in his sentence is not his position', () => {
  // The same sentence names Neil Webb as a midfielder. The apposition guard
  // is the only thing between that and a board.
  const text = 'Forest sold England centre-back Neil Webb to Manchester United, and Parker stayed.'
  assert.equal(positionFromProse(text, 'Defender', 'Parker'), null)
  // But the same phrasing about HIM counts.
  assert.equal(
    positionFromProse('Forest sold centre-back Gabriel Tamas to Celta.', 'Defender', 'Tamas'),
    'Centre-back',
  )
})

test('a sentence about nobody in particular is ignored', () => {
  assert.equal(
    positionFromProse('The club signed two central midfielders that summer.', 'Midfielder', 'Parker'),
    null,
  )
})

test('what he WAS outranks where he once played', () => {
  // Both true of Parker: a season on the left wing, then central midfield.
  // Counting mentions alone ties them at one apiece and gives up.
  const text =
    'He became a regular on the left wing, scoring his fair share of goals. ' +
    'Parker was moved into his favoured central midfield position.'
  assert.equal(positionFromProse(text, 'Midfielder', 'Parker'), 'Central midfielder')
})

test('it never crosses the halfway line', () => {
  // A defender's article mentioning midfield does not make him a midfielder,
  // whatever the prose says — the infobox is still a fact about him.
  const text = 'He played as a central midfielder throughout his career.'
  assert.equal(positionFromProse(text, 'Defender', 'Smith'), null)
  assert.equal(positionFromProse(text, 'Midfielder', 'Smith'), 'Central midfielder')
  // With an empty box there is nothing to contradict.
  assert.equal(positionFromProse(text, null, 'Smith'), 'Central midfielder')
})

test('a tie is no answer', () => {
  const text = 'He played as a centre-back. He played as a left back.'
  assert.equal(positionFromProse(text, 'Defender', 'Smith'), null)
})

test('a surname with a diacritic still matches itself', () => {
  // \b is ASCII, so /\bTamaș\b/ matches nothing and every sentence naming him
  // failed the subject test. Half the database has a name like this.
  const text = 'Tamaș was deployed as a centre-back for the whole season.'
  assert.equal(positionFromProse(text, 'Defender', 'Tamaș'), 'Centre-back')
})

test('the broad words are not readings', () => {
  // "He was a forward" is the same non-answer in prose as in the infobox.
  assert.equal(positionFromProse('He played as a forward.', null, 'Smith'), null)
  assert.equal(positionFromProse('He played as a midfielder.', null, 'Smith'), null)
})
