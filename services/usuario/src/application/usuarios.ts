import type { Event } from '../domain/event.js';
import { fail, ok, type Result } from '../domain/result.js';
import {
  type Desativacao,
  type DesativarErro,
  desativar,
  type ReativarErro,
  type SemPermissao,
  somenteGestor,
  type Usuario,
  type UsuarioRegistrado,
} from '../domain/usuario.js';

/** Persistence of usuários and deactivated accesses. */
export type Repository = {
  readonly estaDesativado: (id: string) => Promise<boolean>;
  /** Persists the desativação and its events (outbox) in the same transaction. */
  readonly salvar: (desativacao: Desativacao, events: readonly Event[]) => Promise<void>;
  /** Inserts the usuário, or updates nome, email and perfis if they changed. */
  readonly registrar: (usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'perfis'>) => Promise<void>;
  readonly listar: () => Promise<readonly UsuarioRegistrado[]>;
  /** Nome and email of one usuário, if registered. */
  readonly buscar: (id: string) => Promise<Pick<Usuario, 'id' | 'nome' | 'email'> | undefined>;
  /** Nome and email of the usuários ativos whose latest access had the perfil gestor. */
  readonly gestores: () => Promise<readonly Pick<Usuario, 'id' | 'nome' | 'email'>[]>;
  /** Removes the desativação, if any. */
  readonly reativar: (id: string) => Promise<void>;
};

/** Source of time and ids, kept out of the domain so tests are deterministic. */
export type Clock = { readonly now: () => Date; readonly newId: () => string };

/**
 * Use case: deactivates an access and stores *Usuário desativado* in the outbox.
 * An access already deactivated succeeds without publishing again; an usuário never registered
 * is refused.
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
    if (!(await repository.buscar(usuarioId))) return fail('usuario-nao-encontrado');
    if (await repository.estaDesativado(usuarioId)) return ok(undefined);
    await repository.salvar(result.value.desativacao, [result.value.evento]);
    return ok(undefined);
  };

/**
 * Use case run on every access: registers the usuário (or refreshes nome, email and perfis from
 * the Passaporte UFMS) and tells whether the access is active.
 */
export const registrarAcesso =
  (repository: Repository) =>
  async (
    usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'perfis'>,
  ): Promise<'ativo' | 'desativado'> => {
    await repository.registrar(usuario);
    return (await repository.estaDesativado(usuario.id)) ? 'desativado' : 'ativo';
  };

/** Use case: the usuários registered so far, with who is desativado; only for the gestor. */
export const listarUsuarios =
  (repository: Repository) =>
  async (
    solicitante: Pick<Usuario, 'perfis'>,
  ): Promise<Result<readonly UsuarioRegistrado[], SemPermissao>> => {
    const permitido = somenteGestor(solicitante);
    return permitido.ok ? ok(await repository.listar()) : permitido;
  };

/**
 * Use case: reactivates an access; only the gestor. Publishes nothing and does not bring the
 * participação back (ADR 0013). Reactivating an active access has no effect; an usuário never
 * registered is refused.
 */
export const reativarAcesso =
  (repository: Repository) =>
  async (
    solicitante: Pick<Usuario, 'perfis'>,
    usuarioId: string,
  ): Promise<Result<void, ReativarErro>> => {
    const permitido = somenteGestor(solicitante);
    if (!permitido.ok) return permitido;
    if (!(await repository.buscar(usuarioId))) return fail('usuario-nao-encontrado');
    await repository.reativar(usuarioId);
    return ok(undefined);
  };
