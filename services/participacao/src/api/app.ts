import { type Context, Hono } from 'hono';
import {
  type EntrarErro,
  type NaoParticipando,
  TIPOS_DE_COTA,
  type TipoDeCota,
} from '../domain/participante.js';
import type { Result } from '../domain/result.js';
import type { DefinirValorErro, ValorDaCota } from '../domain/tipo-de-cota.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly pedirEntrada: (id: string, tipoDeCota: TipoDeCota) => Promise<Result<void, EntrarErro>>;
  readonly trocarTipo: (
    id: string,
    tipoDeCota: TipoDeCota,
  ) => Promise<Result<void, NaoParticipando>>;
  readonly pedirSaida: (id: string) => Promise<Result<void, NaoParticipando>>;
  readonly definirValor: (
    solicitante: { readonly perfis: readonly string[] },
    valor: ValorDaCota,
  ) => Promise<Result<void, DefinirValorErro>>;
  readonly iniciarAno: () => Promise<{ readonly valoresRepetidos: number }>;
  readonly iniciarMes: () => Promise<{
    readonly cotasDevidas: number;
    readonly semValorDaCota: number;
  }>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isTipoDeCota = (valor: unknown): valor is TipoDeCota =>
  TIPOS_DE_COTA.includes(valor as TipoDeCota);

// The id becomes participantId, a uuid in the event contracts.
const idLogado = (c: Context) => {
  const id = c.req.header('x-user-id');
  return id && UUID.test(id) ? id : undefined;
};

const corpo = async (c: Context): Promise<Record<string, unknown>> =>
  ((await c.req.json().catch(() => undefined)) as Record<string, unknown> | undefined) ?? {};

// Bounded by the postgres integer columns.
const inteiroPositivo = (valor: unknown): valor is number =>
  Number.isInteger(valor) && (valor as number) > 0 && (valor as number) <= 2_147_483_647;

const STATUS_DO_ERRO = {
  'sem-permissao': 403,
  'ano-passado': 400,
  'valor-ja-definido': 409,
} as const;

/**
 * HTTP API of the Participação context, for the logged-in person: `POST /entrar`,
 * `POST /trocar-tipo-de-cota`, `POST /sair` and, for the gestor, `POST /definir-valor-da-cota`.
 * Identity comes from the gateway in `X-User-Id` and `X-User-Roles` (ADR 0007); without it, 401.
 * `POST /iniciar-ano` and `POST /iniciar-mes` are the agendador's triggers, on the internal
 * network only: the gateway does not route them (ADR 0017).
 * Logs every request except health probes; unhandled errors become 500.
 */
export const createApp = ({
  pedirEntrada,
  trocarTipo,
  pedirSaida,
  definirValor,
  iniciarAno,
  iniciarMes,
  health,
  logger,
}: ApiDependencies) =>
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
    .post('/entrar', async (c) => {
      const id = idLogado(c);
      if (!id) return c.json({ error: 'unauthorized' }, 401);
      const { tipoDeCota } = await corpo(c);
      if (!isTipoDeCota(tipoDeCota)) return c.json({ error: 'tipo-de-cota-invalido' }, 400);
      const result = await pedirEntrada(id, tipoDeCota);
      return result.ok ? c.body(null, 204) : c.json({ error: result.error }, 409);
    })
    .post('/trocar-tipo-de-cota', async (c) => {
      const id = idLogado(c);
      if (!id) return c.json({ error: 'unauthorized' }, 401);
      const { tipoDeCota } = await corpo(c);
      if (!isTipoDeCota(tipoDeCota)) return c.json({ error: 'tipo-de-cota-invalido' }, 400);
      const result = await trocarTipo(id, tipoDeCota);
      return result.ok ? c.body(null, 204) : c.json({ error: result.error }, 409);
    })
    .post('/sair', async (c) => {
      const id = idLogado(c);
      if (!id) return c.json({ error: 'unauthorized' }, 401);
      const result = await pedirSaida(id);
      return result.ok ? c.body(null, 204) : c.json({ error: result.error }, 409);
    })
    .post('/definir-valor-da-cota', async (c) => {
      if (!idLogado(c)) return c.json({ error: 'unauthorized' }, 401);
      const { tipoDeCota, ano, valorEmCentavos } = await corpo(c);
      const valido =
        isTipoDeCota(tipoDeCota) && inteiroPositivo(ano) && inteiroPositivo(valorEmCentavos);
      if (!valido) return c.json({ error: 'pedido-invalido' }, 400);
      const perfis = (c.req.header('x-user-roles') ?? '').split(',');
      const result = await definirValor({ perfis }, { tipoDeCota, ano, valorEmCentavos });
      return result.ok
        ? c.body(null, 204)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .post('/iniciar-ano', async (c) => c.json(await iniciarAno()))
    .post('/iniciar-mes', async (c) => c.json(await iniciarMes()));
