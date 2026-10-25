import { type Gasto, saidaDaCaixinha } from './gasto.js';

/** What entered and left the caixinha, summed. */
export type TotaisDaCaixinha = {
  /** Sum of the pagamentos recebidos. */
  readonly recebidoEmCentavos: number;
  /** Gastos feitos, summed per origem. */
  readonly gastos: readonly Pick<Gasto, 'origem' | 'valorEmCentavos'>[];
  /** Sum of the reembolsos feitos. */
  readonly reembolsadoEmCentavos: number;
};

/** Leituras *Saldo da caixinha* and *Gastos do ano anterior*. */
export type Caixinha = {
  /** Negative when the gastos pela caixinha passed what was received. */
  readonly saldoEmCentavos: number;
  /** All gastos of the year before, de qualquer origem: the base for the valor da cota. */
  readonly gastosDoAnoAnteriorEmCentavos: number;
};

/**
 * *Saldo da caixinha*: pagamentos recebidos minus gastos pagos pela caixinha and reembolsos. A gasto
 * pago do próprio bolso only leaves with its reembolso.
 */
export const saldoDaCaixinha = ({
  recebidoEmCentavos,
  gastos,
  reembolsadoEmCentavos,
}: TotaisDaCaixinha): number =>
  recebidoEmCentavos -
  gastos.reduce((total, gasto) => total + saidaDaCaixinha(gasto), 0) -
  reembolsadoEmCentavos;

/** The copa is in Campo Grande: years turn at midnight there (ADR 0015). */
export const FUSO = 'America/Campo_Grande';

const formatoDoAno = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric' });

/** The year before the one of `agora`, in Campo Grande time. */
export const anoAnterior = (agora: Date): number => Number(formatoDoAno.format(agora)) - 1;
