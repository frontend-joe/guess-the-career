import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { getCurrentUser } from '../services/auth.ts'

export const settingsRouter = new Hono()

// Per-user global game settings, stored as a JSON blob on users.settings.
// Currently just { guessPercentage }, but shaped to grow.

function readSettings(userId: number): Record<string, unknown> {
  const row = sqlite.prepare(`SELECT settings FROM users WHERE id = ?`).get(userId) as
    | { settings: string }
    | undefined
  if (!row) return {}
  try {
    const parsed = JSON.parse(row.settings)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// GET /api/settings — the current user's settings blob (or {} if none).
settingsRouter.get('/', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ error: 'Not authenticated' }, 401)
  return c.json(readSettings(user.id))
})

// PUT /api/settings — shallow-merge the provided fields into the stored blob.
settingsRouter.put(
  '/',
  zValidator(
    'json',
    z.object({
      guessPercentage: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional(),
    }),
  ),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Not authenticated' }, 401)

    const patch = c.req.valid('json')
    const merged = { ...readSettings(user.id), ...patch }
    sqlite.prepare(`UPDATE users SET settings = ? WHERE id = ?`).run(JSON.stringify(merged), user.id)
    return c.json(merged)
  },
)
