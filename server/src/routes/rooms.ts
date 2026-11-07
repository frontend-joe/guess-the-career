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
  giveUp,
  allowGuess,
  joinRoom,
  leaveRoom,
  onRoomChanged,
  participantsOf,
  postMessage,
  removeParticipant,
  reportParticipant,
  resolvePendingReviews,
  roomByCode,
  roomState,
  roomWentQuiet,
  slotsRemaining,
  startRound,
  submitGuess,
  takeHint,
  type ParticipantRow,
  type RoomRow,
} from '../services/gameRooms.ts'
import { broadcastState, ejectParticipant, livekitConfig, mintJoinToken } from '../services/livekit.ts'
import {
  recordRegistrationAttempt,
  registerDevice,
  sendInvite,
  sendLastSlot,
  sendRoomResumed,
  sendRoundStarted,
} from '../services/push.ts'

export const roomsRouter = new Hono()

// How long a room has to sit untouched before somebody guessing in it is
// worth a notification. Half an hour is long enough that nobody is watching
// the board any more — it is past a round, a chat and a cup of tea — and
// short enough that a game resumed the same evening still tells people.
const QUIET_MINUTES = 30

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
      // `left_at IS NULL` is what makes a removal real. The token stays
      // valid — it is signed and cannot be recalled — so the seat it points
      // at is the thing that gets revoked. Without this clause a removed
      // player keeps guessing, polling and minting fresh LiveKit tokens, and
      // "removed" means nothing more than a tile disappearing for a moment.
      return (sqlite
        .prepare('SELECT * FROM game_participants WHERE id = ? AND room_id = ? AND left_at IS NULL')
        .get(payload.pid, room.id) as ParticipantRow | undefined) ?? null
    }
  }
  const user = await getCurrentUser(c)
  if (!user) return null
  // Same revocation rule as the token path above: a seat that has been given
  // up or taken away is not a seat.
  return participantsOf(room.id).find((p) => p.user_id === user.id && p.left_at == null) ?? null
}

// Everything below needs a room that exists; this keeps the lookup in one place.
function mustFindRoom(code: string): RoomRow {
  const room = roomByCode(code)
  if (!room) throw new RoomError('No such room', 404)
  return room
}

// Persist, then announce — never the other way round. A broadcast that fails
// is harmless, because it says nothing except "the version moved, go and
// refetch"; a broadcast describing a write that did not land is a desync no
// client can recover from.
//
// Note what is NOT in the message: the change itself. Clients re-read
// GET /state rather than applying a diff, so there is exactly one code path
// that turns the event log into a board, and it is the same fold the recorded
// video will be rendered from. A client that applied broadcasts directly would
// be a second implementation of that fold, free to drift from it — and nobody
// would notice until a recording showed something the players never saw.
// The background name lookup can change a live board on its own, with no
// request to answer. This lets the service say so without importing the
// transport into it.
onRoomChanged((roomId, kind) => {
  const room = sqlite.prepare('SELECT * FROM game_rooms WHERE id = ?').get(roomId) as RoomRow | undefined
  if (!room) return
  broadcastState(room.livekit_room, { kind, stateVersion: room.state_version, code: room.code })
})

function announce(code: string, kind: string): void {
  const room = roomByCode(code)
  if (!room) return
  broadcastState(room.livekit_room, { kind, stateVersion: room.state_version, code: room.code })
}

