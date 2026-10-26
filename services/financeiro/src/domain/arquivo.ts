import { fail, ok, type Result } from './result.js';

/** Types accepted for a comprovante or a nota. */
export type TipoDeArquivo = 'application/pdf' | 'image/jpeg' | 'image/png';

/** Why an arquivo was refused. */
export type ArquivoInvalido = 'arquivo-vazio' | 'arquivo-grande-demais' | 'tipo-nao-aceito';

/** Largest comprovante or nota accepted: 5 MB. */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/** Who asks for an arquivo: the logged-in person and their perfis. */
export type Solicitante = { readonly id: string; readonly perfis: readonly string[] };

const ASSINATURAS: readonly (readonly [TipoDeArquivo, readonly number[]])[] = [
  ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
];

/**
 * Checks size and type of a comprovante or nota. The type comes from the first bytes of the
 * content, never from what the client declares.
 */
export const validar = (conteudo: Uint8Array): Result<TipoDeArquivo, ArquivoInvalido> => {
  if (conteudo.length === 0) return fail('arquivo-vazio');
  if (conteudo.length > TAMANHO_MAXIMO) return fail('arquivo-grande-demais');
  const tipo = ASSINATURAS.find(([, assinatura]) => assinatura.every((b, i) => conteudo[i] === b));
  return tipo ? ok(tipo[0]) : fail('tipo-nao-aceito');
};

/**
 * The gestor guarda the comprovante of a pagamento they receive; the participante guarda only
 * their own, to send it to the gestor.
 */
export const podeGuardarComprovante = (solicitante: Solicitante, participanteId: string) =>
  solicitante.id === participanteId || solicitante.perfis.includes('gestor');

/** A comprovante is seen only by the participante whose cotas the pagamento quita and by the gestor. */
export const podeVerComprovante = (solicitante: Solicitante, participanteId: string) =>
  solicitante.id === participanteId || solicitante.perfis.includes('gestor');
