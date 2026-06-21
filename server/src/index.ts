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
import { threeClubsRouter } from './routes/three-clubs.ts'
import { competitionsRouter } from './routes/competitions.ts'
import { topScorersScheduleRouter } from './routes/top-scorers-schedule.ts'
import { topScorersLeaderboardRouter } from './routes/top-scorers-leaderboard.ts'
import { positionKnowledgeRouter } from './routes/position-knowledge.ts'
import { sopScheduleRouter } from './routes/sop-schedule.ts'
import { sopLeaderboardRouter } from './routes/sop-leaderboard.ts'
import { goalRatiosRouter } from './routes/goal-ratios.ts'
import { centurionsRouter } from './routes/centurions.ts'
import { kitGameRouter } from './routes/kit-game.ts'
import { honorGameRouter } from './routes/honor-game.ts'
import { ballonDorsRouter } from './routes/ballon-dors.ts'
import { ballonDorScheduleRouter } from './routes/ballon-dor-schedule.ts'
import { worldCupSquadsRouter } from './routes/world-cup-squads.ts'
import { worldCupScheduleRouter } from './routes/world-cup-schedule.ts'
import { nationalsRouter } from './routes/nationals.ts'
import { foreignersRouter } from './routes/foreigners.ts'
import { serieARouter } from './routes/serie-a.ts'
import { clubLegendsRouter } from './routes/club-legends.ts'
import { clubMarksmanRouter } from './routes/club-marksman.ts'
import { transfersRouter } from './routes/transfers.ts'
import { transferHistoryRouter } from './routes/transfer-history.ts'
import { authRouter } from './routes/auth.ts'
import { usersRouter } from './routes/users.ts'
import { bootstrapAdmin } from './services/auth.ts'

runMigrations()
await bootstrapAdmin()

const app = new Hono()

app.use('*', logger())
// credentials:true so the httpOnly session cookie is sent/accepted. Falls back
// to reflecting the request origin when CLIENT_URL isn't set (dev/proxy).
app.use('*', cors({ origin: process.env.CLIENT_URL ?? ((origin) => origin), credentials: true }))

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
app.route('/api/three-clubs', threeClubsRouter)
app.route('/api/competitions', competitionsRouter)
app.route('/api/top-scorers-schedule', topScorersScheduleRouter)
app.route('/api/top-scorers-leaderboard', topScorersLeaderboardRouter)
app.route('/api/position-knowledge', positionKnowledgeRouter)
app.route('/api/sop-schedule', sopScheduleRouter)
app.route('/api/sop-leaderboard', sopLeaderboardRouter)
app.route('/api/goal-ratios', goalRatiosRouter)
app.route('/api/centurions', centurionsRouter)
app.route('/api/kit-game', kitGameRouter)
app.route('/api/honor-game', honorGameRouter)
app.route('/api/ballon-dors', ballonDorsRouter)
app.route('/api/ballon-dor-schedule', ballonDorScheduleRouter)
app.route('/api/world-cup-squads', worldCupSquadsRouter)
app.route('/api/world-cup-schedule', worldCupScheduleRouter)
app.route('/api/nationals', nationalsRouter)
app.route('/api/foreigners', foreignersRouter)
app.route('/api/serie-a', serieARouter)
app.route('/api/club-legends', clubLegendsRouter)
app.route('/api/club-marksman', clubMarksmanRouter)
app.route('/api/transfers', transfersRouter)
app.route('/api/transfer-history', transferHistoryRouter)
app.route('/api/auth', authRouter)
app.route('/api/users', usersRouter)

app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
console.log(`Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