// POST /api/rooms — the host opens a game.
roomsRouter.post(
  '/',
  requireUser,
  // nullish, not optional: a native client encoding an absent name sends an
  // explicit null, and only a browser omits the key. Rejecting null here cost
  // an afternoon finding out that "create a room" worked on the web and 400'd
  // on the phone.
  zValidator('json', z.object({
    name: z.string().trim().max(60).nullish(),
    // The host's own phone, so it can be kept OFF the invite list it is about
    // to trigger. Registered here rather than left to /api/push/devices
    // because a host creating a game holds a user session, not the
    // participant token that endpoint's first registration asks for.
    pushToken: z.string().trim().min(1).max(512).nullish(),
    pushPlatform: z.enum(['ios', 'android']).nullish(),
  })),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const { name, pushToken, pushPlatform } = c.req.valid('json')
    const hostName = user.display_name ?? user.email.split('@')[0]
    const room = createRoom({ id: user.id, displayName: hostName }, name ?? undefined)
    const host = participantsOf(room.id)[0]

    let deviceSecret: string | null = null
    if (pushToken && pushPlatform) {
      const device = registerDevice({
        platform: pushPlatform,
        token: pushToken,
        displayName: hostName,
        userId: user.id,
      })
      deviceSecret = device.secret
      // Logged like the ones through /api/push/devices, because this is a
      // second door into the same registry and a phone that came through it
      // must not be invisible to the diagnostic.
      recordRegistrationAttempt({
        platform: pushPlatform,
        token: pushToken,
        outcome: 'registered',
        reason: 'on room create',
        deviceId: device.id,
      })
    }

    // The whole point of the feature: creating a game tells everybody, rather
    // than the host pasting a link into a group chat and hoping.
    //
    // Not awaited. The room is already committed, and putting Apple's and
    // Google's latency inside this response — or letting their failure turn a
    // created room into a 500 — would be a bad trade for a message whose
    // worst case is that the host sends the link by hand, exactly as before.
    void sendInvite({ code: room.code, hostName, roomName: room.name }, user.id).catch(
      (err: unknown) => console.warn('push: invite failed:', err),
    )

    return c.json({
      ...roomState(room),
      participantId: host.id,
      participantToken: await signParticipantToken(room.id, host.id),
      deviceSecret,
    }, 201)
  },
)

