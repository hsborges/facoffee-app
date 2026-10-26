import type { Solicitante } from './arquivo.js';
import type { Event } from './event.js';
import { type Pagamento, type PagamentoRecebido, type ReceberErro, receber } from './pagamento.js';
import { fail, ok, type Result } from './result.js';

/** Where the análise of the gestor stands: a confirmar, then confirmado or recusado, once. */
export type Analise =
  | { readonly situacao: 'a-confirmar' }
  | { readonly situacao: 'confirmado'; readonly valorConfirmadoEmCentavos: number }
  | { readonly situacao: 'recusado'; readonly motivo: string };

/**
 * A comprovante the participante sent to the gestor, with the valor pago. It counts as a pagamento
 * only once the gestor confirms it, with the valor confirmado.
 */
export type ComprovanteEnviado = {
  readonly id: string;
  readonly participanteId: string;
  /** The arquivo guardado, downloaded at `GET /comprovante/:id`. */
  readonly comprovanteId: string;
  readonly valorEmCentavos: number;
  readonly enviadoEm: Date;
} & Analise;

/** *Comprovante enviado*, per `contracts/events/finance.receipt-sent.v1.json`. */
export type ComprovanteEnviadoEvento = Event<
  'finance.receipt-sent',
  { readonly receiptId: string; readonly participantId: string; readonly amountInCents: number }
>;

/** *Comprovante recusado*, per `contracts/events/finance.receipt-rejected.v1.json`. */
export type ComprovanteRecusadoEvento = Event<
  'finance.receipt-rejected',
  {
    readonly receiptId: string;
    readonly participantId: string;
    readonly amountInCents: number;
    readonly reason: string;
  }
>;

/** What the participante informs when sending or editing a comprovante. */
export type PedidoDeComprovante = Pick<ComprovanteEnviado, 'comprovanteId' | 'valorEmCentavos'>;

/** Why the participante could not edit or cancel a comprovante enviado. */
export type ComprovanteErro = 'comprovante-enviado-nao-encontrado' | 'comprovante-ja-analisado';

// Someone else's comprovante is not found, so nobody learns it exists.
const aConfirmarDo = (
  solicitante: Pick<Solicitante, 'id'>,
  comprovante: ComprovanteEnviado,
): Result<void, ComprovanteErro> => {
  if (comprovante.participanteId !== solicitante.id) {
    return fail('comprovante-enviado-nao-encontrado');
  }
  return comprovante.situacao === 'a-confirmar' ? ok(undefined) : fail('comprovante-ja-analisado');
};

/**
 * *Enviar comprovante*: the participante sends their own comprovante, which stays a confirmar.
 * Produces *Comprovante enviado*, for the gestor to be avisado.
 */
export const enviar = (
  solicitante: Pick<Solicitante, 'id'>,
  pedido: PedidoDeComprovante,
  { id, eventId, agora }: { readonly id: string; readonly eventId: string; readonly agora: Date },
): { readonly comprovante: ComprovanteEnviado; readonly evento: ComprovanteEnviadoEvento } => ({
  comprovante: {
    ...pedido,
    id,
    participanteId: solicitante.id,
    enviadoEm: agora,
    situacao: 'a-confirmar',
  },
  evento: {
    id: eventId,
    type: 'finance.receipt-sent',
    version: 1,
    occurredAt: agora.toISOString(),
    payload: {
      receiptId: id,
      participantId: solicitante.id,
      amountInCents: pedido.valorEmCentavos,
    },
  },
});

/** *Editar comprovante*: valor and arquivo, only by its participante and while a confirmar. */
export const editar = (
  solicitante: Pick<Solicitante, 'id'>,
  comprovante: ComprovanteEnviado,
  pedido: PedidoDeComprovante,
): Result<ComprovanteEnviado, ComprovanteErro> => {
  const podeEditar = aConfirmarDo(solicitante, comprovante);
  return podeEditar.ok ? ok({ ...comprovante, ...pedido }) : podeEditar;
};

/** *Cancelar comprovante*: only by its participante and while a confirmar. */
export const cancelar = (
  solicitante: Pick<Solicitante, 'id'>,
  comprovante: ComprovanteEnviado,
): Result<void, ComprovanteErro> => aConfirmarDo(solicitante, comprovante);

/** What the gestor informs when confirming: the valor confirmado and the arquivo they saw. */
export type PedidoDeConfirmacao = {
  readonly valorConfirmadoEmCentavos: number;
  readonly comprovanteId: string;
};

/** Why the gestor could not confirm a comprovante enviado. */
export type ConfirmarErro = ReceberErro | 'comprovante-ja-analisado' | 'comprovante-alterado';

/**
 * *Confirmar comprovante*: the gestor receives the pagamento por PIX with the comprovante, for the
 * valor confirmado, which may correct the valor informed. Produces *Pagamento recebido*, as when
 * the gestor receives the pagamento directly. Refused if the participante changed the arquivo
 * since the gestor saw it.
 */
export const confirmar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  comprovante: ComprovanteEnviado,
  { valorConfirmadoEmCentavos, comprovanteId: visto }: PedidoDeConfirmacao,
  contexto: { readonly pagamentoId: string; readonly eventId: string; readonly agora: Date },
): Result<
  {
    readonly comprovante: ComprovanteEnviado;
    readonly pagamento: Pagamento;
    readonly evento: PagamentoRecebido;
  },
  ConfirmarErro
> => {
  const { participanteId, comprovanteId } = comprovante;
  const recebido = receber(
    solicitante,
    { participanteId, valorEmCentavos: valorConfirmadoEmCentavos, forma: 'pix', comprovanteId },
    contexto,
  );
  if (!recebido.ok) return recebido;
  if (comprovante.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado');
  if (comprovanteId !== visto) return fail('comprovante-alterado');
  return ok({
    ...recebido.value,
    comprovante: { ...comprovante, situacao: 'confirmado', valorConfirmadoEmCentavos },
  });
};

/** Why the gestor could not recusar a comprovante enviado. */
export type RecusarErro = 'sem-permissao' | 'comprovante-ja-analisado' | 'recusa-sem-motivo';

/**
 * *Recusar comprovante*: only the gestor, once, telling the participante the motivo. Produces
 * *Comprovante recusado*, for the participante to be avisado.
 */
export const recusar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  comprovante: ComprovanteEnviado,
  motivo: string,
  { eventId, agora }: { readonly eventId: string; readonly agora: Date },
): Result<
  { readonly comprovante: ComprovanteEnviado; readonly evento: ComprovanteRecusadoEvento },
  RecusarErro
> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  if (comprovante.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado');
  const informado = motivo.trim();
  if (!informado) return fail('recusa-sem-motivo');
  return ok({
    comprovante: { ...comprovante, situacao: 'recusado', motivo: informado },
    evento: {
      id: eventId,
      type: 'finance.receipt-rejected',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: {
        receiptId: comprovante.id,
        participantId: comprovante.participanteId,
        amountInCents: comprovante.valorEmCentavos,
        reason: informado,
      },
    },
  });
};
