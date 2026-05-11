import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { runMigrations } from './db/client.ts'
import { footballersRouter } from './routes/footballers.ts'
import { daysRouter } from './routes/days.ts'
import { adminRouter } from './routes/admin.ts'
import { managersRouter } from './routes/managers.ts'
import { managerDaysRouter } from './routes/manager-days.ts'
import { clubsRouter } from './routes/clubs.ts'
import { guessHisClubsRouter } from './routes/guess-his-clubs.ts'
import { clubsInCommonRouter } from './routes/clubs-in-common.ts'
import { whoScoredMoreRouter } from './routes/who-scored-more.ts'
import { wsmLeaderboardRouter } from './routes/wsm-leaderboard.ts'
import { whoPlayedMoreRouter } from './routes/who-played-more.ts'
import { wpmLeaderboardRouter } from './routes/wpm-leaderboard.ts'
import { xiMatchesRouter } from './routes/xi-matches.ts'
import { guessTheXiRouter } from './routes/guess-the-xi.ts'
import { xiLeaderboardRouter } from './routes/xi-leaderboard.ts'
import { knowYourClubRouter } from './routes/know-your-club.ts'
import { xiScheduleRouter } from './routes/xi-schedule.ts'
import { twoClubsRouter } from './routes/two-clubs.ts'
import { competitionsRouter } from './routes/competitions.ts'
import { topScorersScheduleRouter } from './routes/top-scorers-schedule.ts'
import { topScorersLeaderboardRouter } from './routes/top-scorers-leaderboard.ts'

runMigrations()

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: process.env.CLIENT_URL ?? '*' }))

app.route('/api/footballers', footballersRouter)
app.route('/api/days', daysRouter)
app.route('/api/admin', adminRouter)
app.route('/api/managers', managersRouter)
app.route('/api/manager-days', managerDaysRouter)
app.route('/api/clubs', clubsRouter)
app.route('/api/guess-his-clubs', guessHisClubsRouter)
app.route('/api/clubs-in-common', clubsInCommonRouter)
app.route('/api/who-scored-more', whoScoredMoreRouter)
app.route('/api/wsm-leaderboard', wsmLeaderboardRouter)
app.route('/api/who-played-more', whoPlayedMoreRouter)
app.route('/api/wpm-leaderboard', wpmLeaderboardRouter)
app.route('/api/xi-matches', xiMatchesRouter)
app.route('/api/guess-the-xi', guessTheXiRouter)
app.route('/api/xi-leaderboard', xiLeaderboardRouter)
app.route('/api/know-your-club', knowYourClubRouter)
app.route('/api/xi-schedule', xiScheduleRouter)
app.route('/api/two-clubs', twoClubsRouter)
app.route('/api/competitions', competitionsRouter)
app.route('/api/top-scorers-schedule', topScorersScheduleRouter)
app.route('/api/top-scorers-leaderboard', topScorersLeaderboardRouter)

app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
console.log(`Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
