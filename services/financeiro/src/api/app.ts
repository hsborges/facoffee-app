import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Arquivo, GuardarComprovanteErro, NaoEncontrado } from '../application/arquivos.js';
import { type ArquivoInvalido, type Solicitante, TAMANHO_MAXIMO } from '../domain/arquivo.js';
import type { Result } from '../domain/result.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly guardarComprovante: (
    solicitante: Pick<Solicitante, 'perfis'>,
    participanteId: string,
    conteudo: Uint8Array,
  ) => Promise<Result<string, GuardarComprovanteErro>>;
  readonly guardarNota: (conteudo: Uint8Array) => Promise<Result<string, ArquivoInvalido>>;
  readonly baixarComprovante: (
    solicitante: Solicitante,
    id: string,
  ) => Promise<Result<Arquivo, NaoEncontrado>>;
  readonly baixarNota: (id: string) => Promise<Result<Arquivo, NaoEncontrado>>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Identity comes from the gateway in X-User-Id and X-User-Roles (ADR 0007).
const solicitante = (c: Context): Solicitante | undefined => {
  const id = c.req.header('x-user-id');
  if (!id || !UUID.test(id)) return undefined;
  return { id, perfis: (c.req.header('x-user-roles') ?? '').split(',') };
};

const STATUS_DO_ERRO = {
  'sem-permissao': 403,
  'arquivo-vazio': 400,
  'tipo-nao-aceito': 400,
  'arquivo-grande-demais': 413,
} as const;

// Room for the multipart boundaries and fields; the arquivo itself is checked in the domain.
const limite = bodyLimit({
  maxSize: TAMANHO_MAXIMO + 64 * 1024,
  onError: (c) => c.json({ error: 'arquivo-grande-demais' }, 413),
});

const formulario = async (c: Context) => {
  const campos = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const arquivo = campos.arquivo instanceof File ? campos.arquivo : undefined;
  return {
    conteudo: arquivo && new Uint8Array(await arquivo.arrayBuffer()),
    participanteId: campos.participanteId,
  };
};

const guardado = (c: Context, result: Result<string, GuardarComprovanteErro>) =>
  result.ok
    ? c.json({ id: result.value }, 201)
    : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);

const baixado = (c: Context, result: Result<Arquivo, NaoEncontrado>) =>
  result.ok
    ? c.body(result.value.conteudo as Uint8Array<ArrayBuffer>, 200, {
        'content-type': result.value.tipo,
        'x-content-type-options': 'nosniff',
      })
    : c.json({ error: 'not-found' }, 404);

/**
 * HTTP API of the Financeiro context. The gestor guarda comprovantes with
 * `POST /guardar-comprovante` and any participante guarda notas with `POST /guardar-nota`
 * (multipart, up to 5 MB, PDF, JPEG or PNG); `GET /comprovante/:id` serves only the participante
 * and the gestor, and `GET /nota/:id` any participante. Without `X-User-Id`, 401.
 * Logs every request except health probes; unhandled errors become 500.
 */
export const createApp = ({
  guardarComprovante,
  guardarNota,
  baixarComprovante,
  baixarNota,
  health,
  logger,
}: ApiDependencies) =>
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
    .post('/guardar-comprovante', limite, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const { conteudo, participanteId } = await formulario(c);
      const valido = conteudo && typeof participanteId === 'string' && UUID.test(participanteId);
      if (!valido) return c.json({ error: 'pedido-invalido' }, 400);
      return guardado(c, await guardarComprovante(quem, participanteId, conteudo));
    })
    .post('/guardar-nota', limite, async (c) => {
      if (!solicitante(c)) return c.json({ error: 'unauthorized' }, 401);
      const { conteudo } = await formulario(c);
      if (!conteudo) return c.json({ error: 'pedido-invalido' }, 400);
      return guardado(c, await guardarNota(conteudo));
    })
    .get('/comprovante/:id', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'not-found' }, 404);
      return baixado(c, await baixarComprovante(quem, id));
    })
    .get('/nota/:id', async (c) => {
      if (!solicitante(c)) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'not-found' }, 404);
      return baixado(c, await baixarNota(id));
    });
