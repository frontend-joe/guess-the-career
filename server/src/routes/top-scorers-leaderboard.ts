import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { top_scorers_leaderboard } from '../db/schema.ts'

export const topScorersLeaderboardRouter = new Hono()

// GET /api/top-scorers-leaderboard
topScorersLeaderboardRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(top_scorers_leaderboard)
    .orderBy(desc(top_scorers_leaderboard.score), top_scorers_leaderboard.created_at)
    .limit(20)
  return c.json(rows)
})

// POST /api/top-scorers-leaderboard
topScorersLeaderboardRouter.post(
  '/',
  zValidator('json', z.object({
    player_name: z.string().min(1).max(50),
    score: z.number().int().min(0),
    total: z.number().int().positive(),
  })),
  async (c) => {
    const body = c.req.valid('json')
    const [entry] = await db.insert(top_scorers_leaderboard).values(body).returning()
    return c.json(entry, 201)
  }
)
