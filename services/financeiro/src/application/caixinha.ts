import {
  anoAnterior,
  type Caixinha,
  type CaixinhaDoMes,
  caixinha,
  caixinhaDoMes,
  type Mes,
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
  /** The movimento `antes` the month `mes` began, or `no-mes`, Campo Grande time. */
  readonly movimento: (mes: Mes, periodo: 'antes' | 'no-mes') => Promise<Movimento>;
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

/** Leitura *Caixinha do mês*; any participante sees it, as it shows no one's situação. */
export const consultarCaixinhaDoMes =
  (buscar: BuscarCaixinha) =>
  async (mes: Mes): Promise<CaixinhaDoMes> => {
    const [antes, noMes] = await Promise.all([
      buscar.movimento(mes, 'antes'),
      buscar.movimento(mes, 'no-mes'),
    ]);
    return caixinhaDoMes(mes, antes, noMes);
  };
