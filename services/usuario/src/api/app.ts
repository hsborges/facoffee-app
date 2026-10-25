import { type Context, Hono } from 'hono';
import type { Result } from '../domain/result.js';
import { type DesativarErro, perfisDos, type Usuario } from '../domain/usuario.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly desativar: (
    solicitante: Pick<Usuario, 'id' | 'perfis'>,
    usuarioId: string,
  ) => Promise<Result<void, DesativarErro>>;
  readonly estaDesativado: (id: string) => Promise<boolean>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Identity comes from the gateway (ADR 0007); name and email arrive percent-encoded.
const usuarioLogado = (c: Context): Usuario | undefined => {
  const id = c.req.header('x-user-id');
  if (!id) return undefined;
  return {
    id,
    nome: decodeURIComponent(c.req.header('x-user-name') ?? ''),
    email: decodeURIComponent(c.req.header('x-user-email') ?? ''),
    perfis: perfisDos((c.req.header('x-user-roles') ?? '').split(',')),
  };
};

/**
 * HTTP API of the Usuário context: `GET /eu` (ADR 0008), `POST /:id/desativacao` and
 * `GET /acesso`, the gateway access check (ADR 0011). Without `X-User-Id`, 401.
 * Logs every request except health probes and access checks; unhandled errors become 500.
 */
export const createApp = ({ desativar, estaDesativado, health, logger }: ApiDependencies) =>
  new Hono()
    .use(async (c, next) => {
      const start = performance.now();
      await next();
      // Health probes and the gateway access check run all the time; logging them only adds noise.
      if (c.req.path === '/health' || c.req.path === '/acesso') return;
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
    .get('/eu', (c) => {
      const usuario = usuarioLogado(c);
      return usuario ? c.json(usuario) : c.json({ error: 'unauthorized' }, 401);
    })
    // Traefik ForwardAuth target (ADR 0011): any non-2xx response stops the request.
    .all('/acesso', async (c) => {
      const id = c.req.header('x-user-id');
      if (!id) return c.json({ error: 'unauthorized' }, 401);
      if (UUID.test(id) && (await estaDesativado(id))) {
        return c.json({ error: 'acesso-desativado' }, 403);
      }
      return c.body(null, 204);
    })
    .post('/:id/desativacao', async (c) => {
      const solicitante = usuarioLogado(c);
      if (!solicitante) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'not-found' }, 404);
      const result = await desativar(solicitante, id);
      return result.ok ? c.body(null, 204) : c.json({ error: result.error }, 403);
    });
