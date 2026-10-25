/** Access profile in the FACOFFEE (ADR 0008). */
export type Perfil = 'gestor' | 'participante';

/** The logged-in usuário, as answered by `GET /api/usuario/eu`. */
export type Usuario = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfis: readonly Perfil[];
};

/** Outcome of reading the logged-in usuário. */
export type UsuarioLogado =
  | { readonly situacao: 'ativo'; readonly usuario: Usuario }
  | { readonly situacao: 'desativado' }
  | { readonly situacao: 'erro' };

/**
 * Calls the public API through the API Gateway with the access token (ADR 0007).
 * Paths are same-origin (`/api/...`); in development Vite proxies them to the gateway (ADR 0019).
 */
export const chamarApi = (token: string, caminho: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(caminho, { ...init, headers });
};

/**
 * The logged-in usuário. The gateway answers 403 to a deactivated access (ADR 0011);
 * any other failure, network included, is an error.
 */
export const obterUsuarioLogado = async (token: string): Promise<UsuarioLogado> => {
  const resposta = await chamarApi(token, '/api/usuario/eu').catch(() => undefined);
  if (resposta?.status === 403) return { situacao: 'desativado' };
  if (!resposta?.ok) return { situacao: 'erro' };
  const usuario = await resposta.json().catch(() => undefined);
  return usuario ? { situacao: 'ativo', usuario } : { situacao: 'erro' };
};
