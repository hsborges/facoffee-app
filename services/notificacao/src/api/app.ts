import { Hono } from 'hono';
import type { Logger } from '../infra/logger.js';

/** Infrastructure the HTTP API calls; injected so tests can replace it. */
export type ApiDependencies = {
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

/** HTTP API: only `GET /health` (200 or 503 with each dependency); unhandled errors become 500. */
export const createApp = ({ health, logger }: ApiDependencies) =>
  new Hono()
    .onError((error, c) => {
      logger.error('unhandled error', { error });
      return c.json({ error: 'internal-error' }, 500);
    })
    .get('/health', async (c) => {
      const dependencies = await health();
      const healthy = Object.values(dependencies).every(Boolean);
      return c.json({ status: healthy ? 'ok' : 'unhealthy', dependencies }, healthy ? 200 : 503);
    });
