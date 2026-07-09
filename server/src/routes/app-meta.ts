import { Hono } from 'hono'
import { getAppMeta } from '../services/appMeta.ts'

export const appMetaRouter = new Hono()

// GET /api/app-meta — public read of global app metadata used by the client.
appMetaRouter.get('/', (c) => {
  return c.json({ lastRescrape: getAppMeta('last_rescrape') })
})
