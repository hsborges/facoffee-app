import {
  avisosDoEvento,
  type Contato,
  type Email,
  enderecar,
  type PayloadInvalido,
} from '../domain/aviso.js';
import type { Event } from '../domain/event.js';
import { ok, type Result } from '../domain/result.js';

/** Lists the contatos from Usuário; rejects when Usuário cannot be reached. */
export type BuscarContatos = () => Promise<readonly Contato[]>;

/** Stores the e-mails of an event for sending; inside the transaction that handles the event. */
export type Guardar = (eventoId: string, emails: readonly Email[]) => Promise<void>;

/**
 * Handler of the events Notificação consumes: stores their avisos by e-mail, to be sent apart.
 * Validates the payload before asking Usuário for the contatos. Resolves with the participantes
 * left without e-mail for having no contato.
 */
export const avisar =
  (buscarContatos: BuscarContatos, guardar: Guardar) =>
  async (event: Event): Promise<Result<readonly string[], PayloadInvalido>> => {
    const avisos = avisosDoEvento(event);
    if (!avisos.ok) return avisos;
    const { emails, semContato } = enderecar(avisos.value, await buscarContatos());
    await guardar(event.id, emails);
    return ok(semContato);
  };
