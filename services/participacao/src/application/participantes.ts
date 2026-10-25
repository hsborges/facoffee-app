import type { Event } from '../domain/event.js';
import {
  type EntrarErro,
  entrar,
  type Participante,
  type TipoDeCota,
} from '../domain/participante.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Persistence of participantes. */
export type Repository = {
  readonly buscar: (id: string) => Promise<Participante | undefined>;
  /**
   * Persists the entrada and its events (outbox) in the same transaction, unless the person is
   * already participando; resolves `false` then, without saving anything.
   */
  readonly salvarEntrada: (
    participante: Participante,
    events: readonly Event[],
  ) => Promise<boolean>;
};

/** Source of time and ids, kept out of the domain so tests are deterministic. */
export type Clock = { readonly now: () => Date; readonly newId: () => string };

/** Use case: *Pedir entrada e escolher tipo de cota*; stores *Participante entrou* in the outbox. */
export const pedirEntrada =
  (repository: Repository, clock: Clock) =>
  async (id: string, tipoDeCota: TipoDeCota): Promise<Result<void, EntrarErro>> => {
    const result = entrar(
      await repository.buscar(id),
      { id, tipoDeCota },
      { eventId: clock.newId(), agora: clock.now() },
    );
    if (!result.ok) return result;
    const salvo = await repository.salvarEntrada(result.value.participante, [result.value.evento]);
    return salvo ? ok(undefined) : fail('ja-participando');
  };
