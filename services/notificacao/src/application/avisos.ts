import {
  avisosDoEvento,
  type Contato,
  type Email,
  enderecar,
  type PayloadInvalido,
} from '../domain/aviso.js';
import type { Event } from '../domain/event.js';
import { ok, type Result } from '../domain/result.js';

/** Finds the contato of a participante in Usuário; rejects when Usuário cannot be reached. */
export type BuscarContato = (id: string) => Promise<Contato | undefined>;

/** Stores the e-mails of an event for sending; inside the transaction that handles the event. */
export type Guardar = (eventoId: string, emails: readonly Email[]) => Promise<void>;

/**
 * Handler of the events Notificação consumes: stores their avisos by e-mail, to be sent apart.
 * Validates the payload before asking Usuário for the contato of each participante. Resolves
 * with the participantes left without e-mail for having no contato.
 */
export const avisar =
  (buscarContato: BuscarContato, guardar: Guardar) =>
  async (event: Event): Promise<Result<readonly string[], PayloadInvalido>> => {
    const avisos = avisosDoEvento(event);
    if (!avisos.ok) return avisos;
    const ids = [...new Set(avisos.value.map((a) => a.participanteId))];
    const contatos = (await Promise.all(ids.map(buscarContato))).filter(
      (c): c is Contato => c !== undefined,
    );
    const { emails, semContato } = enderecar(avisos.value, contatos);
    await guardar(event.id, emails);
    return ok(semContato);
  };
