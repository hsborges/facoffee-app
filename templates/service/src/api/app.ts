import { Hono } from 'hono';
import type { Example, RegisterError } from '../domain/example.js';
import type { Result } from '../domain/result.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly register: (command: {
    readonly name: string;
  }) => Promise<Result<Example, RegisterError>>;
  readonly find: (id: string) => Promise<Example | undefined>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * HTTP API: `GET /health` (200 or 503 with each dependency), `POST /examples` and
 * `GET /examples/:id`. Logs every request except health probes; unhandled errors become 500.
 */
export const createApp = ({ register, find, health, logger }: ApiDependencies) =>
  new Hono()
    .use(async (c, next) => {
      const start = performance.now();
      await next();
      // Health probes run every few seconds; logging them only adds noise.
      if (c.req.path === '/health') return;
      logger.info('request', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - start),
      });
    })
    .onError((error, c) => {
      logger.error('unhandled error', { error });
      return c.json({ error: 'internal-error' }, 500);
    })
    .get('/health', async (c) => {
      const dependencies = await health();
      const healthy = Object.values(dependencies).every(Boolean);
      return c.json({ status: healthy ? 'ok' : 'unhealthy', dependencies }, healthy ? 200 : 503);
    })
    .post('/examples', async (c) => {
      const body = await c.req.json().catch(() => null);
      if (typeof body?.name !== 'string') return c.json({ error: 'name-required' }, 400);
      const result = await register({ name: body.name });
      return result.ok ? c.json(result.value, 201) : c.json({ error: result.error }, 422);
    })
    .get('/examples/:id', async (c) => {
      const id = c.req.param('id');
      const example = UUID.test(id) ? await find(id) : undefined;
      return example ? c.json(example) : c.json({ error: 'not-found' }, 404);
    });
