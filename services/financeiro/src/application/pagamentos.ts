import type { Solicitante } from '../domain/arquivo.js';
import type { Event } from '../domain/event.js';
import {
  type Pagamento,
  type PedidoDePagamento,
  type ReceberErro,
  receber,
} from '../domain/pagamento.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Why a pagamento was not saved. */
export type SalvarPagamentoErro = 'participante-nao-encontrado' | 'comprovante-ja-usado';

/** Persistence of pagamentos. */
export type Pagamentos = {
  /**
   * Persists the pagamento and its events (outbox) in the same transaction. Saves nothing for a
   * participante Financeiro does not know or a comprovante of another pagamento.
   */
  readonly salvar: (
    pagamento: Pagamento,
    events: readonly Event[],
  ) => Promise<Result<void, SalvarPagamentoErro>>;
};

/** Source of time and ids, kept out of the domain so tests are deterministic. */
export type Clock = { readonly now: () => Date; readonly newId: () => string };

/** Why the gestor could not receive a pagamento. */
export type ReceberPagamentoErro = ReceberErro | 'comprovante-nao-encontrado' | SalvarPagamentoErro;

/**
 * Use case: *Receber pagamento por PIX ou em dinheiro*; the comprovante of a pagamento por PIX
 * must have been guardado for the same participante. Stores *Pagamento recebido* in the outbox
 * and gives the id of the pagamento.
 */
export const receberPagamento =
  (
    pagamentos: Pagamentos,
    comprovanteDoParticipante: (participanteId: string, id: string) => Promise<boolean>,
    clock: Clock,
  ) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    pedido: PedidoDePagamento,
  ): Promise<Result<string, ReceberPagamentoErro>> => {
    const result = receber(solicitante, pedido, {
      pagamentoId: clock.newId(),
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    const { pagamento, evento } = result.value;
    const { comprovanteId, participanteId } = pagamento;
    if (comprovanteId && !(await comprovanteDoParticipante(participanteId, comprovanteId))) {
      return fail('comprovante-nao-encontrado');
    }
    const salvo = await pagamentos.salvar(pagamento, [evento]);
    return salvo.ok ? ok(pagamento.id) : salvo;
  };
