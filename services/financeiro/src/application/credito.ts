import type { Solicitante } from '../domain/arquivo.js';
import {
  type Devido,
  type MinhaSituacao,
  type Situacao,
  situacao,
  type Totais,
} from '../domain/credito.js';
import type { Cota } from '../domain/participante.js';
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

/** A participante ativo who is pendente, with their most recent cota, if any. */
export type Pendente = {
  readonly id: string;
  readonly pendenteEmCentavos: number;
  readonly cota: Cota | null;
};

/**
 * Leitura *Crédito e pendentes* reduced to the ativos pendentes, for Notificação to lembrar them
 * (ADR 0027). Whoever has the cota abatida from the crédito is not pendente, so is not listed.
 */
export const listarPendentes =
  (buscarTotais: BuscarTotais, buscarDevido: BuscarDevido) =>
  async (): Promise<readonly Pendente[]> => {
    const pendentes = (await buscarTotais())
      .map(situacao)
      .filter((s) => s.ativo && s.pendenteEmCentavos > 0);
    // ponytail: one query per pendente; a few dozen participantes at most.
    return Promise.all(
      pendentes.map(async ({ id, pendenteEmCentavos }) => ({
        id,
        pendenteEmCentavos,
        cota: (await buscarDevido(id)).cotas[0] ?? null,
      })),
    );
  };

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
