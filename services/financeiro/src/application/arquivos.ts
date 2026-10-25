import {
  type ArquivoInvalido,
  podeGuardarComprovante,
  podeVerComprovante,
  type Solicitante,
  type TipoDeArquivo,
  validar,
} from '../domain/arquivo.js';
import { fail, ok, type Result } from '../domain/result.js';

/** A guardado comprovante (with the participante who paid) or nota. */
export type Arquivo = {
  readonly tipo: TipoDeArquivo;
  readonly conteudo: Uint8Array;
  readonly participanteId?: string;
};

/** Storage of comprovantes and notas, by key. */
export type Armazem = {
  readonly guardar: (chave: string, arquivo: Arquivo) => Promise<void>;
  readonly obter: (chave: string) => Promise<Arquivo | undefined>;
};

/** The arquivo does not exist or the solicitante may not see it; the two are not told apart. */
export type NaoEncontrado = 'nao-encontrado';

/** Why a comprovante was not guardado. */
export type GuardarComprovanteErro = 'sem-permissao' | ArquivoInvalido;

const guardar = async (
  armazem: Armazem,
  chave: string,
  conteudo: Uint8Array,
  participanteId?: string,
): Promise<Result<void, ArquivoInvalido>> => {
  const tipo = validar(conteudo);
  if (!tipo.ok) return tipo;
  await armazem.guardar(chave, {
    tipo: tipo.value,
    conteudo,
    ...(participanteId && { participanteId }),
  });
  return ok(undefined);
};

/** The gestor guarda the comprovante of a pagamento por PIX of the participante; gives its id. */
export const guardarComprovante =
  (armazem: Armazem, newId: () => string) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    participanteId: string,
    conteudo: Uint8Array,
  ): Promise<Result<string, GuardarComprovanteErro>> => {
    if (!podeGuardarComprovante(solicitante)) return fail('sem-permissao');
    const id = newId();
    const guardado = await guardar(armazem, `comprovante/${id}`, conteudo, participanteId);
    return guardado.ok ? ok(id) : guardado;
  };

/** Any participante guarda the nota of a gasto; gives its id. */
export const guardarNota =
  (armazem: Armazem, newId: () => string) =>
  async (conteudo: Uint8Array): Promise<Result<string, ArquivoInvalido>> => {
    const id = newId();
    const guardado = await guardar(armazem, `nota/${id}`, conteudo);
    return guardado.ok ? ok(id) : guardado;
  };

/** The comprovante, only for its participante and the gestor. */
export const baixarComprovante =
  (armazem: Armazem) =>
  async (solicitante: Solicitante, id: string): Promise<Result<Arquivo, NaoEncontrado>> => {
    const arquivo = await armazem.obter(`comprovante/${id}`);
    return arquivo?.participanteId && podeVerComprovante(solicitante, arquivo.participanteId)
      ? ok(arquivo)
      : fail('nao-encontrado');
  };

/** Whether the comprovante was guardado for the participante. */
export const comprovanteDoParticipante =
  (armazem: Armazem) =>
  async (participanteId: string, id: string): Promise<boolean> =>
    (await armazem.obter(`comprovante/${id}`))?.participanteId === participanteId;

/** The nota of a gasto; every participante sees the notas of the caixinha. */
export const baixarNota =
  (armazem: Armazem) =>
  async (id: string): Promise<Result<Arquivo, NaoEncontrado>> => {
    const arquivo = await armazem.obter(`nota/${id}`);
    return arquivo ? ok(arquivo) : fail('nao-encontrado');
  };
