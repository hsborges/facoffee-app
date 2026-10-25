import { avisos, type Contato, type Email, type PayloadInvalido } from '../domain/aviso.js';
import type { Event } from '../domain/event.js';
import { ok, type Result } from '../domain/result.js';

/** Lists the contatos from Usuário; rejects when Usuário cannot be reached. */
export type BuscarContatos = () => Promise<readonly Contato[]>;

/** Stores the e-mails of an event for sending; inside the transaction that handles the event. */
export type Guardar = (eventoId: string, emails: readonly Email[]) => Promise<void>;

/**
 * Handler of the events Notificação consumes: stores their avisos by e-mail, to be sent apart.
 * Resolves with the participantes left without e-mail for having no contato.
 */
export const avisar =
  (buscarContatos: BuscarContatos, guardar: Guardar) =>
  async (event: Event): Promise<Result<readonly string[], PayloadInvalido>> => {
    const result = avisos(event, await buscarContatos());
    if (!result.ok) return result;
    await guardar(event.id, result.value.emails);
    return ok(result.value.semContato);
  };
