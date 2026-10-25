/** What a participante owes and paid since entering for the first time, leaving included. */
export type Totais = {
  readonly id: string;
  readonly ativo: boolean;
  /** Sum of the cotas devidas. */
  readonly devidoEmCentavos: number;
  /** Sum of the pagamentos recebidos. */
  readonly pagoEmCentavos: number;
};

/** Leitura *Crédito e pendentes* of one participante; at most one of the two valores is not zero. */
export type Situacao = {
  readonly id: string;
  readonly ativo: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenteEmCentavos: number;
};

/**
 * Pagamentos minus what is devido: positive is crédito, negative is pendente, with no multa nor
 * juros. The crédito is abatido from the next cotas automatically, since they enter the same sum.
 * shortcut: partes de complementos are not devidas yet; add them to the devido with issue #25.
 */
export const situacao = ({ id, ativo, devidoEmCentavos, pagoEmCentavos }: Totais): Situacao => {
  const saldo = pagoEmCentavos - devidoEmCentavos;
  return {
    id,
    ativo,
    creditoEmCentavos: Math.max(saldo, 0),
    pendenteEmCentavos: Math.max(-saldo, 0),
  };
};
