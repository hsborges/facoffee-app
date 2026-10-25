import {
  anoAnterior,
  type Caixinha,
  saldoDaCaixinha,
  type TotaisDaCaixinha,
} from '../domain/caixinha.js';
import type { Clock } from './pagamentos.js';

/** Sums of the caixinha in persistence. */
export type BuscarCaixinha = {
  readonly totais: () => Promise<TotaisDaCaixinha>;
  /** Sum of the gastos feitos in `ano`, Campo Grande time, de qualquer origem. */
  readonly gastosDoAno: (ano: number) => Promise<number>;
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
