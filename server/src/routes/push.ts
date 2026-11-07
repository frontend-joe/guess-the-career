import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requestBearer, requireAdmin, verifyParticipantToken } from '../services/auth.ts'
import {
  apnsMissing,
  deviceBySecret,
  deviceSummaries,
  fcmMissing,
  recentRegistrationAttempts,
  recordRegistrationAttempt,
  registerDevice,
  rotateToken,
  sendTestPush,
  setMuted,
} from '../services/push.ts'

export const pushRouter = new Hono()

// Registered up here, not beside the handlers it guards: Hono applies
// middleware in registration order, and a use() declared after a route does
// not run for it — which would leave these endpoints open.
pushRouter.use('/admin/*', requireAdmin)

// Registering a phone for notifications.
//
// The awkward part of this endpoint is credentials, because the people being
// notified have no accounts — guests join with a code and a typed name, on
// purpose (see 0087_game_rooms.sql). So there are exactly two ways to prove
// you are allowed in the registry:
//
//   a participant token — you are sitting in a game right now, which means
//                         somebody invited you. This is first registration.
//   a device secret     — you registered before and were handed one. This is
//                         every later call, when the token has rotated or the
//                         owner wants to be left alone.
//
// Unauthenticated registration was the obvious alternative and is rejected:
// the notification body carries a join code, so anyone who could add a token
// could have themselves invited into other people's games.

const registration = z.object({
  platform: z.enum(['ios', 'android']),
  token: z.string().trim().min(1).max(512),
  displayName: z.string().trim().min(1).max(30).nullish(),
  /// Present on every call after the first. Its absence is what makes this a
  /// first registration, which is the case that needs a participant token.
  secret: z.string().trim().min(1).max(128).nullish(),
})

// POST /api/push/devices — register, or tell us the token changed.
pushRouter.post('/devices', zValidator('json', registration), async (c) => {
  const { platform, token, displayName, secret } = c.req.valid('json')

  if (secret) {
    const updated = rotateToken(secret, token, displayName ?? null)
    if (!updated) {
      recordRegistrationAttempt({ platform, token, outcome: 'unknown-secret' })
      return c.json({ error: 'Unknown device' }, 404)
    }
    recordRegistrationAttempt({ platform, token, outcome: 'rotated', deviceId: updated.id })
    return c.json({ secret: updated.secret, muted: !!updated.muted })
  }

  const bearer = requestBearer(c)
  const participant = bearer ? await verifyParticipantToken(bearer) : null
  if (!participant) {
    // Deliberately specific. A silent 403 here looks identical to push simply
    // not working, and this is the one failure a developer will hit over and
    // over while wiring an app up.
    //
    // Recorded as well as returned, because the person who needs this message
    // is holding the phone and cannot see its HTTP responses. Without the row
    // a refusal and a phone that never called are the same empty registry.
    recordRegistrationAttempt({
      platform,
      token,
      outcome: 'refused',
      reason: bearer ? 'participant token rejected' : 'no participant token sent',
    })
    return c.json({ error: 'A first registration needs the participant token of a game you are in' }, 403)
  }

  const device = registerDevice({ platform, token, displayName: displayName ?? null })
  recordRegistrationAttempt({ platform, token, outcome: 'registered', deviceId: device.id })
  return c.json({ secret: device.secret, muted: !!device.muted }, 201)
})

// POST /api/push/devices/mute — stop, or resume, being told about new games.
//
// Worth having from the start rather than later: the audience for an invite is
// "every phone that is not the host's", so the only way off the list is to ask,
// and a notification you cannot turn off is one you turn the whole app's
// notifications off to escape.
pushRouter.post(
  '/devices/mute',
  zValidator('json', z.object({ secret: z.string().trim().min(1).max(128), muted: z.boolean() })),
  (c) => {
    const { secret, muted } = c.req.valid('json')
    const updated = setMuted(secret, muted)
    if (!updated) return c.json({ error: 'Unknown device' }, 404)
    return c.json({ muted: !!updated.muted })
  },
)

// GET /api/push/devices/me — what the server thinks of this phone, so the
// app's settings toggle reflects the server rather than its own last guess.
pushRouter.get('/devices/me', (c) => {
  const secret = c.req.query('secret')
  const device = secret ? deviceBySecret(secret) : null
  if (!device) return c.json({ error: 'Unknown device' }, 404)
  return c.json({
    platform: device.platform,
    displayName: device.display_name,
    muted: !!device.muted,
    disabled: device.disabled_at != null,
  })
})

// ── Diagnostics, for when somebody says push is not working ─────────────────
//
// Admin-only, unlike everything above. These two endpoints are the difference
// between "notifications are broken" and a cause: the registry says whether
// the phone ever registered and whether we gave up on it, and the test send
// reports Apple's or Google's own refusal rather than a shrug. Both are read
// from a terminal by whoever is holding the phone that is not buzzing.

// GET /api/push/admin/devices — every phone we know about, tokens redacted.
pushRouter.get('/admin/devices', (c) =>
  c.json({
    // Reported alongside the devices because a complete, healthy-looking
    // registry with no credentials behind it is the one failure the rows
    // themselves cannot show.
    credentials: { apnsMissing: apnsMissing(), fcmMissing: fcmMissing() },
    devices: deviceSummaries(),
    // The other half of the question. An empty registry means one of two
    // opposite things, and only these rows tell them apart: attempts present
    // means the phone reached us and we turned it away; none means it never
    // called, which is a permission or a token problem on the phone itself.
    recentAttempts: recentRegistrationAttempts(),
  }),
)

// POST /api/push/admin/devices/:id/test — actually wake that phone up.
//
// A 404 here means the id is not in the registry; a 200 with delivered:false
// means the gateway was reached and refused us, and `attempts` carries its
// exact word for why.
pushRouter.post('/admin/devices/:id/test', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'Not a device id' }, 400)
  const result = await sendTestPush(id)
  if (!result) return c.json({ error: 'Unknown device' }, 404)
  return c.json(result)
})
