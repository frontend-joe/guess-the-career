import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// When opening the app again is worth telling the room about.
//
// markSeen has one job and one trap. The job: answer "had this phone been
// dark a while" and then make the answer false, so only the first poll of a
// return can see it. The trap: a seat that predates the column has no last
// seen time at all, and reading that as a long absence would have pinged
// every player in every open room the moment it shipped.

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'seen-test-')), 'db.sqlite')

const { runMigrations, sqlite } = await import('../db/client.ts')
runMigrations()
const { markSeen } = await import('./gameRooms.ts')

const hostId = Number(
  sqlite.prepare("INSERT INTO users (email) VALUES ('seen@example.com')").run().lastInsertRowid,
)

const roomId = Number(
  sqlite
    .prepare(
      `INSERT INTO game_rooms (code, livekit_room, host_user_id, max_players)
       VALUES ('SEEN01', 'gtl-seen01', ?, 0)`,
    )
    .run(hostId).lastInsertRowid,
)

function seat(name: string, slot: number): number {
  return Number(
    sqlite
      .prepare(
        `INSERT INTO game_participants (room_id, display_name, role, slot)
         VALUES (?, ?, 'player', ?)`,
      )
      .run(roomId, name, slot).lastInsertRowid,
  )
}

function lastSeen(id: number, sqliteOffset: string): void {
  sqlite
    .prepare(`UPDATE game_participants SET last_seen_at = datetime('now', ?) WHERE id = ?`)
    .run(sqliteOffset, id)
}

test('a seat nothing has ever polled is present, not away since the dawn of time', () => {
  const id = seat('Never Polled', 0)
  // The deploy case. Every row that existed before the column has NULL here,
  // and a ping per player per room is not how a feature should announce
  // itself.
  assert.equal(markSeen(id, 30), false)
  // And it is written, so the second poll has something to compare against.
  const row = sqlite
    .prepare('SELECT last_seen_at FROM game_participants WHERE id = ?')
    .get(id) as { last_seen_at: string | null }
  assert.ok(row.last_seen_at)
})

test('a phone that has been polling all along has not been away', () => {
  const id = seat('Still Here', 1)
  lastSeen(id, '-20 seconds')
  assert.equal(markSeen(id, 30), false)
})

test('a phone dark for longer than the threshold has come back', () => {
  const id = seat('Back Again', 2)
  lastSeen(id, '-90 minutes')
  assert.equal(markSeen(id, 30), true)
})

test('only the first poll of a return is the return', () => {
  const id = seat('One Ping', 3)
  lastSeen(id, '-6 hours')
  assert.equal(markSeen(id, 30), true)
  // The poll that follows two seconds later is the same person in the same
  // room, and a notification per poll would be four a minute for ever.
  assert.equal(markSeen(id, 30), false)
  assert.equal(markSeen(id, 30), false)
})

test('a seat that is not there answers no rather than throwing', () => {
  // The seat was removed between the poll being authorised and this running.
  assert.equal(markSeen(999_999, 30), false)
})
