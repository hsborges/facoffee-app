import { serve } from '@hono/node-server';
import { app } from './api/app.js';

const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
