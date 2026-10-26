import type { Solicitante } from './arquivo.js';
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

/** *Enviar comprovante*: the participante sends their own comprovante, which stays a confirmar. */
export const enviar = (
  solicitante: Pick<Solicitante, 'id'>,
  pedido: PedidoDeComprovante,
  contexto: { readonly id: string; readonly agora: Date },
): ComprovanteEnviado => ({
  ...pedido,
  id: contexto.id,
  participanteId: solicitante.id,
  enviadoEm: contexto.agora,
  situacao: 'a-confirmar',
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

/** Why the gestor could not confirm a comprovante enviado. */
export type ConfirmarErro = ReceberErro | 'comprovante-ja-analisado';

/**
 * *Confirmar comprovante*: the gestor receives the pagamento por PIX with the comprovante, for the
 * valor confirmado, which may correct the valor informed. Produces *Pagamento recebido*, as when
 * the gestor receives the pagamento directly.
 */
export const confirmar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  comprovante: ComprovanteEnviado,
  valorConfirmadoEmCentavos: number,
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
  return ok({
    ...recebido.value,
    comprovante: { ...comprovante, situacao: 'confirmado', valorConfirmadoEmCentavos },
  });
};

/** Why the gestor could not recusar a comprovante enviado. */
export type RecusarErro = 'sem-permissao' | 'comprovante-ja-analisado' | 'recusa-sem-motivo';

/** *Recusar comprovante*: only the gestor, once, telling the participante the motivo. */
export const recusar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  comprovante: ComprovanteEnviado,
  motivo: string,
): Result<ComprovanteEnviado, RecusarErro> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  if (comprovante.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado');
  const informado = motivo.trim();
  if (!informado) return fail('recusa-sem-motivo');
  return ok({ ...comprovante, situacao: 'recusado', motivo: informado });
};
