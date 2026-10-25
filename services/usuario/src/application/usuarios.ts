import type { Event } from '../domain/event.js';
import { ok, type Result } from '../domain/result.js';
import {
  type Desativacao,
  type DesativarErro,
  desativar,
  type Usuario,
} from '../domain/usuario.js';

/** Persistence of deactivated accesses. */
export type Repository = {
  readonly estaDesativado: (id: string) => Promise<boolean>;
  /** Persists the desativação and its events (outbox) in the same transaction. */
  readonly salvar: (desativacao: Desativacao, events: readonly Event[]) => Promise<void>;
};

/** Source of time and ids, kept out of the domain so tests are deterministic. */
export type Clock = { readonly now: () => Date; readonly newId: () => string };

/**
 * Use case: deactivates an access and stores *Usuário desativado* in the outbox.
 * An access already deactivated succeeds without publishing again.
 */
export const desativarAcesso =
  (repository: Repository, clock: Clock) =>
  async (
    solicitante: Pick<Usuario, 'id' | 'perfis'>,
    usuarioId: string,
  ): Promise<Result<void, DesativarErro>> => {
    const result = desativar(solicitante, usuarioId, {
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    if (await repository.estaDesativado(usuarioId)) return ok(undefined);
    await repository.salvar(result.value.desativacao, [result.value.evento]);
    return ok(undefined);
  };
