import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './router.js'
import { runMigrations } from './db/index.js'

// Req 1.7: apply Drizzle migrations automatically at startup
runMigrations()

const app = new Hono()

app.use('*', logger())
// CORS restricted to localhost only (Req design.md security section)
app.use('*', cors({ origin: 'http://localhost:5173' }))

// tRPC handler mounted at /trpc/*
app.all('/trpc/*', (c) => {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => ({}),
  })
})

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env['PORT'] ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`EVM Studio server running at http://localhost:${info.port}`)
})
