// Thin read interface (optional): a single read-only HTTP route returning the
// derived state as JSON. Demonstrates R-S2 (MODEL:283) over HTTP without any
// second calculation system. CORS is restricted to localhost per the repo's
// tech steering (.kiro/steering/tech.md).
//
// Usage: npm run serve   →   GET http://localhost:3002/derived?asOf=2026-01-28

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { derive } from '../derive.js';
import { TINY_AS_OF, tinyProjectEvents } from '../fixtures/tiny-project.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: (origin) =>
      origin && /^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : null,
  }),
);

app.get('/derived', (c) => {
  const asOf = c.req.query('asOf') ?? TINY_AS_OF;
  return c.json(derive(tinyProjectEvents, { asOf }));
});

app.get('/', (c) => c.text('moira-backend S4 read API — try GET /derived?asOf=2026-01-28'));

const port = Number(process.env.MOIRA_PORT ?? 3002);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`moira-backend read API on http://localhost:${port}/derived`);
