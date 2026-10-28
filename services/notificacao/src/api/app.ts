import { Hono } from 'hono';
import type { Logger } from '../infra/logger.js';

/** Infrastructure the HTTP API calls; injected so tests can replace it. */
export type ApiDependencies = {
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly lembrarPendentes: () => Promise<{ readonly lembretes: number }>;
  readonly logger: Logger;
};

/**
 * HTTP API: `GET /health` (200 or 503 with each dependency) and `POST /lembrar-pendentes`, the
 * agendador's trigger, which answers how many lembretes were registered (ADR 0027). The gateway
 * routes nothing here. Unhandled errors become 500.
 */
export const createApp = ({ health, lembrarPendentes, logger }: ApiDependencies) =>
  new Hono()
    .onError((error, c) => {
      logger.error('unhandled error', { error });
      return c.json({ error: 'erro-interno' }, 500);
    })
    .get('/health', async (c) => {
      const dependencies = await health();
      const healthy = Object.values(dependencies).every(Boolean);
      return c.json({ status: healthy ? 'ok' : 'unhealthy', dependencies }, healthy ? 200 : 503);
    })
    .post('/lembrar-pendentes', async (c) => c.json(await lembrarPendentes()));
