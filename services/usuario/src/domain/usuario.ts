import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

export type Perfil = 'gestor' | 'participante';

export type Usuario = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfis: readonly Perfil[];
};

const PERFIS: readonly Perfil[] = ['gestor', 'participante'];

// The Passaporte UFMS also carries Keycloak defaults and roles of other systems.
export const perfisDos = (papeis: readonly string[]): readonly Perfil[] =>
  PERFIS.filter((perfil) => papeis.includes(perfil));

export type Desativacao = { readonly id: string; readonly desativadoEm: Date };

export type UsuarioDesativado = Event<'user.user-deactivated', { readonly userId: string }>;

export type DesativarErro = 'sem-permissao';

// Only the gestor deactivates someone else; anyone may deactivate their own access.
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
