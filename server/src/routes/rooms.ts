import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import {
  getCurrentUser,
  requireUser,
  requestBearer,
  signParticipantToken,
  verifyParticipantToken,
} from '../services/auth.ts'
import {
  RoomError,
  createRoom,
  endRoom,
  freezeRound,
  joinRoom,
  leaveRoom,
  participantsOf,
  roomByCode,
  roomState,
  startRound,
  submitGuess,
  type ParticipantRow,
  type RoomRow,
} from '../services/gameRooms.ts'

export const roomsRouter = new Hono()

// Private multiplayer rooms.
//
// Unlike the older game routers, EVERY endpoint here is authenticated — either
// as a signed-in user or as a guest holding a room-scoped participant token.
// The public-by-default pattern the rest of the site uses would mean anyone
// who learned a six-character code could drive someone else's game.

function fail(err: unknown): never {
  if (err instanceof RoomError) throw err
  throw err
}

// Resolve the caller to a seat in this room: a guest's participant token, or a
// signed-in user who has already joined.
async function participantFor(c: Context, room: RoomRow): Promise<ParticipantRow | null> {
  const bearer = requestBearer(c)
  if (bearer) {
    const payload = await verifyParticipantToken(bearer)
    if (payload) {
      if (payload.rid !== room.id) return null
      return (sqlite
        .prepare('SELECT * FROM game_participants WHERE id = ? AND room_id = ?')
        .get(payload.pid, room.id) as ParticipantRow | undefined) ?? null
    }
  }
  const user = await getCurrentUser(c)
  if (!user) return null
  return participantsOf(room.id).find((p) => p.user_id === user.id) ?? null
}

// Everything below needs a room that exists; this keeps the lookup in one place.
function mustFindRoom(code: string): RoomRow {
  const room = roomByCode(code)
  if (!room) throw new RoomError('No such room', 404)
  return room
}

// POST /api/rooms — the host opens a game.
roomsRouter.post(
  '/',
  requireUser,
  zValidator('json', z.object({ name: z.string().trim().max(60).optional() })),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const room = createRoom(
      { id: user.id, displayName: user.display_name ?? user.email.split('@')[0] },
      c.req.valid('json').name,
    )
    const host = participantsOf(room.id)[0]
    return c.json({
      ...roomState(room),
      participantId: host.id,
      participantToken: await signParticipantToken(room.id, host.id),
    }, 201)
  },
)

// POST /api/rooms/:code/join — a friend joins with a name. No account needed.
roomsRouter.post(
  '/:code/join',
  zValidator('json', z.object({
    displayName: z.string().trim().min(1).max(30),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  })),
  async (c) => {
    const { displayName, platform } = c.req.valid('json')
    const user = await getCurrentUser(c)
    try {
      const { room, participant } = joinRoom(c.req.param('code'), displayName, {
        userId: user?.id ?? null,
        platform,
      })
      return c.json({
        ...roomState(room),
        participantId: participant.id,
        participantToken: await signParticipantToken(room.id, participant.id),
      })
    } catch (err) {
      return fail(err)
    }
  },
)

// GET /api/rooms/:code/state — the authoritative snapshot.
//
// Rebuilt from SQLite every time, which is what makes a mid-game deploy
// survivable: clients that see a state_version gap, or reconnect, call this.
roomsRouter.get('/:code/state', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  return c.json({ ...roomState(room), participantId: me.id, role: me.role })
})

// POST /api/rooms/:code/rounds — freeze a round's board for this room.
roomsRouter.post(
  '/:code/rounds',
  zValidator('json', z.object({ roundId: z.number().int().positive() })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    if (me.role !== 'host') return c.json({ error: 'Only the host can choose rounds' }, 403)
    try {
      const inst = freezeRound(room.id, c.req.valid('json').roundId)
      return c.json({ instanceId: inst.id, seq: inst.seq, title: inst.title, status: inst.status }, 201)
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/rounds/:instanceId/start — stamp T0 and go.
roomsRouter.post('/:code/rounds/:instanceId/start', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  if (me.role !== 'host') return c.json({ error: 'Only the host can start a round' }, 403)
  const instanceId = parseInt(c.req.param('instanceId'), 10)
  if (isNaN(instanceId)) return c.json({ error: 'Invalid round instance' }, 400)
  try {
    const inst = startRound(instanceId)
    if (inst.room_id !== room.id) return c.json({ error: 'Wrong room' }, 403)
    return c.json({ ...roomState(roomByCode(room.code)!), instanceId: inst.id })
  } catch (err) {
    return fail(err)
  }
})

// POST /api/rooms/:code/guess — host only; the server decides.
roomsRouter.post(
  '/:code/guess',
  zValidator('json', z.object({
    instanceId: z.number().int().positive(),
    clientGuessId: z.string().min(1).max(64),
    raw: z.string().trim().min(1).max(100),
  })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    const { instanceId, clientGuessId, raw } = c.req.valid('json')
    try {
      return c.json(submitGuess(instanceId, me, clientGuessId, raw))
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/leave
roomsRouter.post('/:code/leave', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  leaveRoom(me.id)
  return c.json({ ok: true })
})

// POST /api/rooms/:code/end — host closes the game.
roomsRouter.post('/:code/end', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  if (me.role !== 'host') return c.json({ error: 'Only the host can end the game' }, 403)
  endRoom(room.id)
  return c.json({ ok: true })
})

// Turn a RoomError into its intended status rather than a 500.
roomsRouter.onError((err, c) => {
  if (err instanceof RoomError) return c.json({ error: err.message }, err.status)
  console.error('rooms:', err)
  return c.json({ error: 'Something went wrong' }, 500)
})
