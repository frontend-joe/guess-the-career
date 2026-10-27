import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/auth.ts'

export const authRouter = new Hono()

const credsSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8).max(200),
})

// A name to show on a video tile, defaulted from the email so nobody is ever
// nameless. Matches the backfill in migration 0085.
function defaultDisplayName(email: string): string {
  return email.split('@')[0].slice(0, 30)
}

// POST /api/auth/signup
authRouter.post('/signup', zValidator('json', credsSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) return c.json({ error: 'An account with that email already exists.' }, 409)

  const [created] = await db
    .insert(users)
    .values({
      email,
      password_hash: hashPassword(password),
      is_admin: false,
      display_name: defaultDisplayName(email),
    })
    .returning({
      id: users.id,
      email: users.email,
      is_admin: users.is_admin,
      display_name: users.display_name,
    })

  await setSessionCookie(c, created)
  return c.json(created, 201)
})

// POST /api/auth/login
authRouter.post('/login', zValidator('json', credsSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const [user] = await db
    .select({ id: users.id, email: users.email, is_admin: users.is_admin, password_hash: users.password_hash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ error: 'Invalid email or password.' }, 401)
  }

  await setSessionCookie(c, user)
  return c.json({ id: user.id, email: user.email, is_admin: user.is_admin })
})

// POST /api/auth/logout
authRouter.post('/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

// GET /api/auth/me
authRouter.get('/me', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ error: 'Not authenticated' }, 401)
  return c.json(user)
})

// PATCH /api/auth/me — the name shown on a video tile.
authRouter.patch(
  '/me',
  zValidator('json', z.object({ displayName: z.string().trim().min(1).max(30) })),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Not authenticated' }, 401)
    const { displayName } = c.req.valid('json')
    await db.update(users).set({ display_name: displayName }).where(eq(users.id, user.id))
    return c.json({ ...user, display_name: displayName })
  },
)

// ── Bearer tokens for the native apps ───────────────────────────────────────
// The web client keeps using the cookie; these exist because a Swift/Kotlin
// client talks to Railway directly and has no cookie jar worth relying on.

const deviceSchema = z.object({
  deviceLabel: z.string().max(100).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
})

// POST /api/auth/token — log in and get an access + refresh pair.
authRouter.post('/token', zValidator('json', credsSchema.merge(deviceSchema)), async (c) => {
  const { email, password, deviceLabel, platform } = c.req.valid('json')
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      is_admin: users.is_admin,
      display_name: users.display_name,
      avatar_url: users.avatar_url,
      password_hash: users.password_hash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !verifyPassword(password, user.password_hash)) {
    return c.json({ error: 'Invalid email or password.' }, 401)
  }

  const tokens = await issueTokenPair(user, { deviceLabel, platform })
  const { password_hash: _ignored, ...safe } = user
  return c.json({ ...tokens, user: safe })
})

// POST /api/auth/token/refresh — spend a refresh token for a new pair.
authRouter.post(
  '/token/refresh',
  zValidator('json', z.object({ refreshToken: z.string().min(1) })),
  async (c) => {
    const tokens = await rotateRefreshToken(c.req.valid('json').refreshToken)
    if (!tokens) return c.json({ error: 'Invalid or expired refresh token.' }, 401)
    return c.json(tokens)
  },
)

// POST /api/auth/token/revoke — sign this device out.
authRouter.post(
  '/token/revoke',
  zValidator('json', z.object({ refreshToken: z.string().min(1) })),
  async (c) => {
    await revokeRefreshToken(c.req.valid('json').refreshToken)
    return c.json({ ok: true })
  },
)
