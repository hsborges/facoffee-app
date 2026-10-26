import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Arquivo, GuardarComprovanteErro, NaoEncontrado } from '../application/arquivos.js';
import type {
  ConfirmarComprovanteErro,
  EditarComprovanteErro,
  EnviarComprovanteErro,
  RecusarComprovanteErro,
} from '../application/comprovantes-enviados.js';
import type { Pendente } from '../application/credito.js';
import type { GastoListado, RegistrarGastoErro } from '../application/gastos.js';
import type { ReceberPagamentoErro } from '../application/pagamentos.js';
import type { ReembolsarGastoErro } from '../application/reembolsos.js';
import { type ArquivoInvalido, type Solicitante, TAMANHO_MAXIMO } from '../domain/arquivo.js';
import type { Caixinha, CaixinhaDoMes, Mes } from '../domain/caixinha.js';
import type { SolicitarErro } from '../domain/complemento.js';
import type {
  ComprovanteEnviado,
  ComprovanteErro,
  PedidoDeComprovante,
  PedidoDeConfirmacao,
} from '../domain/comprovante-enviado.js';
import type { MinhaSituacao, Situacao } from '../domain/credito.js';
import {
  ORIGENS,
  type Origem,
  type PedidoDeGasto,
  TIPOS_DE_GASTO,
  type TipoDeGasto,
} from '../domain/gasto.js';
import { FORMAS, type Forma, type PedidoDePagamento } from '../domain/pagamento.js';
import type { Result } from '../domain/result.js';
import type { Logger } from '../infra/logger.js';

/** Use cases and infrastructure the HTTP API calls; injected so tests can replace them. */
export type ApiDependencies = {
  readonly guardarComprovante: (
    solicitante: Solicitante,
    participanteId: string,
    conteudo: Uint8Array,
  ) => Promise<Result<string, GuardarComprovanteErro>>;
  readonly guardarNota: (
    solicitante: Pick<Solicitante, 'id'>,
    conteudo: Uint8Array,
  ) => Promise<Result<string, ArquivoInvalido>>;
  readonly baixarComprovante: (
    solicitante: Solicitante,
    id: string,
  ) => Promise<Result<Arquivo, NaoEncontrado>>;
  readonly baixarNota: (id: string) => Promise<Result<Arquivo, NaoEncontrado>>;
  readonly receberPagamento: (
    solicitante: Pick<Solicitante, 'perfis'>,
    pedido: PedidoDePagamento,
  ) => Promise<Result<string, ReceberPagamentoErro>>;
  readonly enviarComprovante: (
    solicitante: Pick<Solicitante, 'id'>,
    pedido: PedidoDeComprovante,
  ) => Promise<Result<string, EnviarComprovanteErro>>;
  readonly editarComprovante: (
    solicitante: Pick<Solicitante, 'id'>,
    id: string,
    pedido: PedidoDeComprovante,
  ) => Promise<Result<void, EditarComprovanteErro>>;
  readonly cancelarComprovante: (
    solicitante: Pick<Solicitante, 'id'>,
    id: string,
  ) => Promise<Result<void, ComprovanteErro>>;
  readonly confirmarComprovante: (
    solicitante: Pick<Solicitante, 'perfis'>,
    id: string,
    pedido: PedidoDeConfirmacao,
  ) => Promise<Result<string, ConfirmarComprovanteErro>>;
  readonly recusarComprovante: (
    solicitante: Pick<Solicitante, 'perfis'>,
    id: string,
    motivo: string,
  ) => Promise<Result<void, RecusarComprovanteErro>>;
  readonly listarComprovantesAConfirmar: (
    solicitante: Pick<Solicitante, 'perfis'>,
  ) => Promise<Result<readonly ComprovanteEnviado[], 'sem-permissao'>>;
  readonly listarMeusComprovantes: (
    solicitante: Pick<Solicitante, 'id'>,
  ) => Promise<readonly ComprovanteEnviado[]>;
  readonly registrarGasto: (
    solicitante: Pick<Solicitante, 'id'>,
    pedido: PedidoDeGasto,
  ) => Promise<Result<string, RegistrarGastoErro>>;
  readonly reembolsarGasto: (
    solicitante: Pick<Solicitante, 'perfis'>,
    gastoId: string,
  ) => Promise<Result<string, ReembolsarGastoErro>>;
  readonly solicitarComplemento: (
    solicitante: Pick<Solicitante, 'perfis'>,
    valorTotalEmCentavos: number,
  ) => Promise<Result<string, SolicitarErro>>;
  readonly consultarCaixinha: () => Promise<Caixinha>;
  readonly consultarCaixinhaDoMes: (mes: Mes) => Promise<CaixinhaDoMes>;
  readonly listarGastos: (
    solicitante: Pick<Solicitante, 'perfis'>,
  ) => Promise<Result<readonly GastoListado[], 'sem-permissao'>>;
  readonly listarCreditoEPendentes: (
    solicitante: Pick<Solicitante, 'perfis'>,
  ) => Promise<Result<readonly Situacao[], 'sem-permissao'>>;
  readonly consultarCreditoEPendente: (
    solicitante: Pick<Solicitante, 'id'>,
  ) => Promise<Result<MinhaSituacao, 'participante-nao-encontrado'>>;
  readonly listarPendentes: () => Promise<readonly Pendente[]>;
  readonly health: () => Promise<Readonly<Record<string, boolean>>>;
  readonly logger: Logger;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  'pix-sem-comprovante': 400,
  'comprovante-so-no-pix': 400,
  'comprovante-nao-encontrado': 404,
  'participante-nao-encontrado': 404,
  'comprovante-ja-usado': 409,
  'comprovante-enviado-nao-encontrado': 404,
  'comprovante-ja-analisado': 409,
  'comprovante-alterado': 409,
  'recusa-sem-motivo': 400,
  'nota-nao-encontrada': 404,
  'nota-ja-usada': 409,
  'gasto-nao-encontrado': 404,
  'gasto-pago-pela-caixinha': 409,
  'gasto-ja-reembolsado': 409,
  'sem-participantes-ativos': 409,
  'parte-menor-que-um-centavo': 409,
} as const;

