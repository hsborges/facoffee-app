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
