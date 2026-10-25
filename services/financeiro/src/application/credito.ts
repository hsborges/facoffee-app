import type { Solicitante } from '../domain/arquivo.js';
import { type Situacao, situacao, type Totais } from '../domain/credito.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Totais of every participante Financeiro knows, or only of the one with `id`. */
export type BuscarTotais = (id?: string) => Promise<readonly Totais[]>;

/** Leitura *Crédito e pendentes* of every participante; only the gestor sees them all. */
export const listarCreditoEPendentes =
  (buscarTotais: BuscarTotais) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
  ): Promise<Result<readonly Situacao[], 'sem-permissao'>> =>
    solicitante.perfis.includes('gestor')
      ? ok((await buscarTotais()).map(situacao))
      : fail('sem-permissao');

/** Leitura *Crédito e pendentes* of the solicitante; anyone sees their own. */
export const consultarCreditoEPendente =
  (buscarTotais: BuscarTotais) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
  ): Promise<Result<Situacao, 'participante-nao-encontrado'>> => {
    const [totais] = await buscarTotais(solicitante.id);
    return totais ? ok(situacao(totais)) : fail('participante-nao-encontrado');
  };
