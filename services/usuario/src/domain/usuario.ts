import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/**
 * Access profile in the FACOFFEE, from a realm role of the Passaporte UFMS. Only the gestor has
 * one: having access does not make anyone a participante, which is Participação's to say.
 */
export type Perfil = 'gestor';

/** The logged-in user, as known from the token. */
export type Usuario = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfis: readonly Perfil[];
};

const PERFIS: readonly Perfil[] = ['gestor'];

/**
 * FACOFFEE profiles among the token roles.
 * The Passaporte UFMS also carries Keycloak defaults and roles of other systems, which are dropped.
 */
export const perfisDos = (papeis: readonly string[]): readonly Perfil[] =>
  PERFIS.filter((perfil) => papeis.includes(perfil));

/** A deactivated access: who and when. */
export type Desativacao = { readonly id: string; readonly desativadoEm: Date };

/** *Usuário desativado*, per `contracts/events/user.user-deactivated.v1.json`. */
export type UsuarioDesativado = Event<'user.user-deactivated', { readonly userId: string }>;

/** A usuário registered on their first access, as listed to the gestor. */
export type UsuarioRegistrado = Pick<Usuario, 'id' | 'nome' | 'email'> & {
  readonly desativado: boolean;
};

/** Why a command was refused: the solicitante lacks the perfil for it. */
export type SemPermissao = 'sem-permissao';

/** Why a command on an access was refused: the usuário never accessed the FACOFFEE. */
export type UsuarioNaoEncontrado = 'usuario-nao-encontrado';

/** Why a desativação was refused. */
export type DesativarErro = SemPermissao | UsuarioNaoEncontrado;

/** Why a reativação was refused. */
export type ReativarErro = SemPermissao | UsuarioNaoEncontrado;

/** Accepts only the gestor: listing the usuários and reactivating an access are theirs alone. */
export const somenteGestor = (solicitante: Pick<Usuario, 'perfis'>): Result<void, SemPermissao> =>
  solicitante.perfis.includes('gestor') ? ok(undefined) : fail('sem-permissao');

/**
 * Deactivates the access of `usuarioId` and produces *Usuário desativado*.
 * Only the gestor deactivates someone else; anyone may deactivate their own access.
 */
export const desativar = (
  solicitante: Pick<Usuario, 'id' | 'perfis'>,
  usuarioId: string,
  contexto: { readonly eventId: string; readonly agora: Date },
): Result<
  { readonly desativacao: Desativacao; readonly evento: UsuarioDesativado },
  DesativarErro
> => {
  if (solicitante.id !== usuarioId && !solicitante.perfis.includes('gestor')) {
    return fail('sem-permissao');
  }
  const { eventId, agora } = contexto;
  return ok({
    desativacao: { id: usuarioId, desativadoEm: agora },
    evento: {
      id: eventId,
      type: 'user.user-deactivated',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: { userId: usuarioId },
    },
  });
};
