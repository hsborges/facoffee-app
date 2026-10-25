import type { Solicitante } from './arquivo.js';
import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** What one participante owes of a complemento; devida like a cota, so the crédito abate it. */
export type Parte = { readonly participanteId: string; readonly valorEmCentavos: number };

/** The valor extra the gestor asks of the participantes ativos when the caixinha falls short. */
export type Complemento = {
  readonly id: string;
  readonly valorTotalEmCentavos: number;
  /** One per participante ativo at the solicitação; they sum to the valor total. */
  readonly partes: readonly Parte[];
  readonly solicitadoEm: Date;
};

/** *Complemento solicitado*, per `contracts/events/finance.top-up-requested.v1.json`. */
export type ComplementoSolicitado = Event<
  'finance.top-up-requested',
  {
    readonly topUpId: string;
    readonly totalAmountInCents: number;
    readonly shares: readonly { readonly participantId: string; readonly amountInCents: number }[];
  }
>;

/** Why a complemento was refused. */
export type SolicitarErro =
  | 'sem-permissao'
  | 'sem-participantes-ativos'
  | 'parte-menor-que-um-centavo';

/**
 * Splits `valor` in partes iguais, without considering the tipo de cota. The centavos that do not
 * divide go one each to the first participantes, so the partes always sum to `valor`.
 * ponytail: the first participantes always get the extra centavo (at most one each); rotate it if
 * anyone minds.
 */
export const dividir = (valor: number, participantes: readonly string[]): readonly Parte[] => {
  const base = Math.floor(valor / participantes.length);
  const resto = valor % participantes.length;
  return participantes.map((participanteId, i) => ({
    participanteId,
    valorEmCentavos: base + (i < resto ? 1 : 0),
  }));
};

/**
 * *Solicitar complemento*: only the gestor solicita, and the valor is divided among everyone ativo
 * at that moment, pendentes included. Who enters later owes nothing; who leaves later still owes.
 * Produces *Complemento solicitado*.
 */
export const solicitar = (
  solicitante: Pick<Solicitante, 'perfis'>,
  valorTotalEmCentavos: number,
  ativos: readonly string[],
  contexto: { readonly complementoId: string; readonly eventId: string; readonly agora: Date },
): Result<
  { readonly complemento: Complemento; readonly evento: ComplementoSolicitado },
  SolicitarErro
> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  if (ativos.length === 0) return fail('sem-participantes-ativos');
  if (valorTotalEmCentavos < ativos.length) return fail('parte-menor-que-um-centavo');
  const { complementoId, eventId, agora } = contexto;
  const partes = dividir(valorTotalEmCentavos, ativos);
  return ok({
    complemento: { id: complementoId, valorTotalEmCentavos, partes, solicitadoEm: agora },
    evento: {
      id: eventId,
      type: 'finance.top-up-requested',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: {
        topUpId: complementoId,
        totalAmountInCents: valorTotalEmCentavos,
        shares: partes.map((p) => ({
          participantId: p.participanteId,
          amountInCents: p.valorEmCentavos,
        })),
      },
    },
  });
};
