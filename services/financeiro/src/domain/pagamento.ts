import type { Solicitante } from './arquivo.js';
import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Formas do pagamento: PIX, with comprovante, or dinheiro, in mãos. */
export const FORMAS = ['pix', 'dinheiro'] as const;

/** Forma do pagamento. */
export type Forma = (typeof FORMAS)[number];

/**
 * Money the gestor received for the cotas of a participante, even when someone else paid; who
 * paid is not kept. It goes into the caixinha.
 */
export type Pagamento = {
  readonly id: string;
  readonly participanteId: string;
  readonly valorEmCentavos: number;
  readonly forma: Forma;
  /** The comprovante guardado for a pagamento por PIX; `null` in dinheiro. */
  readonly comprovanteId: string | null;
  readonly recebidoEm: Date;
};

/** What the gestor informs when receiving a pagamento. */
export type PedidoDePagamento = Omit<Pagamento, 'id' | 'recebidoEm'>;

/** *Pagamento recebido*, per `contracts/events/finance.payment-received.v1.json`. */
export type PagamentoRecebido = Event<
  'finance.payment-received',
  {
    readonly paymentId: string;
    readonly participantId: string;
    readonly amountInCents: number;
    readonly method: 'pix' | 'cash';
  }
>;

/** Why a pagamento was refused. */
export type ReceberErro = 'sem-permissao' | 'pix-sem-comprovante' | 'comprovante-so-no-pix';

const NOS_CONTRATOS = { pix: 'pix', dinheiro: 'cash' } as const;

/**
 * *Receber pagamento por PIX ou em dinheiro*: only the gestor receives pagamentos, a pagamento por
 * PIX comes with its comprovante and one in dinheiro has none. Produces *Pagamento recebido*.
 */
export const receber = (
  solicitante: Pick<Solicitante, 'perfis'>,
  pedido: PedidoDePagamento,
  contexto: { readonly pagamentoId: string; readonly eventId: string; readonly agora: Date },
): Result<{ readonly pagamento: Pagamento; readonly evento: PagamentoRecebido }, ReceberErro> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  if (pedido.forma === 'pix' && !pedido.comprovanteId) return fail('pix-sem-comprovante');
  if (pedido.forma === 'dinheiro' && pedido.comprovanteId) return fail('comprovante-so-no-pix');
  const { pagamentoId, eventId, agora } = contexto;
  return ok({
    pagamento: { ...pedido, id: pagamentoId, recebidoEm: agora },
    evento: {
      id: eventId,
      type: 'finance.payment-received',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: {
        paymentId: pagamentoId,
        participantId: pedido.participanteId,
        amountInCents: pedido.valorEmCentavos,
        method: NOS_CONTRATOS[pedido.forma],
      },
    },
  });
};
