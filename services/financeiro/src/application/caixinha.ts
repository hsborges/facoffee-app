import {
  anoAnterior,
  type Caixinha,
  type CaixinhaDoMes,
  caixinhaDoMes,
  type Mes,
  type Movimento,
  saldoDaCaixinha,
  type TotaisDaCaixinha,
} from '../domain/caixinha.js';
import type { Clock } from './pagamentos.js';

/** Sums of the caixinha in persistence. */
export type BuscarCaixinha = {
  readonly totais: () => Promise<TotaisDaCaixinha>;
  /** Sum of the gastos feitos in `ano`, Campo Grande time, de qualquer origem. */
  readonly gastosDoAno: (ano: number) => Promise<number>;
  /** The movimento `antes` the month `mes` began, or `no-mes`, Campo Grande time. */
  readonly movimento: (mes: Mes, periodo: 'antes' | 'no-mes') => Promise<Movimento>;
};

/** Leituras *Saldo da caixinha* and *Gastos do ano anterior*; any participante sees them. */
export const consultarCaixinha =
  (buscar: BuscarCaixinha, clock: Pick<Clock, 'now'>) => async (): Promise<Caixinha> => {
    const [totais, gastosDoAnoAnteriorEmCentavos] = await Promise.all([
      buscar.totais(),
      buscar.gastosDoAno(anoAnterior(clock.now())),
    ]);
    return { saldoEmCentavos: saldoDaCaixinha(totais), gastosDoAnoAnteriorEmCentavos };
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
