import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { livekitConfig, mintJoinToken } from '../services/livekit.ts'

// A token endpoint for a SEPARATE little demo app, which has no account on
// this server and no rows in this database.
//
// It exists here rather than on its own host for one reason: the LiveKit
// credentials are already in this service's environment, and the fewer places
// that secret lives, the fewer places it can leak from. Everything else about
// that choice is a cost, so the file is written to keep the cost contained —
// it imports no database client, writes nothing, and reads nothing the game
// depends on. The one thing it shares with the game is the API key.
//
// WHAT IT DOES NOT DO: authenticate anybody. Holding the code is the whole
// authorisation, exactly as a Jitsi link is. That is acceptable for a demo and
// would not be for the game, which checks a seat before it mints anything —
// see the livekit-token route in rooms.ts.

export const demoVideoRouter = new Hono()

/// Short, because a demo call is minutes long and a token that outlives the
/// thing it was minted for is just a liability sitting in a browser tab.
const TOKEN_TTL = '2h'

// Deliberately NOT the game's shape. A real room is `gtl-<code>-<random>`,
// whose random half makes it unguessable; these are `demo-<code>`, guessable
// by design because the code IS the key. The prefix is what guarantees the two
// namespaces cannot meet: no value this function returns can ever name a room
// a real game is playing in.
function roomNameFor(code: string): string {
  return `demo-${code.toLowerCase()}`
}

// Per-IP, in memory, and therefore reset by every deploy. That is fine for
// what it is: a brake on someone looping the endpoint to burn LiveKit minutes,
// not a security boundary. The security boundary is that a token only ever
// reaches one room.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const seen = hits.get(key)
  if (!seen || now > seen.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic sweep, so a long-lived process does not accumulate an
    // entry per IP forever.
    if (hits.size > 5_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    return false
  }
  seen.count += 1
  return seen.count > MAX_PER_WINDOW
}

// POST /api/demo-video/token
//
// { code, displayName } → { url, roomName, identity, token }
//
// The client sends a code and a name. It does NOT send a room name and it does
// NOT send an identity; both are the server's to decide, and that is what the
// two rules below are protecting.
demoVideoRouter.post(
  '/token',
  zValidator('json', z.object({
    // A code, not a room name: constrained so it cannot carry a slash, a
    // wildcard, or anything else that might mean something to LiveKit.
    code: z.string().trim().regex(/^[A-Za-z0-9-]{1,24}$/, 'Codes are letters, numbers and dashes'),
    displayName: z.string().trim().min(1).max(30),
  })),
  async (c) => {
    const config = livekitConfig()
    if (!config) return c.json({ error: 'Video is not configured on this server' }, 503)

    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? c.req.header('cf-connecting-ip')
      ?? 'unknown'
    if (rateLimited(ip)) return c.json({ error: 'Too many requests' }, 429)

    const { code, displayName } = c.req.valid('json')

    // Server-generated, always. LiveKit identities are unique within a room:
    // two devices arriving as the same identity means the second disconnects
    // the first. A client-chosen one would also let somebody claim to be
    // another participant in everyone's tile list. The display name rides
    // along separately and is what gets rendered.
    const identity = `d${randomBytes(8).toString('hex')}`
    const roomName = roomNameFor(code)

    return c.json({
      url: config.url,
      roomName,
      identity,
      ttl: TOKEN_TTL,
      token: await mintJoinToken(roomName, identity, displayName, TOKEN_TTL),
    })
  },
)
