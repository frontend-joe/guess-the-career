import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Who is actually in the room.
//
// `left_at` was the only answer the state had, and it answers a different
// question: it is set when somebody taps leave, which almost nobody does.
// They lock the phone, or the app backgrounds, or the battery goes. Every one
// of those leaves a row saying the person is still sitting there, so a room
// of four absent people looked exactly like a room of four present ones.
//
// last_seen_at is the honest signal because GET /state stamps it on every
// poll, and everybody in a room polls.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'active-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')

const userId = (sqlite
  .prepare("INSERT INTO users (email, password_hash, display_name) VALUES ('active@example.com', 'x', 'Host') RETURNING id")
  .get() as { id: number }).id
const r = rooms.createRoom({ id: userId, displayName: 'Host' }, 'Test')

const alan = rooms.joinRoom(r.code, 'Alan', { platform: 'ios' }).participant
const bea = rooms.joinRoom(r.code, 'Bea', { platform: 'ios' }).participant
const cat = rooms.joinRoom(r.code, 'Cat', { platform: 'ios' }).participant

/** Stamp a seat as last having polled `secondsAgo` ago. */
function seen(participantId: number, secondsAgo: number): void {
  sqlite
    .prepare("UPDATE game_participants SET last_seen_at = datetime('now', ?) WHERE id = ?")
    .run(`-${secondsAgo} seconds`, participantId)
}

function activeNames(): string[] {
  return rooms
    .roomState(sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(r.id) as never)
    .participants.filter((p) => p.active)
    .map((p) => p.displayName)
}

test('a seat that has never polled is not in the room', () => {
  // Nobody has been stamped yet, including the host, whose row createRoom
  // wrote without ever going near a poll.
  assert.deepEqual(activeNames(), [])
})

test('a recent poll is somebody sitting there', () => {
  seen(alan.id, 2)
  // Five missed polls on a ten-second loop and still in the room: a phone
  // changing masts must not blink its owner out of the game.
  seen(bea.id, 55)
  seen(cat.id, 120)

  assert.deepEqual(activeNames(), ['Alan', 'Bea'])
})

test('walking out beats having just polled', () => {
  // The poll that carries a leave is itself recent, so without this the
  // person who just tapped Leave would be the most present player in the
  // room.
  seen(alan.id, 1)
  rooms.leaveRoom(alan.id)

  assert.deepEqual(activeNames(), ['Bea'])
})

test('present and active are different questions', () => {
  // Bea has not left and has not polled for an hour: still part of the game,
  // still listed, not in the room.
  seen(bea.id, 3600)
  const state = rooms.roomState(
    sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(r.id) as never,
  )
  const beaRow = state.participants.find((p) => p.displayName === 'Bea')!
  assert.equal(beaRow.present, true)
  assert.equal(beaRow.active, false)
})
