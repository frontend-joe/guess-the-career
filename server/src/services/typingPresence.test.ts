import { test } from 'node:test'
import assert from 'node:assert/strict'

import { noteTyping, clearTyping, typingIn } from './typingPresence.ts'

// Typing rides LiveKit's data channel, which a game created with the video
// toggle off does not have — no token, no WebRTC — so the dots never
// appeared in those games and nothing said why. This is the second route,
// carried on the poll that such a game is already making every 1.5 seconds.

test('somebody typing is reported to everyone but themselves', () => {
  noteTyping(1, 10)
  noteTyping(1, 11)
  assert.deepEqual(typingIn(1, 10), [11], 'nobody needs telling about their own keyboard')
  assert.deepEqual(typingIn(1, 11), [10])
  assert.deepEqual(typingIn(1, 99), [10, 11])
})

test('one room cannot see another room typing', () => {
  noteTyping(2, 20)
  assert.deepEqual(typingIn(1, 99), [10, 11])
  assert.deepEqual(typingIn(2, 99), [20])
})

test('stopping is said at once rather than waited out', () => {
  clearTyping(1, 11)
  assert.deepEqual(typingIn(1, 99), [10])
})

test('a dot clears itself when the pings stop', async () => {
  // The TTL is what makes a dropped "stopped" harmless: a player who closes
  // the app mid-word leaves no ghost above everyone's guess box.
  const { noteTyping: note, typingIn: who } = await import('./typingPresence.ts')
  note(3, 30)
  assert.deepEqual(who(3, 99), [30])
  // Five seconds on, with no further poll from them.
  const realNow = Date.now
  try {
    Date.now = () => realNow() + 6_000
    assert.deepEqual(who(3, 99), [])
  } finally {
    Date.now = realNow
  }
  // And the expired entry was dropped on the way past, so the map does not
  // grow for every player who ever typed.
  assert.deepEqual(who(3, 99), [])
})
