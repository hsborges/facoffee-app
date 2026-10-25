import type { Solicitante } from '../domain/arquivo.js';
import {
  type Devido,
  type MinhaSituacao,
  type Situacao,
  situacao,
  type Totais,
} from '../domain/credito.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Totais of every participante Financeiro knows, or only of the one with `id`. */
export type BuscarTotais = (id?: string) => Promise<readonly Totais[]>;

/** The cotas and partes de complementos devidas by the participante with `id`. */
export type BuscarDevido = (id: string) => Promise<Devido>;

/** Leitura *Crédito e pendentes* of every participante; only the gestor sees them all. */
export const listarCreditoEPendentes =
  (buscarTotais: BuscarTotais) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
  ): Promise<Result<readonly Situacao[], 'sem-permissao'>> =>
    solicitante.perfis.includes('gestor')
      ? ok((await buscarTotais()).map(situacao))
      : fail('sem-permissao');

/**
 * Leitura *Crédito e pendentes* of the solicitante, with their cotas and partes de complementos;
 * anyone sees their own.
 */
export const consultarCreditoEPendente =
  (buscarTotais: BuscarTotais, buscarDevido: BuscarDevido) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
  ): Promise<Result<MinhaSituacao, 'participante-nao-encontrado'>> => {
    const [[totais], devido] = await Promise.all([
      buscarTotais(solicitante.id),
      buscarDevido(solicitante.id),
    ]);
    return totais ? ok({ ...situacao(totais), ...devido }) : fail('participante-nao-encontrado');
  };
