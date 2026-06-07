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
} from '../services/auth.ts'

export const authRouter = new Hono()

const credsSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8).max(200),
})

// POST /api/auth/signup
authRouter.post('/signup', zValidator('json', credsSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) return c.json({ error: 'An account with that email already exists.' }, 409)

  const [created] = await db
    .insert(users)
    .values({ email, password_hash: hashPassword(password), is_admin: false })
    .returning({ id: users.id, email: users.email, is_admin: users.is_admin })

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
