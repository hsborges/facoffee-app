import { type Gasto, saidaDaCaixinha, TIPOS_DE_GASTO, type TipoDeGasto } from './gasto.js';

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
  /** The same gastos, per tipo de gasto. */
  readonly gastosDoAnoAnteriorPorTipoEmCentavos: Readonly<Record<TipoDeGasto, number>>;
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

/** A month, as `AAAA-MM`. */
export type Mes = string;

/** What entered and left the caixinha in a period. */
export type Movimento = {
  /** Sum of the pagamentos recebidos. */
  readonly recebidoEmCentavos: number;
  /** What left: gastos pagos pela caixinha and reembolsos, each with the tipo of its gasto. */
  readonly saidas: readonly { readonly tipo: TipoDeGasto; readonly valorEmCentavos: number }[];
};

/** Leitura *Caixinha do mês*: what entered, what left per tipo de gasto and what was left. */
export type CaixinhaDoMes = {
  readonly mes: Mes;
  readonly saldoNoInicioEmCentavos: number;
  readonly recebidoEmCentavos: number;
  readonly gastosPorTipoEmCentavos: Readonly<Record<TipoDeGasto, number>>;
  /** The saldo no início plus what was recebido minus the gastos of every tipo. */
  readonly saldoNoFimEmCentavos: number;
};

type ValorPorTipo = readonly Pick<Gasto, 'tipo' | 'valorEmCentavos'>[];

const soma = (valores: ValorPorTipo) =>
  valores.reduce((total, { valorEmCentavos }) => total + valorEmCentavos, 0);

const porTipo = (valores: ValorPorTipo) =>
  Object.fromEntries(
    TIPOS_DE_GASTO.map((tipo) => [tipo, soma(valores.filter((valor) => valor.tipo === tipo))]),
  ) as Record<TipoDeGasto, number>;

/** *Saldo da caixinha* and *Gastos do ano anterior*, from the gastos feitos that year. */
export const caixinha = (
  totais: TotaisDaCaixinha,
  gastosDoAnoAnterior: ValorPorTipo,
): Caixinha => ({
  saldoEmCentavos: saldoDaCaixinha(totais),
  gastosDoAnoAnteriorEmCentavos: soma(gastosDoAnoAnterior),
  gastosDoAnoAnteriorPorTipoEmCentavos: porTipo(gastosDoAnoAnterior),
});

/**
 * *Caixinha do mês* from the movimento `antes` the month and the one `noMes`. A gasto pago do
 * próprio bolso counts in the month of its reembolso, when its money leaves the caixinha.
 */
export const caixinhaDoMes = (mes: Mes, antes: Movimento, noMes: Movimento): CaixinhaDoMes => {
  const saldoNoInicioEmCentavos = antes.recebidoEmCentavos - soma(antes.saidas);
  return {
    mes,
    saldoNoInicioEmCentavos,
    recebidoEmCentavos: noMes.recebidoEmCentavos,
    gastosPorTipoEmCentavos: porTipo(noMes.saidas),
    saldoNoFimEmCentavos: saldoNoInicioEmCentavos + noMes.recebidoEmCentavos - soma(noMes.saidas),
  };
};

/** The copa is in Campo Grande: years turn at midnight there (ADR 0015). */
export const FUSO = 'America/Campo_Grande';

const formatoDoAno = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric' });

/** The year before the one of `agora`, in Campo Grande time. */
export const anoAnterior = (agora: Date): number => Number(formatoDoAno.format(agora)) - 1;
