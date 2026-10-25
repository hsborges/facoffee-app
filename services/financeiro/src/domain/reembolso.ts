import type { Solicitante } from './arquivo.js';
import type { Event } from './event.js';
import type { Gasto } from './gasto.js';
import { fail, ok, type Result } from './result.js';

/** The devolução to who paid a gasto do próprio bolso; the money of that gasto leaves the caixinha here. */
export type Reembolso = {
  readonly id: string;
  readonly gastoId: string;
  readonly feitoEm: Date;
};

/** *Reembolso feito*, per `contracts/events/finance.reimbursement-made.v1.json`. */
export type ReembolsoFeito = Event<
  'finance.reimbursement-made',
  {
    readonly reimbursementId: string;
    readonly expenseId: string;
    readonly participantId: string;
    readonly amountInCents: number;
  }
>;

/** Why a reembolso was refused. */
export type ReembolsarErro = 'sem-permissao' | 'gasto-pago-pela-caixinha';

/**
 * *Reembolsar*: only the gestor reembolsa, and only a gasto pago do próprio bolso, giving back its
 * valor total to who paid it. Produces *Reembolso feito*.
 */
export const reembolsar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  gasto: Gasto,
  contexto: { readonly reembolsoId: string; readonly eventId: string; readonly agora: Date },
): Result<{ readonly reembolso: Reembolso; readonly evento: ReembolsoFeito }, ReembolsarErro> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  if (gasto.origem !== 'proprio-bolso') return fail('gasto-pago-pela-caixinha');
  const { reembolsoId, eventId, agora } = contexto;
  return ok({
    reembolso: { id: reembolsoId, gastoId: gasto.id, feitoEm: agora },
    evento: {
      id: eventId,
      type: 'finance.reimbursement-made',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: {
        reimbursementId: reembolsoId,
        expenseId: gasto.id,
        participantId: gasto.participanteId,
        amountInCents: gasto.valorEmCentavos,
      },
    },
  });
};
