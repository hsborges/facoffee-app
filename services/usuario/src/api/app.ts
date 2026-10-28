import { type Context, Hono } from 'hono';
import type { Result } from '../domain/result.js';
import {
  type DesativarErro,
  perfisDos,
  type ReativarErro,
  type SemPermissao,
  type Usuario,
  type UsuarioRegistrado,
} from '../domain/usuario.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly desativar: (
    solicitante: Pick<Usuario, 'id' | 'perfis'>,
    usuarioId: string,
  ) => Promise<Result<void, DesativarErro>>;
  readonly registrarAcesso: (
    usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'perfis'>,
  ) => Promise<'ativo' | 'desativado'>;
  readonly listar: (
    solicitante: Pick<Usuario, 'perfis'>,
  ) => Promise<Result<readonly UsuarioRegistrado[], SemPermissao>>;
  readonly contato: (id: string) => Promise<Pick<Usuario, 'id' | 'nome' | 'email'> | undefined>;
  readonly gestores: () => Promise<readonly Pick<Usuario, 'id' | 'nome' | 'email'>[]>;
  readonly reativar: (
    solicitante: Pick<Usuario, 'perfis'>,
    usuarioId: string,
  ) => Promise<Result<void, ReativarErro>>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const STATUS_DO_ERRO = { 'sem-permissao': 403, 'usuario-nao-encontrado': 404 } as const;

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
 * HTTP API of the Usuário context: `GET /eu` (ADR 0008), `POST /:id/desativar`,
 * `GET /acesso`, the gateway access check that also registers the usuário (ADR 0011, 0012),
 * `GET /` and `POST /:id/reativar` (ADR 0013). Without `X-User-Id`, 401.
 * `GET /contato/:id` (ADR 0020) and `GET /contato/gestor` (ADR 0031) are internal, for
 * Notificação, and kept out of the gateway.
 * Logs every request except health probes and access checks; unhandled errors become 500.
 */
export const createApp = ({
  desativar,
  registrarAcesso,
  listar,
  contato,
  gestores,
  reativar,
  health,
  logger,
}: ApiDependencies) =>
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
      return c.json({ error: 'erro-interno' }, 500);
    })
    .get('/health', async (c) => {
      const dependencies = await health();
      const healthy = Object.values(dependencies).every(Boolean);
      return c.json({ status: healthy ? 'ok' : 'unhealthy', dependencies }, healthy ? 200 : 503);
    })
    .get('/eu', (c) => {
      const usuario = usuarioLogado(c);
      return usuario ? c.json(usuario) : c.json({ error: 'nao-autenticado' }, 401);
    })
    // Traefik ForwardAuth target (ADR 0011): any non-2xx response stops the request.
    .all('/acesso', async (c) => {
      const usuario = usuarioLogado(c);
      if (!usuario) return c.json({ error: 'nao-autenticado' }, 401);
      if (UUID.test(usuario.id) && (await registrarAcesso(usuario)) === 'desativado') {
        return c.json({ error: 'acesso-desativado' }, 403);
      }
      return c.body(null, 204);
    })
    .get('/', async (c) => {
      const solicitante = usuarioLogado(c);
      if (!solicitante) return c.json({ error: 'nao-autenticado' }, 401);
      const result = await listar(solicitante);
      return result.ok ? c.json(result.value) : c.json({ error: result.error }, 403);
    })
    // Internal: the gateway has no route here and always sends X-User-Id, so a request carrying
    // it came through the gateway somehow and is refused.
    .get('/contato/gestor', async (c) =>
      c.req.header('x-user-id')
        ? c.json({ error: 'nao-encontrado' }, 404)
        : c.json(await gestores()),
    )
    .get('/contato/:id', async (c) => {
      const id = c.req.param('id');
      const encontrado =
        !c.req.header('x-user-id') && UUID.test(id) ? await contato(id) : undefined;
      return encontrado ? c.json(encontrado) : c.json({ error: 'nao-encontrado' }, 404);
    })
    .post('/:id/desativar', async (c) => {
      const solicitante = usuarioLogado(c);
      if (!solicitante) return c.json({ error: 'nao-autenticado' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'usuario-nao-encontrado' }, 404);
      const result = await desativar(solicitante, id.toLowerCase());
      return result.ok
        ? c.body(null, 204)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .post('/:id/reativar', async (c) => {
      const solicitante = usuarioLogado(c);
      if (!solicitante) return c.json({ error: 'nao-autenticado' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'usuario-nao-encontrado' }, 404);
      const result = await reativar(solicitante, id.toLowerCase());
      return result.ok
        ? c.body(null, 204)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    });
