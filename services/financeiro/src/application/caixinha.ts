import {
  anoAnterior,
  type Caixinha,
  type CaixinhaDoAno,
  caixinha,
  caixinhaDoAno,
  type Movimento,
  type TotaisDaCaixinha,
} from '../domain/caixinha.js';
import type { Gasto } from '../domain/gasto.js';
import type { Clock } from './pagamentos.js';

/** Sums of the caixinha in persistence. */
export type BuscarCaixinha = {
  readonly totais: () => Promise<TotaisDaCaixinha>;
  /** The gastos feitos in `ano`, Campo Grande time, de qualquer origem, summed per tipo de gasto. */
  readonly gastosDoAno: (
    ano: number,
  ) => Promise<readonly Pick<Gasto, 'tipo' | 'valorEmCentavos'>[]>;
  /** The movimento `antes` the year `ano` began, or `no-ano`, Campo Grande time. */
  readonly movimento: (ano: number, periodo: 'antes' | 'no-ano') => Promise<Movimento>;
};

/** Leituras *Saldo da caixinha* and *Gastos do ano anterior*; any participante sees them. */
export const consultarCaixinha =
  (buscar: BuscarCaixinha, clock: Pick<Clock, 'now'>) => async (): Promise<Caixinha> => {
    const [totais, gastosDoAnoAnterior] = await Promise.all([
      buscar.totais(),
      buscar.gastosDoAno(anoAnterior(clock.now())),
    ]);
    return caixinha(totais, gastosDoAnoAnterior);
  };

/** Leitura *Caixinha do ano*; any participante sees it, as it shows no one's situação. */
export const consultarCaixinhaDoAno =
  (buscar: BuscarCaixinha) =>
  async (ano: number): Promise<CaixinhaDoAno> => {
    const [antes, noAno] = await Promise.all([
      buscar.movimento(ano, 'antes'),
      buscar.movimento(ano, 'no-ano'),
    ]);
    return caixinhaDoAno(ano, antes, noAno);
  };