// POST /api/rooms/:code/join — a friend joins with a name. No account needed.
roomsRouter.post(
  '/:code/join',
  zValidator('json', z.object({
    displayName: z.string().trim().min(1).max(30),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    // A guest's phone, when the app already has a push token in hand. The
    // same registration is available on its own at POST /api/push/devices,
    // which is what an app that only receives its token later in the session
    // uses; this is the shortcut for the common case where it has one
    // already, and it saves a round trip on first run.
    pushToken: z.string().trim().min(1).max(512).nullish(),
  })),
  async (c) => {
    const { displayName, platform, pushToken } = c.req.valid('json')
    const user = await getCurrentUser(c)
    try {
      const { room, participant } = joinRoom(c.req.param('code'), displayName, {
        userId: user?.id ?? null,
        platform,
      })
      announce(room.code, 'participant_joined')
      let deviceSecret: string | null = null
      if (pushToken && (platform === 'ios' || platform === 'android')) {
        const device = registerDevice({
          platform,
          token: pushToken,
          displayName,
          // Left null even for a signed-in guest: user_id's job here is to
          // keep a HOST off their own invite, and a signed-in player joining
          // somebody else's game should still be told about new ones.
          userId: null,
        })
        deviceSecret = device.secret
        recordRegistrationAttempt({
          platform,
          token: pushToken,
          outcome: 'registered',
          reason: 'on room join',
          deviceId: device.id,
        })
      }
      return c.json({
        ...roomState(room),
        participantId: participant.id,
        participantToken: await signParticipantToken(room.id, participant.id),
        deviceSecret,
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
  return c.json({
    ...roomState(room),
    participantId: me.id,
    role: me.role,
    // A fresh token on every poll, so a seat you are sitting in never ages
    // out from under you. Clients re-read this every ten seconds; before
    // this, a room left open for a day hit the participant token's expiry
    // mid-game and every device was told the room was no longer available,
    // which was a lie — the room was fine, the credential had simply run out.
    //
    // It does not weaken revocation. The TTL was never what revoked a seat:
    // participantFor() re-checks `left_at IS NULL` on every single request,
    // so a player the host removes is out on their next call whatever their
    // token says. What the TTL is for is the ABANDONED seat — the token on a
    // phone nobody opens again — and that still goes stale on schedule,
    // because nothing is polling to renew it.
    participantToken: await signParticipantToken(room.id, me.id),
  })
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
      announce(room.code, 'round_frozen')
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
    const inst = startRound(room.id, instanceId)
    announce(room.code, 'round_started')

    // Everybody but the host hears that a round has begun — including the
    // people already in the room, who are the ones most likely to have put
    // the phone down between rounds.
    //
    // Not awaited, for the same reason the invite on create is not: the round
    // is live the moment startRound returns, and making the host wait on
    // Apple and Google — or turning their outage into a 500 on a round that
    // has already started — would be a bad trade.
    void sendRoundStarted(
      { code: room.code, hostName: me.display_name, roomName: room.name },
      room.host_user_id,
    ).catch((err: unknown) => console.warn('push: round ping failed:', err))
    return c.json({ ...roomState(roomByCode(room.code)!), instanceId: inst.id })
  } catch (err) {
    return fail(err)
  }
})

/**
 * Wake everybody when a round comes down to its last answer.
 *
 * Not awaited, like every other ping in this file: the answer has already
 * scored, and Apple's latency is nobody's problem but Apple's.
 */
function notifyIfOneLeft(room: RoomRow, instanceId: number): void {
  if (slotsRemaining(instanceId) !== 1) return
  void sendLastSlot(room, room.host_user_id)
    .catch((err: unknown) => console.warn('push: last-slot ping failed:', err))
}

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
      // Asked before the guess is recorded, and with nothing awaited between
      // the two, so the guess that breaks the silence is the only one that
      // can see it. See roomWentQuiet.
      const quiet = roomWentQuiet(room.id, QUIET_MINUTES)
      const result = submitGuess(instanceId, me, clientGuessId, raw)
      // A replayed guess changed nothing, so there is nothing to announce.
      if (!result.replayed) announce(room.code, 'guess')

      // Somebody picked the game back up. Everybody else's phone says so,
      // because the whole reason a room goes quiet for half an hour is that
      // the other players put their phones down — and they are the people
      // who would want to know.
      //
      // Not awaited, like the two pings above it: the guess has already
      // scored, and Apple's latency is not the guesser's problem.
      if (quiet && !result.replayed) {
        void sendRoomResumed(
          { code: room.code, hostName: me.display_name, roomName: room.name },
          room.host_user_id,
        ).catch((err: unknown) => console.warn('push: resumed ping failed:', err))
      }

      // One slot left. Fires exactly once per round without anything
      // remembering that it has: only a hit moves the count, and only one hit
      // in a round can leave it on 1.
      //
      // A guess that fills two slots at once — one surname, several players —
      // steps over it, and that is the right answer rather than a gap. The
      // round is over by then, and "go help them out" is addressed at a board
      // that still needs help.
      if (result.verdict === 'hit' && !result.replayed) notifyIfOneLeft(room, instanceId)
      return c.json(result)
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/hint — a clue on a slot that is still blank.
roomsRouter.post(
  '/:code/hint',
  zValidator('json', z.object({
    instanceId: z.number().int().positive(),
    rank: z.number().int().positive(),
  })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    const { instanceId, rank } = c.req.valid('json')
    try {
      const result = takeHint(instanceId, me, rank)
      if (!result.replayed) announce(room.code, 'hint')
      return c.json(result)
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/allow — the host's final say on a borderline answer.
//
// Host only, and deliberately a separate route from guessing: this does not
// re-examine the guess, it overrules the list. Some rounds are judgement rather
// than fact, and the alternative to a button is arguing with a database on
// camera.
roomsRouter.post(
  '/:code/allow',
  zValidator('json', z.object({
    instanceId: z.number().int().positive(),
    raw: z.string().trim().min(1).max(100),
  })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    const { instanceId, raw } = c.req.valid('json')
    try {
      const result = allowGuess(instanceId, me, raw)
      announce(room.code, 'allowed')
      // The host overruling the list fills a slot like any other answer, so
      // it can be the thing that leaves one.
      notifyIfOneLeft(room, instanceId)
      return c.json(result)
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/rounds/:instanceId/give-up — show what was missed.
roomsRouter.post('/:code/rounds/:instanceId/give-up', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  try {
    const result = giveUp(Number(c.req.param('instanceId')), me)
    announce(room.code, 'gave_up')
    return c.json(result)
  } catch (err) {
    return fail(err)
  }
})

// POST /api/rooms/:code/reviews/resolve — look up the names the game did not
// recognise and add them, so the next game knows them.
//
// Host only, and explicitly asked for rather than run on its own: it fetches
// Wikipedia and writes new players into the database, which is not something
// to do behind somebody's back.
roomsRouter.post('/:code/reviews/resolve', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  if (me.role !== 'host') return c.json({ error: 'Only the host can do that' }, 403)
  try {
    return c.json(await resolvePendingReviews(room.id))
  } catch (err) {
    return fail(err)
  }
})

// POST /api/rooms/:code/chat — a typed message, for the player whose
// microphone or camera is not working. Unlike guessing, anyone in the room
// may post: that is the entire point of it.
roomsRouter.post(
  '/:code/chat',
  zValidator('json', z.object({
    clientMessageId: z.string().min(1).max(64),
    body: z.string().trim().min(1).max(500),
  })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    const { clientMessageId, body } = c.req.valid('json')
    try {
      const result = postMessage(room, me, clientMessageId, body)
      if (!result.replayed) announce(room.code, 'chat')
      return c.json(result)
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
  announce(room.code, 'participant_left')
  return c.json({ ok: true })
})

// POST /api/rooms/:code/participants/:id/remove — the host removes a player.
//
// Two writes, in this order: the seat is revoked in SQLite, and only then is
// the call cut. The database is what enforces the removal — the LiveKit eject
// is what makes it visible, and it is allowed to fail.
roomsRouter.post('/:code/participants/:id/remove', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  try {
    const target = removeParticipant(room.id, me, Number(c.req.param('id')))
    ejectParticipant(room.livekit_room, `p${target.id}`)
    announce(room.code, 'participant_removed')
    return c.json({ ok: true })
  } catch (err) {
    return fail(err)
  }
})

// POST /api/rooms/:code/participants/:id/report — anyone reports anyone.
//
// Not host-only on purpose. The person who needs to report something is
// whoever it was aimed at, and routing that through the host is no use at all
// when the host is the problem.
roomsRouter.post(
  '/:code/participants/:id/report',
  zValidator('json', z.object({
    reason: z.enum(['abuse', 'harassment', 'nudity', 'hate', 'other']),
    note: z.string().trim().max(500).nullish(),
  })),
  async (c) => {
    const room = mustFindRoom(c.req.param('code'))
    const me = await participantFor(c, room)
    if (!me) return c.json({ error: 'Not in this room' }, 403)
    const { reason, note } = c.req.valid('json')
    try {
      reportParticipant(room.id, me, Number(c.req.param('id')), reason, note ?? null)
      return c.json({ ok: true })
    } catch (err) {
      return fail(err)
    }
  },
)

// POST /api/rooms/:code/end — host closes the game.
roomsRouter.post('/:code/end', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  if (me.role !== 'host') return c.json({ error: 'Only the host can end the game' }, 403)
  endRoom(room.id)
  announce(room.code, 'room_ended')
  return c.json({ ok: true })
})

// GET /api/rooms/:code/livekit-token — the credential to dial into the call.
//
// Minted per participant and scoped to this room's LiveKit room name, so a
// token that escapes with a game code cannot be used to walk into a different
// game.
roomsRouter.get('/:code/livekit-token', async (c) => {
  const room = mustFindRoom(c.req.param('code'))
  const me = await participantFor(c, room)
  if (!me) return c.json({ error: 'Not in this room' }, 403)
  const config = livekitConfig()
  if (!config) return c.json({ error: 'Video is not configured on this server' }, 503)

  // Identity is the participant row, not the user: guests have no user id, and
  // the slot-to-tile mapping the recording depends on is keyed on this row.
  const identity = `p${me.id}`
  return c.json({
    url: config.url,
    roomName: room.livekit_room,
    identity,
    slot: me.slot,
    token: await mintJoinToken(room.livekit_room, identity, me.display_name),
  })
})

// Turn a RoomError into its intended status rather than a 500.
roomsRouter.onError((err, c) => {
  if (err instanceof RoomError) return c.json({ error: err.message }, err.status)
  console.error('rooms:', err)
  return c.json({ error: 'Something went wrong' }, 500)
})
