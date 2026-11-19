import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Video has been the whole point of a room since the start, and it was also
// unconditional. A game created without it never dials LiveKit at all — no
// token, no connection, no camera — so the decision is made once, at creation,
// and cannot be taken back without reconnecting everybody mid-game.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'video-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()

const rooms = await import('./gameRooms.ts')

function host(email: string) {
  const user = sqlite
    .prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Host') RETURNING id")
    .get(email) as { id: number }
  return { id: user.id, displayName: 'Host' }
}

test('a room is a video call unless the host says otherwise', () => {
  const room = rooms.createRoom(host('video-on@example.com'), 'With video')
  assert.equal(room.video_enabled, 1)
  assert.equal(rooms.roomState(room).video, true)
})

test('a room created without video says so, and keeps saying so', () => {
  const room = rooms.createRoom(host('video-off@example.com'), 'No video', false)
  assert.equal(room.video_enabled, 0)
  assert.equal(rooms.roomState(room).video, false)

  // Re-read from the database rather than trusting the row we were handed:
  // the flag has to survive the process that created it, because the clients
  // read it on every poll.
  assert.equal(rooms.roomByCode(room.code)!.video_enabled, 0)
})

// It still gets a LiveKit room name. The column is NOT NULL and UNIQUE and has
// been since 0085, nothing ever dials it, and making it conditional would buy
// nothing but a nullable column.
test('a room without video still has a livekit room name it never uses', () => {
  const room = rooms.createRoom(host('video-name@example.com'), 'No video', false)
  assert.match(room.livekit_room, /^gtl-/)
})
