/** Access profile in the FACOFFEE (ADR 0008). */
export type Perfil = 'gestor';

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

/**
 * Someone who ever participated, with the tipo de cota of now, as listed by
 * `GET /api/participacao/participante` (gestor only).
 */
export type Participante = Participacao & { readonly id: string };

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
  readonly participando: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenciaEmCentavos: number;
};

/** Tipo de gasto. */
export type TipoDeGasto = 'cafe' | 'outros-itens' | 'conserto-e-manutencao' | 'reposicao';

/** A gasto, as listed by `GET /api/financeiro/gasto`. */
export type Gasto = {
  readonly id: string;
  readonly participanteId: string;
  readonly valorEmCentavos: number;
  readonly origem: 'caixinha' | 'proprio-bolso';
  readonly tipo: TipoDeGasto;
  readonly notaId: string;
  readonly registradoEm: string;
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
  readonly gastosDoAnoAnteriorPorTipoEmCentavos: Readonly<Record<TipoDeGasto, number>>;
};

/** The valor of a tipo de cota in a year, as listed by `GET /api/participacao/valor-da-cota`. */
export type ValorDaCota = {
  readonly tipoDeCota: TipoDeCota;
  readonly ano: number;
  readonly valorEmCentavos: number;
};

/** What entered, left per tipo de gasto and was left, as answered by `GET /api/financeiro/caixinha/{ano}`. */
export type CaixinhaDoAno = {
  readonly ano: number;
  readonly saldoNoInicioEmCentavos: number;
  readonly recebidoEmCentavos: number;
  readonly gastosPorTipoEmCentavos: Readonly<Record<TipoDeGasto, number>>;
  readonly saldoNoFimEmCentavos: number;
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

/**
 * Guarda an arquivo (multipart), then runs the comando that references it by id; a refused arquivo
 * stops there.
 */
export const guardarAntes = async (
  token: string,
  caminho: string,
  campos: Readonly<Record<string, string | File>>,
  comando: (id?: string) => Promise<Comando>,
): Promise<Comando> => {
  // ponytail: an arquivo guardado whose comando fails stays orphaned in the armazenamento; clean up if they pile up
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor);
  const guardado = await comandar(token, caminho, form);
  return guardado.feito ? comando(guardado.id) : guardado;
};

/**
 * Opens an arquivo of the API (a comprovante) in a new tab. The tab opens before the download, while
 * still in the click, so the browser does not block it. False if the arquivo could not be read.
 */
export const abrirArquivo = async (token: string, caminho: string) => {
  const aba = window.open('', '_blank');
  const resposta = await chamarApi(token, caminho).catch(() => undefined);
  if (!aba || !resposta?.ok) {
    aba?.close();
    return false;
  }
  const url = URL.createObjectURL(await resposta.blob());
  aba.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
};

/** Where the análise of a comprovante enviado stands. */
export type Analise =
  | { readonly situacao: 'a-confirmar' }
  | { readonly situacao: 'confirmado'; readonly valorConfirmadoEmCentavos: number }
  | { readonly situacao: 'recusado'; readonly motivo: string };

/**
 * A comprovante the participante sent to the gestor, as listed by
 * `GET /api/financeiro/comprovante-enviado` (gestor, a confirmar) and `.../comprovante-enviado/eu`.
 */
export type ComprovanteEnviado = {
  readonly id: string;
  readonly participanteId: string;
  /** The arquivo, at `GET /api/financeiro/comprovante/{comprovanteId}`. */
  readonly comprovanteId: string;
  readonly valorEmCentavos: number;
  readonly enviadoEm: string;
} & Analise;

const ERROS: ReadonlyMap<string, string> = new Map([
  ['arquivo-vazio', 'O arquivo está vazio.'],
  ['tipo-nao-aceito', 'Envie o arquivo em PDF, JPEG ou PNG.'],
  ['arquivo-grande-demais', 'O arquivo passa de 5 MB.'],
  ['pix-sem-comprovante', 'O pagamento por PIX exige o comprovante.'],
  ['comprovante-so-no-pix', 'Só o pagamento por PIX tem comprovante.'],
  ['comprovante-ja-usado', 'Esse comprovante já foi usado em outro pagamento.'],
  ['comprovante-enviado-nao-encontrado', 'Esse comprovante não foi encontrado.'],
  ['comprovante-ja-analisado', 'O gestor já confirmou ou recusou esse comprovante.'],
  ['comprovante-alterado', 'O participante trocou o arquivo desse comprovante. Veja-o de novo.'],
  ['recusa-sem-motivo', 'Informe o motivo da recusa.'],
  ['nota-ja-usada', 'Essa nota já foi usada em outro gasto.'],
  [
    'participante-nao-encontrado',
    'Participante não encontrado: só quem já pediu entrada tem pagamentos e gastos.',
  ],
  ['nunca-participou', 'Só quem já pediu entrada na copa envia comprovantes e registra gastos.'],
  ['gasto-nao-encontrado', 'Gasto não encontrado.'],
  ['gasto-ja-reembolsado', 'Esse gasto já foi reembolsado.'],
  ['ninguem-participando', 'Não há participante para dividir o complemento.'],
  ['parte-menor-que-um-centavo', 'O valor não dá um centavo para cada participante.'],
  ['ano-passado', 'Esse ano já passou.'],
  ['valor-ja-definido', 'O valor desse tipo de cota já foi definido para esse ano.'],
]);

/** Explains an error of the API; any other gets the comando's own message. */
export const mensagemDaFalha = (erro: string | undefined, padrao: string) =>
  ERROS.get(erro ?? '') ?? padrao;
