import { test } from 'node:test'
import assert from 'node:assert/strict'

import { splitName } from './nameSplit.ts'

test('a Mac written as its own word belongs to the surname', () => {
  // Reported from a real game: "Liverpool players, surnames starting M" could
  // not see Alexis Mac Allister, because the three-token fallback took the
  // last word and filed him under A.
  const alexis = splitName('Alexis Mac Allister', 'Argentina')
  assert.equal(alexis.surname, 'Mac Allister')
  assert.equal(alexis.first_name, 'Alexis')
  assert.equal(alexis.ambiguous, false)
  // His father and brothers spell it the same way.
  assert.equal(splitName('Carlos Mac Allister', 'Argentina').surname, 'Mac Allister')
  assert.equal(splitName('Kevin Mac Allister', 'Argentina').surname, 'Mac Allister')
})

test('a Mac attached to the name is one word and was never the problem', () => {
  assert.equal(splitName('Gary McAllister', 'Scotland').surname, 'McAllister')
  assert.equal(splitName('Scott McTominay', 'Scotland').surname, 'McTominay')
  assert.equal(splitName('Steve McManaman', 'England').surname, 'McManaman')
})

test('a player whose FIRST name is Mac keeps it', () => {
  // The particle rule only reads words after the first, so a given name is
  // out of its reach.
  const s = splitName('Mac Donald', 'Scotland')
  assert.equal(s.first_name, 'Mac')
  assert.equal(s.surname, 'Donald')
})

test('the particles that were already there still work', () => {
  assert.equal(splitName('Alessandro Del Piero', 'Italy').surname, 'Del Piero')
  assert.equal(splitName('Rafael van der Vaart', 'Netherlands').surname, 'van der Vaart')
  assert.equal(splitName('Matt Le Tissier', 'England').surname, 'Le Tissier')
})
