import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sqlite } from '../db/client.ts'
import { getCurrentUser } from '../services/auth.ts'

export const settingsRouter = new Hono()

// Per-user game settings, stored as a JSON blob on users.settings.
// Guess percentage is per-game: { guessPercentages: { [gameKey]: 25|50|75|100 } }.

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

// PUT /api/settings — set one game's guess percentage, merged into the blob.
settingsRouter.put(
  '/',
  zValidator(
    'json',
    z.object({
      gameKey: z.string().min(1).max(64),
      guessPercentage: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
    }),
  ),
  async (c) => {
    const user = await getCurrentUser(c)
    if (!user) return c.json({ error: 'Not authenticated' }, 401)

    const { gameKey, guessPercentage } = c.req.valid('json')
    const settings = readSettings(user.id)
    const map =
      settings.guessPercentages && typeof settings.guessPercentages === 'object'
        ? (settings.guessPercentages as Record<string, number>)
        : {}
    map[gameKey] = guessPercentage
    settings.guessPercentages = map
    sqlite.prepare(`UPDATE users SET settings = ? WHERE id = ?`).run(JSON.stringify(settings), user.id)
    return c.json(settings)
  },
)
