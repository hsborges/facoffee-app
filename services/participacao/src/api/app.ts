import { Hono } from 'hono';
import { type EntrarErro, TIPOS_DE_COTA, type TipoDeCota } from '../domain/participante.js';
import type { Result } from '../domain/result.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly pedirEntrada: (id: string, tipoDeCota: TipoDeCota) => Promise<Result<void, EntrarErro>>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isTipoDeCota = (valor: unknown): valor is TipoDeCota =>
  TIPOS_DE_COTA.includes(valor as TipoDeCota);

/**
 * HTTP API of the Participação context: `POST /entrada`, the logged-in person asks to enter with
 * a tipo de cota. Identity comes from the gateway in `X-User-Id` (ADR 0007); without it, 401.
 * Logs every request except health probes; unhandled errors become 500.
 */
export const createApp = ({ pedirEntrada, health, logger }: ApiDependencies) =>
  new Hono()
    .use(async (c, next) => {
      const start = performance.now();
      await next();
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
    .post('/entrada', async (c) => {
      const id = c.req.header('x-user-id');
      // The id becomes participantId, a uuid in the event contract.
      if (!id || !UUID.test(id)) return c.json({ error: 'unauthorized' }, 401);
      const body = await c.req.json().catch(() => undefined);
      const tipoDeCota = (body as { tipoDeCota?: unknown } | undefined)?.tipoDeCota;
      if (!isTipoDeCota(tipoDeCota)) return c.json({ error: 'tipo-de-cota-invalido' }, 400);
      const result = await pedirEntrada(id, tipoDeCota);
      return result.ok ? c.body(null, 204) : c.json({ error: result.error }, 409);
    });
