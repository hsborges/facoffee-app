import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Access profile in the FACOFFEE, from a Keycloak realm role. */
export type Perfil = 'gestor' | 'participante';

/** The logged-in user, as known from the token. */
export type Usuario = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfis: readonly Perfil[];
};

const PERFIS: readonly Perfil[] = ['gestor', 'participante'];

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

/** Why a desativação was refused. */
export type DesativarErro = 'sem-permissao';

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
