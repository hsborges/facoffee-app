import type { Solicitante } from '../domain/arquivo.js';
import {
  type ComprovanteEnviado,
  type ComprovanteErro,
  type ConfirmarErro,
  cancelar,
  confirmar,
  editar,
  enviar,
  type PedidoDeComprovante,
  type PedidoDeConfirmacao,
  type RecusarErro,
  recusar,
} from '../domain/comprovante-enviado.js';
import type { Event } from '../domain/event.js';
import type { Pagamento } from '../domain/pagamento.js';
import { fail, ok, type Result } from '../domain/result.js';
import type { Clock, SalvarPagamentoErro } from './pagamentos.js';

type JaAnalisado = 'comprovante-ja-analisado';

/** Persistence of comprovantes enviados; every change happens only while a confirmar. */
export type ComprovantesEnviados = {
  readonly buscar: (id: string) => Promise<ComprovanteEnviado | undefined>;
  /** Leitura for the gestor: the comprovantes a confirmar, oldest first. */
  readonly aConfirmar: () => Promise<readonly ComprovanteEnviado[]>;
  /** Leitura for the participante: their comprovantes, newest first. */
  readonly doParticipante: (participanteId: string) => Promise<readonly ComprovanteEnviado[]>;
  /** Saves nothing for a participante Financeiro does not know or an arquivo already sent. */
  readonly salvar: (
    comprovante: ComprovanteEnviado,
  ) => Promise<Result<void, 'participante-nao-encontrado' | 'comprovante-ja-usado'>>;
  /** Saves the edição; nothing for an arquivo of another comprovante. */
  readonly editar: (
    comprovante: ComprovanteEnviado,
  ) => Promise<Result<void, JaAnalisado | 'comprovante-ja-usado'>>;
  readonly recusar: (comprovante: ComprovanteEnviado) => Promise<Result<void, JaAnalisado>>;
  readonly remover: (id: string) => Promise<Result<void, JaAnalisado>>;
  /**
   * Saves the confirmação, the pagamento and its events (outbox) in the same transaction; nothing
   * if the arquivo changed since `comprovante` was read.
   */
  readonly confirmar: (
    comprovante: ComprovanteEnviado,
    pagamento: Pagamento,
    events: readonly Event[],
  ) => Promise<Result<void, JaAnalisado | 'comprovante-alterado' | SalvarPagamentoErro>>;
};

type ArquivoDoParticipante = (participanteId: string, id: string) => Promise<boolean>;

type NaoEncontrado = 'comprovante-enviado-nao-encontrado';

/** Why the participante could not send a comprovante. */
export type EnviarComprovanteErro =
  | 'comprovante-nao-encontrado'
  | 'participante-nao-encontrado'
  | 'comprovante-ja-usado';

/**
 * Use case: *Enviar comprovante*. The participante sends the valor pago with an arquivo they
 * guardaram for themself; it stays a confirmar and does not count as a pagamento. Gives its id.
 */
export const enviarComprovante =
  (
    comprovantes: ComprovantesEnviados,
    comprovanteDoParticipante: ArquivoDoParticipante,
    clock: Clock,
  ) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
    pedido: PedidoDeComprovante,
  ): Promise<Result<string, EnviarComprovanteErro>> => {
    if (!(await comprovanteDoParticipante(solicitante.id, pedido.comprovanteId))) {
      return fail('comprovante-nao-encontrado');
    }
    const comprovante = enviar(solicitante, pedido, { id: clock.newId(), agora: clock.now() });
    const salvo = await comprovantes.salvar(comprovante);
    return salvo.ok ? ok(comprovante.id) : salvo;
  };

/** Why the participante could not edit a comprovante enviado. */
export type EditarComprovanteErro =
  | ComprovanteErro
  | 'comprovante-nao-encontrado'
  | 'comprovante-ja-usado';

/** Use case: *Editar comprovante*, valor and arquivo, while a confirmar. */
export const editarComprovante =
  (comprovantes: ComprovantesEnviados, comprovanteDoParticipante: ArquivoDoParticipante) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
    id: string,
    pedido: PedidoDeComprovante,
  ): Promise<Result<void, EditarComprovanteErro>> => {
    const atual = await comprovantes.buscar(id);
    if (!atual) return fail('comprovante-enviado-nao-encontrado');
    const editado = editar(solicitante, atual, pedido);
    if (!editado.ok) return editado;
    if (!(await comprovanteDoParticipante(solicitante.id, pedido.comprovanteId))) {
      return fail('comprovante-nao-encontrado');
    }
    return comprovantes.editar(editado.value);
  };

/** Use case: *Cancelar comprovante*, while a confirmar; it is removed. */
export const cancelarComprovante =
  (comprovantes: ComprovantesEnviados) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
    id: string,
  ): Promise<Result<void, ComprovanteErro>> => {
    const atual = await comprovantes.buscar(id);
    if (!atual) return fail('comprovante-enviado-nao-encontrado');
    const cancelado = cancelar(solicitante, atual);
    return cancelado.ok ? comprovantes.remover(id) : cancelado;
  };

/** Why the gestor could not confirm a comprovante enviado. */
export type ConfirmarComprovanteErro = ConfirmarErro | NaoEncontrado | SalvarPagamentoErro;

/**
 * Use case: *Confirmar comprovante*. The gestor receives the pagamento with the valor confirmado,
 * once per comprovante and only for the arquivo they saw. Stores *Pagamento recebido* in the outbox
 * and gives the id of the pagamento.
 */
export const confirmarComprovante =
  (comprovantes: ComprovantesEnviados, clock: Clock) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    id: string,
    pedido: PedidoDeConfirmacao,
  ): Promise<Result<string, ConfirmarComprovanteErro>> => {
    // Before the lookup, so only the gestor learns whether a comprovante exists.
    if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
    const atual = await comprovantes.buscar(id);
    if (!atual) return fail('comprovante-enviado-nao-encontrado');
    const result = confirmar(solicitante, atual, pedido, {
      pagamentoId: clock.newId(),
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    const { comprovante, pagamento, evento } = result.value;
    const salvo = await comprovantes.confirmar(comprovante, pagamento, [evento]);
    return salvo.ok ? ok(pagamento.id) : salvo;
  };

/** Why the gestor could not recusar a comprovante enviado. */
export type RecusarComprovanteErro = RecusarErro | NaoEncontrado;

/** Use case: *Recusar comprovante*, once, with the motivo the participante sees. */
export const recusarComprovante =
  (comprovantes: ComprovantesEnviados) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    id: string,
    motivo: string,
  ): Promise<Result<void, RecusarComprovanteErro>> => {
    if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
    const atual = await comprovantes.buscar(id);
    if (!atual) return fail('comprovante-enviado-nao-encontrado');
    const recusado = recusar(solicitante, atual, motivo);
    return recusado.ok ? comprovantes.recusar(recusado.value) : recusado;
  };

/** Leitura *Comprovantes a confirmar*, oldest first; only the gestor sees it. */
export const listarComprovantesAConfirmar =
  (aConfirmar: ComprovantesEnviados['aConfirmar']) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
  ): Promise<Result<readonly ComprovanteEnviado[], 'sem-permissao'>> =>
    solicitante.perfis.includes('gestor') ? ok(await aConfirmar()) : fail('sem-permissao');

/** The comprovantes the logged-in participante sent, newest first, with the situação of each. */
export const listarMeusComprovantes =
  (doParticipante: ComprovantesEnviados['doParticipante']) =>
  (solicitante: Pick<Solicitante, 'id'>): Promise<readonly ComprovanteEnviado[]> =>
    doParticipante(solicitante.id);
