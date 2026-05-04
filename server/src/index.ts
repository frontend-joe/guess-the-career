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

runMigrations()

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: process.env.CLIENT_URL ?? '*' }))

app.route('/api/footballers', footballersRouter)
app.route('/api/days', daysRouter)
app.route('/api/admin', adminRouter)
app.route('/api/managers', managersRouter)
app.route('/api/manager-days', managerDaysRouter)

app.get('/api/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '3001')
console.log(`Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
