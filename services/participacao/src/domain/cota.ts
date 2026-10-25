import type { Mes } from './calendario.js';
import type { Event } from './event.js';
import {
  type NaoParticipando,
  type Participante,
  type TipoDeCota,
  tipoDeCotaNoMes,
} from './participante.js';
import { fail, ok, type Result } from './result.js';
import { NOS_CONTRATOS, type ValorDaCota } from './tipo-de-cota.js';

/** Cota: what the participante owes for `mes`; once devida, it never changes. */
export type Cota = {
  readonly participanteId: string;
  readonly mes: Mes;
  readonly tipoDeCota: TipoDeCota;
  readonly valorEmCentavos: number;
};

/** *Cota devida*, per `contracts/events/participation.contribution-due.v1.json`. */
export type CotaDevida = Event<
  'participation.contribution-due',
  {
    readonly participantId: string;
    readonly month: Mes;
    readonly contributionType: 'coffee-only' | 'full';
    readonly amountInCents: number;
  }
>;

/** Why a cota could not become devida. */
export type DeverCotaErro = NaoParticipando | 'valor-nao-definido';

/**
 * *Todo início de mês*: the participante owes the cota of `mes`, with the valor of their tipo de
 * cota in that month, and *Cota devida* is produced. `valores` are the valores da cota known.
 */
export const deverCota = (
  participante: Participante,
  mes: Mes,
  valores: readonly ValorDaCota[],
  contexto: { readonly eventId: string; readonly agora: Date },
): Result<{ readonly cota: Cota; readonly evento: CotaDevida }, DeverCotaErro> => {
  if (!participante.participando) return fail('nao-participando');
  const tipoDeCota = tipoDeCotaNoMes(participante, mes);
  const ano = Number(mes.slice(0, 4));
  const valor = valores.find((v) => v.tipoDeCota === tipoDeCota && v.ano === ano);
  if (!valor) return fail('valor-nao-definido');
  return ok({
    cota: {
      participanteId: participante.id,
      mes,
      tipoDeCota,
      valorEmCentavos: valor.valorEmCentavos,
    },
    evento: {
      id: contexto.eventId,
      type: 'participation.contribution-due',
      version: 1,
      occurredAt: contexto.agora.toISOString(),
      payload: {
        participantId: participante.id,
        month: mes,
        contributionType: NOS_CONTRATOS[tipoDeCota],
        amountInCents: valor.valorEmCentavos,
      },
    },
  });
};
