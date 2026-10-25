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

/** Tipo de cota: *Só café* or *Completa*. */
export type TipoDeCota = 'so-cafe' | 'completa';

/** The logged-in person's participação, as answered by `GET /api/participacao/participante/eu`. */
export type Participacao = {
  readonly tipoDeCota: TipoDeCota;
  readonly participando: boolean;
  /** A troca de tipo de cota waiting for the month `aPartirDe` (`AAAA-MM`). */
  readonly troca: { readonly tipoDeCota: TipoDeCota; readonly aPartirDe: string } | null;
};

/** A usuário who has accessed the FACOFFEE, as listed by `GET /api/usuario` (gestor only). */
export type UsuarioRegistrado = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly desativado: boolean;
};

/** A participante's crédito or pendência, as listed by `GET /api/financeiro/participante`. */
export type CreditoEPendente = {
  readonly id: string;
  readonly ativo: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenteEmCentavos: number;
};

/** A gasto, as listed by `GET /api/financeiro/gasto`. */
export type Gasto = {
  readonly id: string;
  readonly participanteId: string;
  readonly valorEmCentavos: number;
  readonly origem: 'caixinha' | 'proprio-bolso';
  readonly notaId: string;
  readonly feitoEm: string;
  readonly reembolsado: boolean;
};

/**
 * The logged-in participante's crédito or pendência, with their cotas and partes de complementos,
 * as answered by `GET /api/financeiro/participante/eu`.
 */
export type Situacao = CreditoEPendente & {
  readonly cotas: readonly {
    readonly mes: string;
    readonly tipoDeCota: TipoDeCota;
    readonly valorEmCentavos: number;
  }[];
  readonly complementos: readonly {
    readonly id: string;
    readonly solicitadoEm: string;
    readonly parteEmCentavos: number;
  }[];
};

/** Saldo da caixinha and gastos do ano anterior, as answered by `GET /api/financeiro/caixinha`. */
export type Caixinha = {
  readonly saldoEmCentavos: number;
  readonly gastosDoAnoAnteriorEmCentavos: number;
};

/** Outcome of reading a recurso: its valor, not found (404) or any other failure. */
export type Leitura<T> =
  | { readonly situacao: 'ok'; readonly valor: T }
  | { readonly situacao: 'nao-encontrado' }
  | { readonly situacao: 'erro' };

/** Reads a recurso of the API; any failure but a 404, network included, is an error. */
export const ler = async <T>(token: string, caminho: string): Promise<Leitura<T>> => {
  const resposta = await chamarApi(token, caminho).catch(() => undefined);
  if (resposta?.status === 404) return { situacao: 'nao-encontrado' };
  if (!resposta?.ok) return { situacao: 'erro' };
  const valor = await resposta.json().catch(() => undefined);
  return valor === undefined ? { situacao: 'erro' } : { situacao: 'ok', valor };
};

/** Outcome of a comando: done, with the id of what it created if any, or refused with the error. */
export type Comando =
  | { readonly feito: true; readonly id?: string }
  | { readonly feito: false; readonly erro?: string };

/**
 * Sends a comando (`POST`): `corpo` goes as multipart if a `FormData`, as JSON otherwise.
 * A network failure is refused without an error.
 */
export const comandar = async (
  token: string,
  caminho: string,
  corpo?: unknown,
): Promise<Comando> => {
  const init: RequestInit =
    corpo === undefined
      ? { method: 'POST' }
      : corpo instanceof FormData
        ? { method: 'POST', body: corpo }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(corpo),
          };
  const resposta = await chamarApi(token, caminho, init).catch(() => undefined);
  const { id, error } = (await resposta?.json().catch(() => undefined)) ?? {};
  return resposta?.ok ? { feito: true, id } : { feito: false, erro: error };
};