// Bounded by the postgres integer column.
const inteiroPositivo = (valor: unknown): valor is number =>
  Number.isInteger(valor) && (valor as number) > 0 && (valor as number) <= 2_147_483_647;

const pedidoDePagamento = async (c: Context): Promise<PedidoDePagamento | undefined> => {
  const corpo = (await c.req.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  const { participanteId, valorEmCentavos, forma, comprovanteId = null } = corpo ?? {};
  const valido =
    typeof participanteId === 'string' &&
    UUID.test(participanteId) &&
    inteiroPositivo(valorEmCentavos) &&
    FORMAS.includes(forma as Forma) &&
    (comprovanteId === null || (typeof comprovanteId === 'string' && UUID.test(comprovanteId)));
  return valido
    ? {
        participanteId: participanteId.toLowerCase(),
        valorEmCentavos,
        forma: forma as Forma,
        comprovanteId: comprovanteId?.toLowerCase() ?? null,
      }
    : undefined;
};

const corpoJson = async (c: Context) =>
  (await c.req.json().catch(() => undefined)) as Record<string, unknown> | undefined;

const pedidoDeComprovante = async (c: Context): Promise<PedidoDeComprovante | undefined> => {
  const { valorEmCentavos, comprovanteId } = (await corpoJson(c)) ?? {};
  return inteiroPositivo(valorEmCentavos) &&
    typeof comprovanteId === 'string' &&
    UUID.test(comprovanteId)
    ? { valorEmCentavos, comprovanteId: comprovanteId.toLowerCase() }
    : undefined;
};

const MOTIVO_MAXIMO = 500;

const pedidoDeGasto = async (c: Context): Promise<PedidoDeGasto | undefined> => {
  const corpo = (await c.req.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  const { valorEmCentavos, origem, tipo, notaId } = corpo ?? {};
  const valido =
    inteiroPositivo(valorEmCentavos) &&
    ORIGENS.includes(origem as Origem) &&
    TIPOS_DE_GASTO.includes(tipo as TipoDeGasto) &&
    typeof notaId === 'string' &&
    UUID.test(notaId);
  return valido
    ? {
        valorEmCentavos,
        origem: origem as Origem,
        tipo: tipo as TipoDeGasto,
        notaId: notaId.toLowerCase(),
      }
    : undefined;
};

// Room for the multipart boundaries and fields; the arquivo itself is checked in the domain.
const limite = bodyLimit({
  maxSize: TAMANHO_MAXIMO + 64 * 1024,
  onError: (c) => c.json({ error: 'arquivo-grande-demais' }, 413),
});

// A pedido de pagamento or de gasto is a few fields; anything bigger is refused before being read.
const limiteDoPedido = bodyLimit({
  maxSize: 4 * 1024,
  onError: (c) => c.json({ error: 'pedido-invalido' }, 400),
});

const formulario = async (c: Context) => {
  const campos = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const arquivo = campos.arquivo instanceof File ? campos.arquivo : undefined;
  return {
    conteudo: arquivo && new Uint8Array(await arquivo.arrayBuffer()),
    participanteId: campos.participanteId,
  };
};

const criado = (c: Context, result: Result<string, keyof typeof STATUS_DO_ERRO>) =>
  result.ok
    ? c.json({ id: result.value }, 201)
    : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);

const feito = (c: Context, result: Result<void, keyof typeof STATUS_DO_ERRO>) =>
  result.ok ? c.body(null, 204) : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);

