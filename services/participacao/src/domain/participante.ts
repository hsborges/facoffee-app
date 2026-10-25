import { type Mes, mesDe, mesSeguinte } from './calendario.js';
import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** The tipos de cota a participante may choose: *Só café* or *Completa*. */
export const TIPOS_DE_COTA = ['so-cafe', 'completa'] as const;

/** Modality chosen by the participante; defines what they may consume in the copa. */
export type TipoDeCota = (typeof TIPOS_DE_COTA)[number];

/** A troca de tipo de cota waiting for the month it takes effect. */
export type Troca = { readonly tipoDeCota: TipoDeCota; readonly aPartirDe: Mes };

/**
 * Participante in Participação: whether the person participates and with which tipo de cota.
 * `troca` is a troca de tipo de cota that only takes effect in `troca.aPartirDe`.
 */
export type Participante = {
  readonly id: string;
  readonly tipoDeCota: TipoDeCota;
  readonly participando: boolean;
  readonly troca: Troca | null;
};

/** *Participante entrou*, per `contracts/events/participation.participant-joined.v1.json`. */
export type ParticipanteEntrou = Event<
  'participation.participant-joined',
  { readonly participantId: string }
>;

/** *Participante saiu*, per `contracts/events/participation.participant-left.v1.json`. */
export type ParticipanteSaiu = Event<
  'participation.participant-left',
  { readonly participantId: string }
>;

/** Why an entrada was refused. */
export type EntrarErro = 'ja-participando';

/** Why a troca de tipo de cota or a saída was refused. */
export type NaoParticipando = 'nao-participando';

/**
 * *Pedir entrada e escolher tipo de cota*: the person starts participating and
 * *Participante entrou* is produced. Returning after leaving is entering again.
 * `atual` is the participante as last saved, if the person ever participated.
 */
export const entrar = (
  atual: Participante | undefined,
  pedido: Pick<Participante, 'id' | 'tipoDeCota'>,
  contexto: { readonly eventId: string; readonly agora: Date },
): Result<
  { readonly participante: Participante; readonly evento: ParticipanteEntrou },
  EntrarErro
> => {
  if (atual?.participando) return fail('ja-participando');
  const { eventId, agora } = contexto;
  return ok({
    participante: { ...pedido, participando: true, troca: null },
    evento: {
      id: eventId,
      type: 'participation.participant-joined',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: { participantId: pedido.id },
    },
  });
};

/** The tipo de cota of the participante in `mes`, counting a troca that already took effect. */
export const tipoDeCotaNoMes = (participante: Participante, mes: Mes): TipoDeCota =>
  participante.troca && mes >= participante.troca.aPartirDe
    ? participante.troca.tipoDeCota
    : participante.tipoDeCota;

/**
 * The participante as seen in `mes`: the tipo de cota in effect, and the troca only while it still
 * waits for its month and the person participates (entering again drops it).
 */
export const participanteNoMes = (participante: Participante, mes: Mes): Participante => {
  const { troca, participando } = participante;
  return {
    ...participante,
    tipoDeCota: tipoDeCotaNoMes(participante, mes),
    troca: troca && participando && mes < troca.aPartirDe ? troca : null,
  };
};

/**
 * *Trocar tipo de cota*: the new tipo only takes effect in the month after `agora`; the current
 * month keeps its tipo. A new troca replaces a pending one, and asking for the current tipo
 * cancels it. *Tipo de cota trocado* is internal, so no event is produced.
 */
export const trocarTipoDeCota = (
  atual: Participante | undefined,
  tipoDeCota: TipoDeCota,
  agora: Date,
): Result<Participante, NaoParticipando> => {
  if (!atual?.participando) return fail('nao-participando');
  const mes = mesDe(agora);
  const vigente = tipoDeCotaNoMes(atual, mes);
  return ok({
    ...atual,
    tipoDeCota: vigente,
    troca: vigente === tipoDeCota ? null : { tipoDeCota, aPartirDe: mesSeguinte(mes) },
  });
};

/**
 * *Pedir saída*, also the outcome of an access deactivated: the participação ends and
 * *Participante saiu* is produced. Whoever is not participando cannot leave.
 */
export const sair = (
  atual: Participante | undefined,
  contexto: { readonly eventId: string; readonly agora: Date },
): Result<
  { readonly participante: Participante; readonly evento: ParticipanteSaiu },
  NaoParticipando
> => {
  if (!atual?.participando) return fail('nao-participando');
  const { eventId, agora } = contexto;
  return ok({
    participante: { ...atual, participando: false },
    evento: {
      id: eventId,
      type: 'participation.participant-left',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: { participantId: atual.id },
    },
  });
};
