import type { Cota } from './participante.js';

/** What a participante owes and had quitado since entering for the first time, leaving included. */
export type Totais = {
  readonly id: string;
  readonly ativo: boolean;
  /** Sum of the cotas devidas and partes de complementos. */
  readonly devidoEmCentavos: number;
  /** Sum of the pagamentos recebidos. */
  readonly pagoEmCentavos: number;
};

/** Leitura *Crédito e pendentes* of one participante; at most one of the two valores is not zero. */
export type Situacao = {
  readonly id: string;
  /** Whether the person participates now: entered and has not left. */
  readonly participando: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenciaEmCentavos: number;
};

/** What one participante owes, newest first: the cotas devidas and their partes de complementos. */
export type Devido = {
  readonly cotas: readonly Cota[];
  readonly complementos: readonly {
    readonly id: string;
    readonly solicitadoEm: Date;
    readonly parteEmCentavos: number;
  }[];
};

/** The participante's own leitura *Crédito e pendentes*, with what makes up the devido. */
export type MinhaSituacao = Situacao & Devido;

/**
 * Pagamentos minus what is devido: positive is crédito, negative is pendente, with no multa nor
 * juros. The crédito is abatido from the next cotas and partes de complementos automatically, since
 * they enter the same sum.
 */
export const situacao = ({ id, ativo, devidoEmCentavos, pagoEmCentavos }: Totais): Situacao => {
  const saldo = pagoEmCentavos - devidoEmCentavos;
  return {
    id,
    participando: ativo,
    creditoEmCentavos: Math.max(saldo, 0),
    pendenciaEmCentavos: Math.max(-saldo, 0),
  };
};