const baixado = (c: Context, result: Result<Arquivo, NaoEncontrado>) =>
  result.ok
    ? c.body(result.value.conteudo as Uint8Array<ArrayBuffer>, 200, {
        'content-type': result.value.tipo,
        'x-content-type-options': 'nosniff',
      })
    : c.json({ error: 'not-found' }, 404);

/**
 * HTTP API of the Financeiro context. The gestor, or the participante for themself, guarda
 * comprovantes with `POST /guardar-comprovante` and any participante guarda notas with
 * `POST /guardar-nota` (multipart, up to 5 MB, PDF, JPEG or PNG); `GET /comprovante/:id` serves only
 * the participante and the gestor, and `GET /nota/:id` any participante. The gestor receives
 * pagamentos with `POST /receber-pagamento` (JSON; a pagamento por PIX references its comprovante).
 * The participante sends a comprovante with `POST /enviar-comprovante` (JSON, the valor and the
 * comprovante guardado) and, while a confirmar, edits or cancels it with
 * `POST /comprovante-enviado/:id/editar` and `/cancelar`; the gestor confirms it (receiving the
 * pagamento, for the arquivo they saw) or recusa it with `/confirmar` and `/recusar`. Leituras:
 * `GET /comprovante-enviado`, the comprovantes a confirmar, only for the gestor;
 * `GET /comprovante-enviado/eu`, the participante's own, with the situação of each. Any
 * participante registers a gasto with `POST /registrar-gasto` (JSON, with its tipo and referencing a
 * nota they guardaram).
 * The gestor reembolsa a gasto pago do próprio bolso with `POST /gasto/:id/reembolsar` and
 * solicita a complemento with `POST /solicitar-complemento` (JSON, the valor total).
 * Leituras *Saldo da caixinha* and *Gastos do ano anterior*: `GET /caixinha`, for any participante.
 * Leitura *Caixinha do mês*: `GET /caixinha/:mes` (`AAAA-MM`), for any participante.
 * Leitura *Gastos*: `GET /gasto`, every gasto with whether it was reembolsado, only for the gestor.
 * Leitura *Crédito e pendentes*: `GET /participante` lists every participante, only for the
 * gestor; `GET /participante/eu` gives the logged-in participante their own, with their cotas and
 * partes de complementos.
 * `GET /pendente` is internal, for Notificação to lembrar the pendentes, and kept out of the
 * gateway (ADR 0027): it answers 404 to any request with `X-User-Id`, which the gateway always sends.
 * Elsewhere, without `X-User-Id`, 401.
 * Logs every request except health probes; unhandled errors become 500.
 */
