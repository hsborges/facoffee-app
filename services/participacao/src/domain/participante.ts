import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** The tipos de cota a participante may choose: *Só café* or *Completa*. */
export const TIPOS_DE_COTA = ['so-cafe', 'completa'] as const;

/** Modality chosen by the participante; defines what they may consume in the copa. */
export type TipoDeCota = (typeof TIPOS_DE_COTA)[number];

/** Participante in Participação: whether the person participates and with which tipo de cota. */
export type Participante = {
  readonly id: string;
  readonly tipoDeCota: TipoDeCota;
  readonly participando: boolean;
};

/** *Participante entrou*, per `contracts/events/participation.participant-joined.v1.json`. */
export type ParticipanteEntrou = Event<
  'participation.participant-joined',
  { readonly participantId: string }
>;

/** Why an entrada was refused. */
export type EntrarErro = 'ja-participando';

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
    participante: { ...pedido, participando: true },
    evento: {
      id: eventId,
      type: 'participation.participant-joined',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: { participantId: pedido.id },
    },
  });
};
