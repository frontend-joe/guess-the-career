import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import { requireAdmin, hashPassword, getCurrentUser } from '../services/auth.ts'

export const usersRouter = new Hono()

// Everything here is admin-only.
usersRouter.use('*', requireAdmin)

const userCols = {
  id: users.id,
  email: users.email,
  is_admin: users.is_admin,
  created_at: users.created_at,
}

// GET /api/users — list all users
usersRouter.get('/', async (c) => {
  const rows = await db.select(userCols).from(users).orderBy(users.created_at)
  return c.json(rows)
})

// POST /api/users — create a user (optionally an admin)
usersRouter.post(
  '/',
  zValidator('json', z.object({
    email: z.string().email().transform((e) => e.trim().toLowerCase()),
    password: z.string().min(8).max(200),
    is_admin: z.boolean().optional().default(false),
  })),
  async (c) => {
    const { email, password, is_admin } = c.req.valid('json')
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing) return c.json({ error: 'An account with that email already exists.' }, 409)
    const [created] = await db
      .insert(users)
      .values({ email, password_hash: hashPassword(password), is_admin })
      .returning(userCols)
    return c.json(created, 201)
  },
)

// PATCH /api/users/:id — edit email / admin flag / reset password
usersRouter.patch(
  '/:id',
  zValidator('json', z.object({
    email: z.string().email().transform((e) => e.trim().toLowerCase()).optional(),
    is_admin: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  })),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const data = c.req.valid('json')
    const set: Partial<{ email: string; is_admin: boolean; password_hash: string }> = {}

    if (data.email !== undefined) {
      const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1)
      if (dup && dup.id !== id) return c.json({ error: 'Email already in use.' }, 409)
      set.email = data.email
    }
    if (data.is_admin !== undefined) set.is_admin = data.is_admin
    if (data.password !== undefined) set.password_hash = hashPassword(data.password)
    if (Object.keys(set).length === 0) return c.json({ error: 'Nothing to update' }, 400)

    const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning(userCols)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  },
)

// DELETE /api/users/:id — remove a user (can't delete yourself)
usersRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const me = await getCurrentUser(c)
  if (me && me.id === id) return c.json({ error: "You can't delete your own account." }, 400)
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id })
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})