export const createApp = ({
  guardarComprovante,
  guardarNota,
  baixarComprovante,
  baixarNota,
  receberPagamento,
  enviarComprovante,
  editarComprovante,
  cancelarComprovante,
  confirmarComprovante,
  recusarComprovante,
  listarComprovantesAConfirmar,
  listarMeusComprovantes,
  registrarGasto,
  reembolsarGasto,
  solicitarComplemento,
  consultarCaixinha,
  consultarCaixinhaDoMes,
  listarGastos,
  listarCreditoEPendentes,
  consultarCreditoEPendente,
  listarPendentes,
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
      return criado(c, await guardarComprovante(quem, participanteId.toLowerCase(), conteudo));
    })
    .post('/guardar-nota', limite, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const { conteudo } = await formulario(c);
      if (!conteudo) return c.json({ error: 'pedido-invalido' }, 400);
      return criado(c, await guardarNota(quem, conteudo));
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
    })
    .post('/receber-pagamento', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const pedido = await pedidoDePagamento(c);
      if (!pedido) return c.json({ error: 'pedido-invalido' }, 400);
      return criado(c, await receberPagamento(quem, pedido));
    })
    .post('/enviar-comprovante', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const pedido = await pedidoDeComprovante(c);
      if (!pedido) return c.json({ error: 'pedido-invalido' }, 400);
      return criado(c, await enviarComprovante(quem, pedido));
    })
    .get('/comprovante-enviado', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const result = await listarComprovantesAConfirmar(quem);
      return result.ok
        ? c.json(result.value)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .get('/comprovante-enviado/eu', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      return c.json(await listarMeusComprovantes(quem));
    })
    .post('/comprovante-enviado/:id/editar', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'comprovante-enviado-nao-encontrado' }, 404);
      const pedido = await pedidoDeComprovante(c);
      if (!pedido) return c.json({ error: 'pedido-invalido' }, 400);
      return feito(c, await editarComprovante(quem, id.toLowerCase(), pedido));
    })
    .post('/comprovante-enviado/:id/cancelar', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'comprovante-enviado-nao-encontrado' }, 404);
      return feito(c, await cancelarComprovante(quem, id.toLowerCase()));
    })
    .post('/comprovante-enviado/:id/confirmar', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'comprovante-enviado-nao-encontrado' }, 404);
      const pedido = await pedidoDeComprovante(c);
      if (!pedido) return c.json({ error: 'pedido-invalido' }, 400);
      const { valorEmCentavos: valorConfirmadoEmCentavos, comprovanteId } = pedido;
      return criado(
        c,
        await confirmarComprovante(quem, id.toLowerCase(), {
          valorConfirmadoEmCentavos,
          comprovanteId,
        }),
      );
    })
    .post('/comprovante-enviado/:id/recusar', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'comprovante-enviado-nao-encontrado' }, 404);
      const motivo = (await corpoJson(c))?.motivo;
      if (typeof motivo !== 'string' || motivo.length > MOTIVO_MAXIMO) {
        return c.json({ error: 'pedido-invalido' }, 400);
      }
      return feito(c, await recusarComprovante(quem, id.toLowerCase(), motivo));
    })
    .post('/registrar-gasto', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const pedido = await pedidoDeGasto(c);
      if (!pedido) return c.json({ error: 'pedido-invalido' }, 400);
      return criado(c, await registrarGasto(quem, pedido));
    })
    .post('/gasto/:id/reembolsar', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const id = c.req.param('id');
      if (!UUID.test(id)) return c.json({ error: 'gasto-nao-encontrado' }, 404);
      return criado(c, await reembolsarGasto(quem, id.toLowerCase()));
    })
    .post('/solicitar-complemento', limiteDoPedido, async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const corpo = (await c.req.json().catch(() => undefined)) as { valorEmCentavos?: unknown };
      const valor = corpo?.valorEmCentavos;
      if (!inteiroPositivo(valor)) return c.json({ error: 'pedido-invalido' }, 400);
      return criado(c, await solicitarComplemento(quem, valor));
    })
    .get('/caixinha', async (c) => {
      if (!solicitante(c)) return c.json({ error: 'unauthorized' }, 401);
      return c.json(await consultarCaixinha());
    })
    .get('/caixinha/:mes', async (c) => {
      if (!solicitante(c)) return c.json({ error: 'unauthorized' }, 401);
      const mes = c.req.param('mes');
      if (!MES.test(mes)) return c.json({ error: 'not-found' }, 404);
      return c.json(await consultarCaixinhaDoMes(mes));
    })
    .get('/gasto', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const result = await listarGastos(quem);
      return result.ok
        ? c.json(result.value)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .get('/participante', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const result = await listarCreditoEPendentes(quem);
      return result.ok
        ? c.json(result.value)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .get('/participante/eu', async (c) => {
      const quem = solicitante(c);
      if (!quem) return c.json({ error: 'unauthorized' }, 401);
      const result = await consultarCreditoEPendente(quem);
      return result.ok
        ? c.json(result.value)
        : c.json({ error: result.error }, STATUS_DO_ERRO[result.error]);
    })
    .get('/pendente', async (c) =>
      c.req.header('x-user-id')
        ? c.json({ error: 'not-found' }, 404)
        : c.json(await listarPendentes()),
    );
