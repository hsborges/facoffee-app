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
