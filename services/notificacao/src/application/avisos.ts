import {
  type Avisos,
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

/** Finds the contatos of the gestores in Usuário; rejects when Usuário cannot be reached. */
export type BuscarGestores = () => Promise<readonly Contato[]>;

/** Stores the e-mails of an event for sending; inside the transaction that handles the event. */
export type Guardar = (eventoId: string, emails: readonly Email[]) => Promise<void>;

/**
 * Handler of the events Notificação consumes: stores their avisos by e-mail, to be sent apart.
 * Validates the payload before asking Usuário for the contato of each participante and, only for
 * an aviso to the gestores, for the gestores. Resolves with who was left without e-mail.
 */
export const avisar =
  (buscarContato: BuscarContato, buscarGestores: BuscarGestores, guardar: Guardar) =>
  async (event: Event): Promise<Result<Omit<Avisos, 'emails'>, PayloadInvalido>> => {
    const avisos = avisosDoEvento(event);
    if (!avisos.ok) return avisos;
    const ids = [...new Set(avisos.value.map((a) => a.participanteId))];
    const [contatos, gestores] = await Promise.all([
      Promise.all(ids.map(buscarContato)).then((lista) =>
        lista.filter((c): c is Contato => c !== undefined),
      ),
      avisos.value.some((a) => 'aosGestores' in a) ? buscarGestores() : [],
    ]);
    const { emails, ...semEmail } = enderecar(avisos.value, contatos, gestores);
    await guardar(event.id, emails);
    return ok(semEmail);
  };
