import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { xi_leaderboard } from '../db/schema.ts'

export const xiLeaderboardRouter = new Hono()

// GET /api/xi-leaderboard
xiLeaderboardRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(xi_leaderboard)
    .orderBy(desc(xi_leaderboard.score), xi_leaderboard.created_at)
    .limit(20)
  return c.json(rows)
})

// POST /api/xi-leaderboard
xiLeaderboardRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      player_name: z.string().min(1).max(50),
      score: z.number().int().min(0),
      total: z.number().int().positive(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')
    const [entry] = await db.insert(xi_leaderboard).values(body).returning()
    return c.json(entry, 201)
  }
)
